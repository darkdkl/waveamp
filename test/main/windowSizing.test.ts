import { describe, expect, it } from "vitest";
import { normalizeScalePercent, rescaledSize, scaledSize } from "../../src/main/windowSizing";

describe("normalizeScalePercent", () => {
  it("snaps to 10 % steps within 70–150", () => {
    expect(normalizeScalePercent(100)).toBe(100);
    expect(normalizeScalePercent(124)).toBe(120);
    expect(normalizeScalePercent(125)).toBe(130);
    expect(normalizeScalePercent(40)).toBe(70);
    expect(normalizeScalePercent(400)).toBe(150);
  });

  it("falls back to 100 % for missing values", () => {
    expect(normalizeScalePercent(undefined)).toBe(100);
    expect(normalizeScalePercent("120")).toBe(100);
  });
});

describe("window sizes", () => {
  const workArea = { width: 1000, height: 600 };

  it("scales a base size and fits it into the work area", () => {
    expect(scaledSize({ width: 378, height: 468 }, 100, workArea)).toEqual({ width: 378, height: 468 });
    expect(scaledSize({ width: 378, height: 468 }, 150, workArea)).toEqual({ width: 567, height: 600 });
  });

  it("rescales the current size by a ratio", () => {
    expect(rescaledSize({ width: 400, height: 500 }, 1.2, workArea)).toEqual({ width: 480, height: 600 });
    expect(rescaledSize({ width: 400, height: 500 }, 0.5, workArea)).toEqual({ width: 200, height: 250 });
  });
});
