import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n, translations } from "../../src/renderer/i18n";
import { accentColor } from "../../src/renderer/theme";
import type { Lang } from "../../src/shared/types";

vi.stubGlobal("navigator", { platform: "Linux", userAgent: "" });
const { hotkeys } = await import("../../src/renderer/hotkeys");

const languages = Object.keys(translations);
const enKeys = Object.keys(translations.en);

function source(file: string): string {
  return readFileSync(new URL(`../../src/renderer/${file}`, import.meta.url), "utf8");
}

const rendererScripts = (readdirSync(new URL("../../src/renderer/", import.meta.url), { recursive: true }) as string[])
  .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
  .sort();

function matches(text: string, regex: RegExp): string[] {
  return [...text.matchAll(regex)].map((m) => m[1]);
}

describe("translations", () => {
  it("has Russian and English", () => {
    expect(languages.sort()).toEqual(["en", "ru"]);
  });

  it.each(languages)("%s has the same keys as English", (lang) => {
    expect(Object.keys(translations[lang as Lang]).sort()).toEqual([...enKeys].sort());
  });

  it.each(languages)("%s has no empty strings", (lang) => {
    const empty = Object.entries(translations[lang as Lang]).filter(([, value]) => typeof value !== "string" || !value.trim());
    expect(empty).toEqual([]);
  });
});

describe("i18n", () => {
  beforeAll(() => {
    vi.stubGlobal("document", { documentElement: {}, querySelectorAll: () => [] });
  });

  afterAll(() => {
    i18n.setLanguage("en");
    vi.unstubAllGlobals();
  });

  it("switches language and falls back to English for unknown ones", () => {
    i18n.setLanguage("ru");
    expect(i18n.getLanguage()).toBe("ru");
    expect(i18n.t("close")).toBe(translations.ru.close);
    i18n.setLanguage("de");
    expect(i18n.getLanguage()).toBe("en");
    expect(i18n.t("close")).toBe(translations.en.close);
  });

  it("returns the key itself when there is no translation", () => {
    expect(i18n.t("noSuchKey")).toBe("noSuchKey");
  });
});

describe("keys used by the UI exist", () => {
  it.each(["index.html", "settings.html"])("data-i18n attributes in %s", (file) => {
    const keys = matches(source(file), /data-i18n(?:-title|-aria|-placeholder)?="([^"]+)"/g);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  it("scans the renderer scripts", () => {
    expect(rendererScripts).toContain("settings.ts");
    expect(rendererScripts.some((file) => file.startsWith("player"))).toBe(true);
  });

  it.each(rendererScripts)('t("…") calls in %s', (file) => {
    const keys = matches(source(file), /\bt\("([A-Za-z0-9_]+)"\)/g);
    expect(keys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  it("finds t() calls across the renderer", () => {
    const total = rendererScripts.flatMap((file) => matches(source(file), /\bt\("([A-Za-z0-9_]+)"\)/g));
    expect(total.length).toBeGreaterThan(30);
  });

  it("hotkey action names", () => {
    expect(hotkeys.ACTIONS.map((a) => a.nameKey).filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  it("color preset names", () => {
    expect(accentColor.PRESETS.map((p) => p.nameKey).filter((key) => !enKeys.includes(key))).toEqual([]);
  });
});
