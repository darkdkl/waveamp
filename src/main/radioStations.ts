import type { Station } from "../shared/types";

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
