import { describe, expect, it } from "vitest";
import { loadScript, plain } from "../loadScript.js";

const { accentColor } = loadScript("theme.js").window;

describe("accentColor.normalize", () => {
  it("wraps hue into 0–359", () => {
    expect(accentColor.normalize({ hue: 370, saturation: 50, tint: 0 }).hue).toBe(10);
    expect(accentColor.normalize({ hue: -30, saturation: 50, tint: 0 }).hue).toBe(330);
    expect(accentColor.normalize({ hue: 359.6, saturation: 50, tint: 0 }).hue).toBe(0);
  });

  it("clamps saturation and tint to 0–100", () => {
    expect(plain(accentColor.normalize({ hue: 10, saturation: 150, tint: -5 }))).toEqual({
      hue: 10,
      saturation: 100,
      tint: 0,
    });
  });

  it("falls back to the default color for garbage", () => {
    expect(plain(accentColor.normalize(null))).toEqual(plain(accentColor.DEFAULT));
    expect(plain(accentColor.normalize({ hue: "red", saturation: "x" }))).toEqual(plain(accentColor.DEFAULT));
  });

  it("leaves presets unchanged", () => {
    for (const { hue, saturation, tint } of accentColor.PRESETS) {
      expect(plain(accentColor.normalize({ hue, saturation, tint }))).toEqual({ hue, saturation, tint });
    }
  });
});
