import { describe, expect, it } from "vitest";
import { SKIN_FONT_TYPES, SKIN_IMAGE_TYPES, isSkinAssetPath, isSkinColor, isSkinId, parseSkin } from "../../src/shared/skin";

const base = { format: 1, name: "Carbon", author: "Someone", version: "1.0" };

describe("parseSkin", () => {
  it("maps known keys to their CSS properties", () => {
    const result = parseSkin("carbon", { ...base, colors: { button: "#123456" }, visualizer: { peak: "#E06060" } }, false);
    expect(result).toMatchObject({
      ok: true,
      skin: {
        id: "carbon",
        name: "Carbon",
        author: "Someone",
        builtIn: false,
        tokens: [
          { property: "--skin-button", value: "#123456" },
          { property: "--viz-hot", value: "#e06060" },
        ],
        skipped: [],
      },
    });
  });

  it("takes only hex colors and reports the rest", () => {
    const result = parseSkin(
      "carbon",
      { ...base, colors: { nope: "#fff", button: "url(https://example.com/x.png)", chrome: "red", text: "rgb(1, 2, 3)", textMuted: "var(--accent)" } },
      false
    );
    expect(result.ok && result.skin.tokens).toEqual([]);
    expect(result.ok && result.skin.skipped).toEqual(["colors.button", "colors.chrome", "colors.text", "colors.textMuted"]);
  });

  it("ignores keys inherited from Object", () => {
    const json = JSON.parse('{"format":1,"name":"X","colors":{"constructor":"#fff","__proto__":"#fff","toString":"#fff"}}');
    const result = parseSkin("x", json, false);
    expect(result.ok && result.skin.tokens).toEqual([]);
    expect(result.ok && result.skin.skipped).toEqual([]);
  });

  it("builds shadows from numbers and a color", () => {
    const effects = {
      popupShadow: { x: 0, y: 6, blur: 16, color: "#00000066" },
      listInset: { y: 2, blur: 6, color: "#000" },
      displayInset: { x: 100, blur: -5, spread: 1, color: "#000" },
      knobShadow: false,
      pickerShadow: { y: "6", color: "#000" },
    };
    const result = parseSkin("carbon", { ...base, effects }, false);
    expect(result.ok && result.skin.tokens).toEqual([
      { property: "--skin-popup-shadow", value: "0px 6px 16px 0px #00000066" },
      { property: "--skin-list-inset", value: "inset 0px 2px 6px 0px #000" },
      { property: "--skin-display-inset", value: "inset 32px 0px 0px 1px #000" },
      { property: "--skin-knob-shadow", value: "none" },
    ]);
    expect(result.ok && result.skin.skipped).toEqual(["effects.pickerShadow"]);
  });

  it("builds the cover shade from color stops", () => {
    const shade = (coverShade: unknown) => parseSkin("x", { ...base, effects: { coverShade } }, false);
    expect(shade([{ color: "#060A08D9", at: 0 }, { color: "#060a0873", at: 100 }])).toMatchObject({
      skin: { tokens: [{ property: "--skin-cover-shade", value: "linear-gradient(90deg, #060a08d9 0%, #060a0873 100%)" }] },
    });
    for (const bad of [[{ color: "#000", at: 0 }], [{ color: "red", at: 0 }, { color: "#000", at: 100 }], [{ color: "#000" }, { color: "#000", at: 100 }], "linear-gradient(red, blue)"]) {
      expect(shade(bad)).toMatchObject({ skin: { tokens: [], skipped: ["effects.coverShade"] } });
    }
  });

  it("normalizes the accent", () => {
    expect(parseSkin("carbon", { ...base, accent: { hue: 400, saturation: 120 } }, false)).toMatchObject({ skin: { accent: { hue: 40, saturation: 100, tint: 0 } } });
    expect(parseSkin("carbon", { ...base, accent: { hue: "134", saturation: 96 } }, false)).toMatchObject({ skin: { accent: null } });
  });

  it("rejects a wrong format or a missing name", () => {
    expect(parseSkin("x", { ...base, format: 2 }, false).ok).toBe(false);
    expect(parseSkin("x", { ...base, format: "1" }, false).ok).toBe(false);
    expect(parseSkin("x", { ...base, name: "" }, false).ok).toBe(false);
    expect(parseSkin("x", [], false).ok).toBe(false);
  });
});

describe("isSkinId", () => {
  it("accepts names of entries in the skins folder", () => {
    expect(isSkinId("carbon-dark_2")).toBe(true);
    expect(isSkinId("Flat Walnut.waveskin")).toBe(true);
    expect(isSkinId("Ёлка")).toBe(true);
    expect(isSkinId("../etc")).toBe(false);
    expect(isSkinId("a\\b")).toBe(false);
    expect(isSkinId(".hidden")).toBe(false);
    expect(isSkinId("")).toBe(false);
    expect(isSkinId(7)).toBe(false);
  });
});

describe("isSkinColor", () => {
  it("accepts only hex colors", () => {
    for (const ok of ["#fff", "#ffff", "#a0B1c2", "#a0b1c2ff"]) expect(isSkinColor(ok)).toBe(true);
    for (const bad of ["fff", "#ff", "#fffff", "#ggg", "red", "rgb(0, 0, 0)", "var(--accent)", "#fff;", 42, null]) expect(isSkinColor(bad)).toBe(false);
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
    expect(result.ok && result.skin.skipped).toEqual(["images.body", "images.display", "images.button", "images.knob", "icons.play", "icons.pause", "icons.stop", "fonts.display"]);
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

  it("refuses extensions named after Object members", () => {
    for (const name of ["f.constructor", "f.toString", "f.__proto__", "f.hasOwnProperty"]) {
      expect(isSkinAssetPath(name, SKIN_FONT_TYPES)).toBe(false);
      expect(isSkinAssetPath(name, SKIN_IMAGE_TYPES)).toBe(false);
    }
  });
});
