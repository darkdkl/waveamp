import { describe, expect, it } from "vitest";
import { EQ_PRESETS, EQ_PRESET_MAX_HEADROOM_DB, findEqPreset, presetGains, presetPreampDb } from "../../../src/renderer/player/eqPresets";
import { EQ_LAYOUTS } from "../../../src/shared/eqCurve";

describe("EQ presets", () => {
  it("have unique ids and a gain for every band within ±12 dB", () => {
    expect(new Set(EQ_PRESETS.map((p) => p.id)).size).toBe(EQ_PRESETS.length);
    for (const preset of EQ_PRESETS) {
      expect(preset.bands, preset.id).toHaveLength(EQ_LAYOUTS[10].frequencies.length);
      for (const db of preset.bands) expect(Math.abs(db), preset.id).toBeLessThanOrEqual(12);
    }
  });

  it("find presets by id", () => {
    expect(findEqPreset("rock")?.nameKey).toBe("eqPresetRock");
    expect(findEqPreset("custom")).toBeUndefined();
  });
});

describe("presetPreampDb", () => {
  it("is zero for presets without boosts", () => {
    expect(presetPreampDb([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
    expect(Object.is(presetPreampDb([-5, -5, 0, 0, 0, 0, 0, 0, 0, 0]), 0)).toBe(true);
  });

  it("lowers the preamp by at most 1 dB for presets with boosts", () => {
    expect(EQ_PRESET_MAX_HEADROOM_DB).toBe(1);
    expect(presetPreampDb([0, 1, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(-1);
    expect(presetPreampDb([0, 10, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(-1);
  });
});

describe("presetGains", () => {
  it("keeps the 10-band values as they are", () => {
    expect(presetGains(findEqPreset("rock")!, 10)).toEqual([5, 3, -4, -5, -3, 2, 5, 7, 7, 7]);
  });

  it("reads the preset curve at the 19 band frequencies", () => {
    expect(presetGains(findEqPreset("rock")!, 19)).toEqual([5, 5, 5, 4, 4, 2, -2, -4, -5, -4, -3, -1, 0, 2, 3, 5, 6, 7, 7]);
    expect(presetGains(findEqPreset("flat")!, 19)).toEqual(new Array(19).fill(0));
  });
});
