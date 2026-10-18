import { describe, expect, it } from "vitest";
import { parseGsettingsBool, parseMacSwipeDirection } from "../../src/main/scrollDirection";

describe("parseMacSwipeDirection", () => {
  it("treats a missing key as the macOS default, natural scrolling", () => {
    expect(parseMacSwipeDirection(null)).toBe(true);
  });

  it("reads the stored flag", () => {
    expect(parseMacSwipeDirection("1")).toBe(true);
    expect(parseMacSwipeDirection("0")).toBe(false);
  });
});

describe("parseGsettingsBool", () => {
  it("reads true and false", () => {
    expect(parseGsettingsBool("true")).toBe(true);
    expect(parseGsettingsBool("false")).toBe(false);
  });

  it("returns null when the key is unavailable", () => {
    expect(parseGsettingsBool(null)).toBeNull();
    expect(parseGsettingsBool("No such schema")).toBeNull();
  });
});
