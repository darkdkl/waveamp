import { describe, expect, it } from "vitest";
import {
  cascadeResponseDb,
  convertGains,
  curveAt,
  EQ_LAYOUTS,
  filterGainsFor,
  normalizeBandCount,
  peakingResponseDb,
} from "../../src/shared/eqCurve";
import { EQ_PRESETS } from "../../src/renderer/player/eqPresets";

const RATE = 48000;
const fine = EQ_LAYOUTS[19];

describe("EQ layouts", () => {
  it("place 19 bands half an octave apart from 31.5 Hz to 16 kHz", () => {
    expect(fine.frequencies).toHaveLength(19);
    expect(fine.labels).toHaveLength(19);
    expect(fine.frequencies[0]).toBeCloseTo(31.5);
    expect(fine.frequencies[18]).toBeCloseTo(16128, 0);
    fine.frequencies.slice(1).forEach((f, i) => expect(f / fine.frequencies[i]).toBeCloseTo(Math.SQRT2));
  });

  it("keep the classic 10 bands", () => {
    expect(EQ_LAYOUTS[10].frequencies).toEqual([60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000]);
    expect(EQ_LAYOUTS[10].q).toBe(1);
  });

  it("accept only 10 or 19 bands", () => {
    expect(normalizeBandCount(19)).toBe(19);
    expect(normalizeBandCount(10)).toBe(10);
    expect(normalizeBandCount("19")).toBe(10);
    expect(normalizeBandCount(undefined)).toBe(10);
  });
});

describe("curveAt", () => {
  const freqs = [100, 1000, 10000];
  const gains = [6, 0, -6];

  it("holds the end values outside the range", () => {
    expect(curveAt(freqs, gains, 20)).toBe(6);
    expect(curveAt(freqs, gains, 20000)).toBe(-6);
  });

  it("interpolates on a log frequency scale", () => {
    expect(curveAt(freqs, gains, Math.sqrt(100 * 1000))).toBeCloseTo(3);
    expect(curveAt(freqs, gains, 1000)).toBe(0);
  });
});

describe("convertGains", () => {
  it("copies gains for the same layout", () => {
    const gains = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(convertGains(gains, 10, 10)).toEqual(gains);
  });

  it("rounds the curve to whole decibels on the other layout", () => {
    const result = convertGains([5, 3, -4, -5, -3, 2, 5, 7, 7, 7], 10, 19);
    expect(result).toHaveLength(19);
    result.forEach((db) => expect(Number.isInteger(db)).toBe(true));
  });
});

describe("peakingResponseDb", () => {
  it("gives the set gain at the center and nothing at 0 dB", () => {
    expect(peakingResponseDb(1000, 6, 1.7, 1000, RATE)).toBeCloseTo(6, 5);
    expect(peakingResponseDb(1000, 0, 1.7, 3000, RATE)).toBeCloseTo(0, 10);
  });
});

describe("filterGainsFor", () => {
  const centersMatch = (sliders: number[], tolerance: number) => {
    const gains = filterGainsFor(fine, sliders, RATE);
    fine.frequencies.forEach((f, i) => expect(Math.abs(cascadeResponseDb(fine, gains, f, RATE) - sliders[i])).toBeLessThan(tolerance));
  };

  it("leaves a flat curve flat", () => {
    expect(filterGainsFor(fine, new Array(19).fill(0), RATE).every((db) => Math.abs(db) < 1e-9)).toBe(true);
  });

  it("makes the sound follow the sliders where overlapping bands would add up", () => {
    const sliders = new Array(19).fill(6);
    const naive = cascadeResponseDb(fine, sliders, 1000, RATE);
    expect(naive).toBeGreaterThan(9);
    centersMatch(sliders, 0.3);
  });

  it("follows every built-in preset", () => {
    for (const preset of EQ_PRESETS) centersMatch(convertGains(preset.bands, 10, 19), 0.3);
  });
});
