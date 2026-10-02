import { writeLog } from "./logging";
import { REQUEST_TIMEOUT_MS, USER_AGENT, netRequestJson, netRequestText } from "./network";
import { isHttpUrl, parsePlaylistStreamUrl, playlistKind } from "./streamUrl";
import {
  countTags,
  filterStationsByTag,
  stationSummary,
  toCountryOptions,
  toStateOptions,
  toTagOptions,
} from "./radioStations";
import type { CountedOption, CountryOption, ResolveStreamResult, Station, StationSearchParams } from "../shared/types";

const RADIO_API_MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://de2.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
];

const PLAYLIST_MAX_BYTES = 256 * 1024;

// The API's tag filter is case-sensitive (pop ≠ Pop), so filter by tag locally.
const TAG_MATCH_SAMPLE_SIZE = 250;

// Native <select> popups can't be height-limited, so cap the number of options.
const COUNTRY_LIMIT = 40;
const STATE_LIMIT = 30;
const TAG_LIMIT = 30;
const TAG_SAMPLE_SIZE = 500;

async function radioApiFetch(pathAndQuery: string): Promise<any> {
  let lastErr;
  for (const base of RADIO_API_MIRRORS) {
    try {
      return await netRequestJson(base + pathAndQuery, { "User-Agent": USER_AGENT }, REQUEST_TIMEOUT_MS);
    } catch (err) {
      lastErr = err;
      writeLog("warn", "radio-api", `Mirror ${base} failed for ${pathAndQuery}: ${err.message}`);
    }
  }
  writeLog("error", "radio-api", `All mirrors failed for ${pathAndQuery}: ${lastErr?.message}`);
  throw lastErr;
}

export async function resolveStreamUrl(url: string): Promise<ResolveStreamResult> {
  if (typeof url !== "string" || !isHttpUrl(url)) return { ok: false, error: "invalid" };
  const kind = playlistKind(url);
  if (!kind) return { ok: true, url };
  try {
    const text = await netRequestText(url, { "User-Agent": USER_AGENT }, REQUEST_TIMEOUT_MS, PLAYLIST_MAX_BYTES);
    const streamUrl = parsePlaylistStreamUrl(text, kind, url);
    if (!streamUrl) return { ok: false, error: "playlist" };
    return { ok: true, url: streamUrl };
  } catch (err) {
    writeLog("warn", "radio", `Playlist ${url} failed: ${err.message}`);
    return { ok: false, error: "playlist" };
  }
}

export async function searchStations(params: StationSearchParams = {}): Promise<Station[]> {
  const limit = params.limit || 40;
  const q = new URLSearchParams();
  if (params.name) q.set("name", params.name);
  if (params.country) q.set("countrycode", params.country);
  if (params.state) q.set("state", params.state);
  q.set("limit", String(params.tag ? TAG_MATCH_SAMPLE_SIZE : limit));
  q.set("hidebroken", "true");
  q.set("order", "votes");
  q.set("reverse", "true");
  const data = await radioApiFetch(`/json/stations/search?${q.toString()}`);
  const stations = data.map(stationSummary);
  if (!params.tag) return stations;
  return filterStationsByTag(stations, params.tag, limit);
}

export async function fetchCountries(): Promise<CountryOption[]> {
  return toCountryOptions(await radioApiFetch("/json/countries"), COUNTRY_LIMIT);
}

// Despite its path, this endpoint takes the country name, not the ISO code.
export async function fetchStates(countryName: string): Promise<CountedOption[]> {
  return toStateOptions(await radioApiFetch(`/json/states/${encodeURIComponent(countryName)}/`), STATE_LIMIT);
}

export async function fetchTags(): Promise<CountedOption[]> {
  return toTagOptions(await radioApiFetch(`/json/tags?order=stationcount&reverse=true&limit=${TAG_LIMIT}`));
}

export async function fetchTagsForFilter(countryCode: string, state: string): Promise<CountedOption[]> {
  if (!countryCode && !state) return fetchTags();
  const q = new URLSearchParams();
  if (countryCode) q.set("countrycode", countryCode);
  if (state) q.set("state", state);
  q.set("hidebroken", "true");
  q.set("order", "votes");
  q.set("reverse", "true");
  q.set("limit", String(TAG_SAMPLE_SIZE));
  return countTags(await radioApiFetch(`/json/stations/search?${q.toString()}`), TAG_LIMIT);
}

export async function registerStationClick(uuid: string): Promise<string | null> {
  try {
    const data = await radioApiFetch(`/json/url/${encodeURIComponent(uuid)}`);
    return data.url || null;
  } catch {
    return null;
  }
}
