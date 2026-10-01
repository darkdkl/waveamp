import { describe, expect, it } from "vitest";
import { EQ_BANDS, EQ_PRESETS, EQ_PRESET_MAX_HEADROOM_DB, findEqPreset, presetPreampDb } from "../../../src/renderer/player/eqPresets";

describe("EQ presets", () => {
  it("have unique ids and a gain for every band within ±12 dB", () => {
    expect(new Set(EQ_PRESETS.map((p) => p.id)).size).toBe(EQ_PRESETS.length);
    for (const preset of EQ_PRESETS) {
      expect(preset.bands, preset.id).toHaveLength(EQ_BANDS.length);
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

  it("lowers the preamp by the largest boost, at most by the headroom cap", () => {
    expect(presetPreampDb([0, 2, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(-2);
    expect(presetPreampDb([0, 10, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(-EQ_PRESET_MAX_HEADROOM_DB);
  });
});
