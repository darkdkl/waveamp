import { describe, expect, it } from "vitest";
import {
  PEAK_RISE_TAU_MS,
  SLOW_TAU_MS,
  SMOOTH_TAU_MS,
  followLevel,
  needlePosition,
  parseVizResponse,
  spectrumBinMap,
} from "../../../src/renderer/player/vizMath";

describe("followLevel", () => {
  it("moves toward the target with the smooth time constant", () => {
    const next = followLevel(0, 1, SMOOTH_TAU_MS, 300, "smooth");
    expect(next).toBeCloseTo(1 - Math.exp(-1));
  });

  it("moves toward the target with the slow time constant both ways", () => {
    expect(followLevel(0, 1, SLOW_TAU_MS, 300, "slow")).toBeCloseTo(1 - Math.exp(-1));
    expect(followLevel(1, 0, SLOW_TAU_MS, 300, "slow")).toBeCloseTo(Math.exp(-1));
  });

  it("rises fast and falls with the given time constant in peak mode", () => {
    expect(followLevel(0, 1, PEAK_RISE_TAU_MS * 5, 300, "peak")).toBeGreaterThan(0.99);
    expect(followLevel(1, 0, 300, 300, "peak")).toBeCloseTo(Math.exp(-1));
  });

  it("stays put when already at the target", () => {
    expect(followLevel(0.5, 0.5, 16, 300, "peak")).toBe(0.5);
  });
});

describe("parseVizResponse", () => {
  it("keeps known modes and falls back to medium", () => {
    expect(parseVizResponse("slow")).toBe("slow");
    expect(parseVizResponse("smooth")).toBe("smooth");
    expect(parseVizResponse("peak")).toBe("peak");
    expect(parseVizResponse("fast")).toBe("smooth");
  });
});

describe("needlePosition", () => {
  it("puts 0 VU at the red-zone start and caps the swing", () => {
    expect(needlePosition(3)).toBe(1);
    expect(needlePosition(0)).toBeCloseTo(10 ** (-3 / 20));
    expect(needlePosition(40)).toBe(1.05);
    expect(needlePosition(-Infinity)).toBe(0);
  });
});

describe("spectrumBinMap", () => {
  it("maps columns logarithmically onto analyser bins", () => {
    const map = spectrumBinMap(26, 128);
    expect(map).toHaveLength(26);
    expect(map[0]).toBe(1);
    expect(map[25]).toBe(127);
    for (let i = 1; i < map.length; i++) expect(map[i]).toBeGreaterThanOrEqual(map[i - 1]);
  });
});
