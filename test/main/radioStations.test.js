import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const { stationSummary } = createRequire(import.meta.url)("../../src/main/radioStations.js");

describe("stationSummary", () => {
  it("prefers the resolved URL and keeps only known fields", () => {
    const summary = stationSummary({
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
    });
    expect(summary).toEqual({
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
