import { describe, expect, it } from "vitest";
import { stationSummary } from "../../src/main/radioStations";

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
