import { describe, expect, it } from "vitest";
import { SKIN_FONT_TYPES, SKIN_IMAGE_TYPES, isSafeSkinValue, isSkinAssetPath, isSkinId, parseSkin } from "../../src/shared/skin";

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

describe("skin assets", () => {
  it("reads image, icon and font slots", () => {
    const result = parseSkin(
      "brass",
      {
        ...base,
        images: { body: "img/body.png", button: { src: "img/button.png", slice: 12, width: 6 }, knob: { src: "img/knob.webp" } },
        icons: { play: "icons/play.svg", unknown: "icons/x.svg" },
        fonts: { display: "fonts/lcd.woff2" },
      },
      false
    );
    expect(result.ok && result.skin.assets).toEqual({
      images: {
        body: { path: "img/body.png", slice: 0, width: 0, repeat: true },
        button: { path: "img/button.png", slice: 12, width: 6, repeat: false },
        knob: { path: "img/knob.webp", slice: 0, width: 0, repeat: false },
      },
      icons: { play: "icons/play.svg" },
      fonts: { display: "fonts/lcd.woff2" },
    });
  });

  it("refuses paths outside the skin folder and unknown file types", () => {
    const result = parseSkin(
      "x",
      {
        ...base,
        images: { body: "../secret.png", display: "/etc/a.png", button: "C:/a.png", knob: "img/knob.gif" },
        icons: { play: "icons/./play.svg", pause: "icons//pause.svg", stop: "icons\\stop.svg" },
        fonts: { display: "fonts/lcd.exe" },
      },
      false
    );
    expect(result.ok && result.skin.assets).toEqual({ images: {}, icons: {}, fonts: {} });
  });

  it("bounds the nine-slice numbers", () => {
    const result = parseSkin("x", { ...base, images: { button: { src: "b.png", slice: 999, width: -3 } } }, false);
    expect(result.ok && result.skin.assets.images.button).toEqual({ path: "b.png", slice: 256, width: 0, repeat: false });
  });
});

describe("isSkinAssetPath", () => {
  it("accepts plain relative paths with a known extension", () => {
    expect(isSkinAssetPath("img/a.PNG", SKIN_IMAGE_TYPES)).toBe(true);
    expect(isSkinAssetPath("a.png", SKIN_FONT_TYPES)).toBe(false);
    expect(isSkinAssetPath("img/..hidden.png", SKIN_IMAGE_TYPES)).toBe(true);
    expect(isSkinAssetPath("img/../a.png", SKIN_IMAGE_TYPES)).toBe(false);
  });
});
