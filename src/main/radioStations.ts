import type { CountedOption, CountryOption, Station } from "../shared/types";

export interface RadioBrowserStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved?: string;
  favicon?: string;
  tags?: string;
  country?: string;
  countrycode?: string;
  state?: string;
  bitrate?: number;
  codec?: string;
}

export function stationSummary(s: RadioBrowserStation): Station {
  return {
    stationuuid: s.stationuuid,
    name: s.name,
    url: s.url_resolved || s.url,
    favicon: s.favicon || "",
    tags: s.tags || "",
    country: s.country || "",
    countrycode: s.countrycode || "",
    state: s.state || "",
    bitrate: s.bitrate || 0,
    codec: s.codec || "",
  };
}

export interface RadioBrowserNamedCount {
  name: string;
  stationcount: number;
  iso_3166_1?: string;
}

export function filterStationsByTag(stations: Station[], tag: string, limit: number): Station[] {
  const wantedTag = tag.toLowerCase();
  return stations
    .filter((s) =>
      s.tags
        .split(",")
        .some((t) => t.trim().toLowerCase() === wantedTag)
    )
    .slice(0, limit);
}

export function toCountryOptions(data: RadioBrowserNamedCount[], limit: number): CountryOption[] {
  return data
    .filter((c): c is RadioBrowserNamedCount & { iso_3166_1: string } => !!c.iso_3166_1 && c.stationcount > 0)
    .map((c) => ({ code: c.iso_3166_1, name: c.name, count: c.stationcount }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function toStateOptions(data: RadioBrowserNamedCount[], limit: number): CountedOption[] {
  return data
    .filter((s) => s.name && s.stationcount > 0)
    .map((s) => ({ name: s.name, count: s.stationcount }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function toTagOptions(data: RadioBrowserNamedCount[]): CountedOption[] {
  return data.filter((t) => t.name).map((t) => ({ name: t.name, count: t.stationcount }));
}

export function countTags(stations: Pick<RadioBrowserStation, "tags">[], limit: number): CountedOption[] {
  const counts = new Map<string, number>();
  for (const s of stations) {
    for (const tag of (s.tags || "").split(",")) {
      const name = tag.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
