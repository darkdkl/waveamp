import { describe, expect, it } from "vitest";
import { matchesWords, searchWords, stepIndex } from "../../../src/renderer/player/searchText";

describe("searchWords", () => {
  it("splits the query into lowercase words", () => {
    expect(searchWords("  Velvet   HARBOR ")).toEqual(["velvet", "harbor"]);
  });

  it("returns no words for a blank query", () => {
    expect(searchWords("   ")).toEqual([]);
  });

  it("treats ё as е", () => {
    expect(searchWords("Ёлка")).toEqual(["елка"]);
  });
});

describe("matchesWords", () => {
  it("matches words in any order and case", () => {
    expect(matchesWords("Velvet Harbor — Half Moon Bay", searchWords("moon velvet"))).toBe(true);
  });

  it("needs every word", () => {
    expect(matchesWords("Velvet Harbor — Slow Tide", searchWords("velvet moon"))).toBe(false);
  });

  it("matches parts of words", () => {
    expect(matchesWords("Lumen Drift — Moonlit Avenue", searchWords("moon"))).toBe(true);
  });

  it("ignores the difference between ё and е", () => {
    expect(matchesWords("Ёжик в тумане", searchWords("ежик"))).toBe(true);
    expect(matchesWords("Ежик в тумане", searchWords("ёжик"))).toBe(true);
  });
});

describe("stepIndex", () => {
  it("wraps forwards and backwards", () => {
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
    expect(stepIndex(0, 3, 1)).toBe(1);
  });

  it("returns -1 without matches", () => {
    expect(stepIndex(-1, 0, 1)).toBe(-1);
  });
});
