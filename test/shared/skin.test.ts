import { describe, expect, it } from "vitest";
import { isSafeSkinValue, isSkinId, parseSkin } from "../../src/shared/skin";

const base = { format: 1, name: "Carbon", author: "Someone", version: "1.0" };

describe("parseSkin", () => {
  it("maps known keys to their CSS properties", () => {
    const result = parseSkin("carbon", { ...base, colors: { button: "#123456" }, visualizer: { peak: "red" } }, false);
    expect(result).toMatchObject({
      ok: true,
      skin: {
        id: "carbon",
        name: "Carbon",
        author: "Someone",
        builtIn: false,
        tokens: [
          { property: "--skin-button", value: "#123456", kind: "color" },
          { property: "--viz-hot", value: "red", kind: "color" },
        ],
      },
    });
  });

  it("drops unknown keys and unsafe values", () => {
    const result = parseSkin(
      "carbon",
      { ...base, colors: { nope: "#fff", button: "url(https://example.com/x.png)", chrome: "red; color: blue" } },
      false
    );
    expect(result.ok && result.skin.tokens).toEqual([]);
  });

  it("keeps shadows and gradients with their kinds", () => {
    const result = parseSkin("carbon", { ...base, effects: { popupShadow: "0 1px 2px #000", coverShade: "linear-gradient(red, blue)" } }, false);
    expect(result.ok && result.skin.tokens.map((t) => t.kind)).toEqual(["shadow", "image"]);
  });

  it("normalizes the accent", () => {
    const result = parseSkin("carbon", { ...base, accent: { hue: 400, saturation: 120 } }, false);
    expect(result.ok && result.skin.accent).toEqual({ hue: 40, saturation: 100, tint: 0 });
  });

  it("rejects a wrong format or a missing name", () => {
    expect(parseSkin("x", { ...base, format: 2 }, false).ok).toBe(false);
    expect(parseSkin("x", { ...base, name: "" }, false).ok).toBe(false);
    expect(parseSkin("x", [], false).ok).toBe(false);
  });
});

describe("isSkinId", () => {
  it("accepts folder-like names only", () => {
    expect(isSkinId("carbon-dark_2")).toBe(true);
    expect(isSkinId("../etc")).toBe(false);
    expect(isSkinId(".hidden")).toBe(false);
    expect(isSkinId("")).toBe(false);
  });
});

describe("isSafeSkinValue", () => {
  it("refuses external resources and CSS breakouts", () => {
    expect(isSafeSkinValue("#fff")).toBe(true);
    expect(isSafeSkinValue("var(--accent)")).toBe(true);
    expect(isSafeSkinValue("URL(x)")).toBe(false);
    expect(isSafeSkinValue("image-set(a 1x)")).toBe(false);
    expect(isSafeSkinValue("red}body{")).toBe(false);
    expect(isSafeSkinValue(42)).toBe(false);
  });
});
