import { app, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { Resolver } from "node:dns/promises";
import { writeLog } from "./logging";
import { HttpStatusError, REQUEST_TIMEOUT_MS, USER_AGENT, isProxyEnabled, netRequestJson, netRequestText } from "./network";
import {
  CatalogUnavailableError,
  createMirrorClient,
  mirrorsFromServerList,
  mirrorsFromSrv,
  parseCache,
  parseSources,
  type DiscoverySource,
  type MirrorCache,
  type RadioSources,
} from "./radioMirrors";
import { isHttpUrl, parsePlaylistStreamUrl, playlistKind } from "./streamUrl";
import {
  countTags,
  filterStationsByTag,
  stationSummary,
  toCountryOptions,
  toStateOptions,
  toTagOptions,
} from "./radioStations";
import type {
  CountedOption,
  CountryOption,
  ResolveStreamResult,
  Station,
  StationSearchParams,
  StationSearchResult,
} from "../shared/types";
import { errorMessage } from "../shared/errors";

const BUNDLED_SOURCES_PATH = path.join(app.getAppPath(), "assets", "radio-sources.json");
const USER_SOURCES_PATH = path.join(app.getPath("userData"), "radio-sources.json");
const MIRROR_CACHE_PATH = path.join(app.getPath("userData"), "radio-mirrors-cache.json");
const DNS_TIMEOUT_MS = 3000;

const PLAYLIST_MAX_BYTES = 256 * 1024;

// The API's tag filter is case-sensitive (pop ≠ Pop), so filter by tag locally.
const TAG_MATCH_SAMPLE_SIZE = 250;

// Native <select> popups can't be height-limited, so cap the number of options.
const TAG_LIMIT = 30;
const TAG_SAMPLE_SIZE = 500;

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function loadBundledSources(): RadioSources {
  const sources = parseSources(readJson(BUNDLED_SOURCES_PATH));
  if (!sources) throw new Error("The built-in radio-sources.json has no usable sources");
  return sources;
}

function loadUserSources(): RadioSources {
  if (!fs.existsSync(USER_SOURCES_PATH)) {
    try {
      fs.writeFileSync(USER_SOURCES_PATH, fs.readFileSync(BUNDLED_SOURCES_PATH));
      writeLog("info", "radio-api", `Created ${USER_SOURCES_PATH} from the built-in list`);
    } catch (err) {
      writeLog("warn", "radio-api", `Could not create ${USER_SOURCES_PATH}: ${errorMessage(err)}`);
    }
    return loadBundledSources();
  }
  try {
    const sources = parseSources(readJson(USER_SOURCES_PATH));
    if (sources) return sources;
    writeLog("warn", "radio-api", `${USER_SOURCES_PATH} has no usable sources, using the built-in list`);
  } catch (err) {
    writeLog("warn", "radio-api", `Could not read ${USER_SOURCES_PATH}, using the built-in list: ${errorMessage(err)}`);
  }
  return loadBundledSources();
}

function loadMirrorCache(): MirrorCache | null {
  try {
    return parseCache(readJson(MIRROR_CACHE_PATH));
  } catch {
    return null;
  }
}

function saveMirrorCache(cache: MirrorCache): void {
  try {
    fs.writeFileSync(MIRROR_CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (err) {
    writeLog("warn", "radio-api", `Could not save the mirror cache: ${errorMessage(err)}`);
  }
}

async function discoverMirrors(source: DiscoverySource): Promise<string[]> {
  if (source.type === "dns-srv") {
    const resolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 2 });
    return mirrorsFromSrv(await resolver.resolveSrv(source.name));
  }
  return mirrorsFromServerList(await netRequestJson(source.url, { "User-Agent": USER_AGENT }, REQUEST_TIMEOUT_MS));
}

function isMirrorFailure(err: unknown): boolean {
  return !(err instanceof HttpStatusError && err.status >= 400 && err.status < 500 && err.status !== 429);
}

const mirrors = createMirrorClient({
  loadUserSources,
  loadBundledSources,
  loadCache: loadMirrorCache,
  saveCache: saveMirrorCache,
  discover: discoverMirrors,
  skipReason: (source) => (source.type === "dns-srv" && isProxyEnabled() ? "DNS would bypass the proxy" : null),
  isMirrorFailure,
  log: (level, message) => writeLog(level, "radio-api", message),
  now: Date.now,
  random: Math.random,
});

export function currentRadioMirror(): string | null {
  return mirrors.currentMirror();
}

export async function refreshRadioMirrors(): Promise<string | null> {
  try {
    await mirrors.refresh("/json/stats", (base) => netRequestJson(`${base}/json/stats`, { "User-Agent": USER_AGENT }, REQUEST_TIMEOUT_MS));
    return mirrors.currentMirror();
  } catch (err) {
    writeLog("warn", "radio-api", `Mirror refresh failed: ${errorMessage(err)}`);
    return null;
  }
}

export function showRadioSourcesFile(): void {
  loadUserSources();
  shell.showItemInFolder(USER_SOURCES_PATH);
}

function radioApiFetch(pathAndQuery: string): Promise<any> {
  return mirrors.request(pathAndQuery, (base) => netRequestJson(base + pathAndQuery, { "User-Agent": USER_AGENT }, REQUEST_TIMEOUT_MS));
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
    writeLog("warn", "radio", `Playlist ${url} failed: ${errorMessage(err)}`);
    return { ok: false, error: "playlist" };
  }
}

export async function searchStations(params: StationSearchParams = {}): Promise<StationSearchResult> {
  try {
    return { ok: true, stations: await findStations(params) };
  } catch (err) {
    if (err instanceof CatalogUnavailableError) return { ok: false, error: "unavailable" };
    writeLog("error", "radio", `Search failed: ${errorMessage(err)}`);
    return { ok: false, error: "failed" };
  }
}

async function findStations(params: StationSearchParams): Promise<Station[]> {
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
  return toCountryOptions(await radioApiFetch("/json/countries"));
}

// Despite its path, this endpoint takes the country name, not the ISO code.
export async function fetchStates(countryName: string): Promise<CountedOption[]> {
  return toStateOptions(await radioApiFetch(`/json/states/${encodeURIComponent(countryName)}/`));
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
