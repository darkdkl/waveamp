import { describe, expect, it } from "vitest";
import type { AccentColor } from "../../src/shared/types";
import { accentColor } from "../../src/renderer/theme";

describe("accentColor.normalize", () => {
  it("wraps hue into 0–359", () => {
    expect(accentColor.normalize({ hue: 370, saturation: 50, tint: 0 }).hue).toBe(10);
    expect(accentColor.normalize({ hue: -30, saturation: 50, tint: 0 }).hue).toBe(330);
    expect(accentColor.normalize({ hue: 359.6, saturation: 50, tint: 0 }).hue).toBe(0);
  });

  it("clamps saturation and tint to 0–100", () => {
    expect(accentColor.normalize({ hue: 10, saturation: 150, tint: -5 })).toEqual({
      hue: 10,
      saturation: 100,
      tint: 0,
    });
  });

  it("falls back to the default color for garbage", () => {
    expect(accentColor.normalize(null)).toEqual(accentColor.DEFAULT);
    expect(accentColor.normalize({ hue: "red", saturation: "x" } as unknown as AccentColor)).toEqual(accentColor.DEFAULT);
  });

  it("leaves presets unchanged", () => {
    for (const { hue, saturation, tint } of accentColor.PRESETS) {
      expect(accentColor.normalize({ hue, saturation, tint })).toEqual({ hue, saturation, tint });
    }
  });
});
