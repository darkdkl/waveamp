import { describe, expect, it } from "vitest";
import {
  countTags,
  filterStationsByTag,
  stationSummary,
  toCountryOptions,
  toStateOptions,
  toTagOptions,
} from "../../src/main/radioStations";

describe("stationSummary", () => {
  it("prefers the resolved URL and keeps only known fields", () => {
    const fromApi = {
      stationuuid: "abc",
      name: "Radio",
      url: "http://r.example/listen.pls",
      url_resolved: "http://s.example/live",
      favicon: "http://r.example/icon.png",
      tags: "jazz,blues",
      country: "France",
      countrycode: "FR",
      state: "Paris",
      bitrate: 128,
      codec: "MP3",
      votes: 1000,
    };
    expect(stationSummary(fromApi)).toEqual({
      stationuuid: "abc",
      name: "Radio",
      url: "http://s.example/live",
      favicon: "http://r.example/icon.png",
      tags: "jazz,blues",
      country: "France",
      countrycode: "FR",
      state: "Paris",
      bitrate: 128,
      codec: "MP3",
    });
  });

  it("falls back to url and fills empty defaults", () => {
    expect(stationSummary({ stationuuid: "x", name: "Bare", url: "http://s.example/live" })).toEqual({
      stationuuid: "x",
      name: "Bare",
      url: "http://s.example/live",
      favicon: "",
      tags: "",
      country: "",
      countrycode: "",
      state: "",
      bitrate: 0,
      codec: "",
    });
  });
});

function station(tags: string, name = tags) {
  return stationSummary({ stationuuid: name, name, url: "http://s.example/" + name, tags });
}

describe("filterStationsByTag", () => {
  it("matches whole tags case-insensitively and keeps order", () => {
    const stations = [station("Pop,rock", "a"), station("synthpop", "b"), station(" pop ", "c"), station("jazz", "d")];
    expect(filterStationsByTag(stations, "pop", 10).map((s) => s.name)).toEqual(["a", "c"]);
  });

  it("respects the limit", () => {
    const stations = [station("pop", "a"), station("pop", "b"), station("pop", "c")];
    expect(filterStationsByTag(stations, "POP", 2).map((s) => s.name)).toEqual(["a", "b"]);
  });
});

describe("filter options", () => {
  it("builds countries with codes, sorted by station count", () => {
    const data = [
      { name: "France", iso_3166_1: "FR", stationcount: 10 },
      { name: "Nowhere", iso_3166_1: "", stationcount: 99 },
      { name: "Empty", iso_3166_1: "EM", stationcount: 0 },
      { name: "Germany", iso_3166_1: "DE", stationcount: 30 },
    ];
    expect(toCountryOptions(data, 5)).toEqual([
      { code: "DE", name: "Germany", count: 30 },
      { code: "FR", name: "France", count: 10 },
    ]);
    expect(toCountryOptions(data, 1)).toHaveLength(1);
  });

  it("builds regions, skipping empty names and counts", () => {
    const data = [
      { name: "Bavaria", stationcount: 5 },
      { name: "", stationcount: 9 },
      { name: "Berlin", stationcount: 7 },
      { name: "Ghost", stationcount: 0 },
    ];
    expect(toStateOptions(data, 10)).toEqual([
      { name: "Berlin", count: 7 },
      { name: "Bavaria", count: 5 },
    ]);
  });

  it("keeps the API's tag order", () => {
    expect(toTagOptions([{ name: "rock", stationcount: 9 }, { name: "", stationcount: 5 }, { name: "pop", stationcount: 12 }])).toEqual([
      { name: "rock", count: 9 },
      { name: "pop", count: 12 },
    ]);
  });

  it("counts tags across stations", () => {
    const stations = [{ tags: "rock, pop" }, { tags: "pop,,jazz" }, { tags: "" }, {}, { tags: "pop" }];
    expect(countTags(stations, 2)).toEqual([
      { name: "pop", count: 3 },
      { name: "rock", count: 1 },
    ]);
  });
});
