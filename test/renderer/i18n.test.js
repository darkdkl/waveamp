import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { loadScript } from "../loadScript.js";

const i18nContext = loadScript("i18n.js");
const translations = vm.runInContext("translations", i18nContext);
const languages = Object.keys(translations);
const enKeys = Object.keys(translations.en);

function source(file) {
  return readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
}

function matches(text, regex) {
  return [...text.matchAll(regex)].map((m) => m[1]);
}

describe("translations", () => {
  it("has Russian and English", () => {
    expect(languages.sort()).toEqual(["en", "ru"]);
  });

  it.each(languages)("%s has the same keys as English", (lang) => {
    expect(Object.keys(translations[lang]).sort()).toEqual([...enKeys].sort());
  });

  it.each(languages)("%s has no empty strings", (lang) => {
    const empty = Object.entries(translations[lang]).filter(([, value]) => typeof value !== "string" || !value.trim());
    expect(empty).toEqual([]);
  });

  it("falls back to English and then to the key", () => {
    expect(vm.runInContext('currentLang = "ru"; t("close")', i18nContext)).toBe(translations.ru.close);
    expect(vm.runInContext('currentLang = "de"; t("close")', i18nContext)).toBe(translations.en.close);
    expect(vm.runInContext('t("noSuchKey")', i18nContext)).toBe("noSuchKey");
  });
});

describe("keys used by the UI exist", () => {
  it.each(["index.html", "settings.html"])("data-i18n attributes in %s", (file) => {
    const keys = matches(source(file), /data-i18n(?:-title|-aria|-placeholder)?="([^"]+)"/g);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  it.each(["app.js", "settings.js"])("t(\"…\") calls in %s", (file) => {
    const keys = matches(source(file), /\bt\("([A-Za-z0-9_]+)"\)/g);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  it("hotkey action names", () => {
    const { hotkeys } = loadScript("hotkeys.js", { navigator: { platform: "Linux" } }).window;
    expect(hotkeys.ACTIONS.map((a) => a.nameKey).filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  it("color preset names", () => {
    const { accentColor } = loadScript("theme.js").window;
    expect(accentColor.PRESETS.map((p) => p.nameKey).filter((key) => !enKeys.includes(key))).toEqual([]);
  });
});
