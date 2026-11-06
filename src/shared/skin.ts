import type { AccentColor } from "./types";

export const SKIN_FORMAT = 1;
export const DEFAULT_SKIN_ID = "default";
export const SKIN_FILE = "skin.json";
export const SKIN_FILE_MAX_BYTES = 64 * 1024;

const TEXT_MAX_LENGTH = 60;
const VALUE_MAX_LENGTH = 300;
const SKIN_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const FORBIDDEN_VALUE_RE = /url\s*\(|image-set\s*\(|image\s*\(|element\s*\(|[;{}<>\\]/i;

export type SkinTokenKind = "color" | "shadow" | "image";

export interface SkinToken {
  property: string;
  value: string;
  kind: SkinTokenKind;
}

export interface SkinInfo {
  id: string;
  name: string;
  author: string;
  version: string;
  builtIn: boolean;
}

export const SKIN_IMAGE_SLOTS = ["body", "display", "button", "buttonHover", "buttonPressed", "buttonOn", "knob"] as const;
export const SKIN_ICON_SLOTS = [
  "previous",
  "play",
  "pause",
  "stop",
  "next",
  "volume",
  "eq",
  "radio",
  "playlist",
  "chords",
  "settings",
  "reset",
  "search",
  "folder",
  "add",
  "favorites",
  "saved",
  "filter",
  "up",
  "down",
  "popout",
  "more",
] as const;
export const SKIN_FONT_SLOTS = ["display"] as const;

export type SkinImageSlot = (typeof SKIN_IMAGE_SLOTS)[number];
export type SkinIconSlot = (typeof SKIN_ICON_SLOTS)[number];
export type SkinFontSlot = (typeof SKIN_FONT_SLOTS)[number];

export const SKIN_IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
};
export const SKIN_FONT_TYPES: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

export const SKIN_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const SKIN_ICON_MAX_BYTES = 256 * 1024;
export const SKIN_FONT_MAX_BYTES = 2 * 1024 * 1024;
export const SKIN_ASSETS_MAX_BYTES = 8 * 1024 * 1024;

const SLICE_MAX = 256;
const WIDTH_MAX = 64;

export interface SkinImageRef {
  path: string;
  slice: number;
  width: number;
  repeat: boolean;
}

export interface SkinImage extends Omit<SkinImageRef, "path"> {
  url: string;
}

export interface SkinFont {
  data: string;
  type: string;
}

export interface SkinAssetRefs {
  images: Partial<Record<SkinImageSlot, SkinImageRef>>;
  icons: Partial<Record<SkinIconSlot, string>>;
  fonts: Partial<Record<SkinFontSlot, string>>;
}

export interface SkinAssets {
  images: Partial<Record<SkinImageSlot, SkinImage>>;
  icons: Partial<Record<SkinIconSlot, string>>;
  fonts: Partial<Record<SkinFontSlot, SkinFont>>;
}

export interface SkinData extends SkinInfo {
  accent: AccentColor | null;
  tokens: SkinToken[];
  assets: SkinAssetRefs;
}

export interface LoadedSkin extends Omit<SkinData, "assets"> {
  assets: SkinAssets;
}

export function skinEntries<K extends string, V>(record: Partial<Record<K, V>>): [K, V][] {
  return Object.entries(record) as [K, V][];
}

export type SkinParseResult = { ok: true; skin: SkinData } | { ok: false; error: string };

type SkinSection = "colors" | "effects" | "visualizer";

const color = (property: string) => ({ property, kind: "color" as const });
const shadow = (property: string) => ({ property, kind: "shadow" as const });
const image = (property: string) => ({ property, kind: "image" as const });

export const SKIN_KEYS: Record<SkinSection, Record<string, { property: string; kind: SkinTokenKind }>> = {
  colors: {
    chrome: color("--skin-chrome"),
    chromeDark: color("--skin-chrome-dark"),
    chromeEdge: color("--skin-chrome-edge"),
    button: color("--skin-button"),
    buttonHover: color("--skin-button-hover"),
    buttonActive: color("--skin-button-active"),
    well: color("--skin-well"),
    well2: color("--skin-well-2"),
    text: color("--skin-text"),
    text2: color("--skin-text-2"),
    textMuted: color("--skin-text-muted"),
    knob: color("--skin-knob"),
    knobShade: color("--skin-knob-shade"),
    knobHover: color("--skin-knob-hover"),
    outline: color("--skin-outline"),
    separator: color("--skin-separator"),
    rowHover: color("--skin-row-hover"),
    menuHover: color("--skin-menu-hover"),
    divider: color("--skin-divider"),
    listBackground: color("--skin-list-background"),
    selectedText: color("--skin-selected-text"),
    danger: color("--skin-danger"),
    dangerBackground: color("--skin-danger-background"),
    closeHover: color("--skin-close-hover"),
    errorText: color("--skin-error-text"),
    warning: color("--skin-warning"),
    warningEdge: color("--skin-warning-edge"),
    stageBackground: color("--skin-stage-background"),
    stageEdge: color("--skin-stage-edge"),
    stageBar: color("--skin-stage-bar"),
    stageText: color("--skin-stage-text"),
    stageButton: color("--skin-stage-button"),
    stageButtonText: color("--skin-stage-button-text"),
  },
  effects: {
    knobShadow: shadow("--skin-knob-shadow"),
    listInset: shadow("--skin-list-inset"),
    displayInset: shadow("--skin-display-inset"),
    popupShadow: shadow("--skin-popup-shadow"),
    pickerShadow: shadow("--skin-picker-shadow"),
    coverShade: image("--skin-cover-shade"),
  },
  visualizer: {
    foreground: color("--viz-fg"),
    dim: color("--viz-dim"),
    off: color("--viz-off"),
    glow: color("--viz-glow"),
    peak: color("--viz-hot"),
  },
};

export const SKIN_TOKEN_PROPERTIES: string[] = Object.values(SKIN_KEYS).flatMap((section) =>
  Object.values(section).map((entry) => entry.property)
);

export function skinAssetExtension(path: string): string {
  return path.slice(path.lastIndexOf(".") + 1).toLowerCase();
}

export function isSkinAssetPath(value: unknown, types: Record<string, string>): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return false;
  if (value.startsWith("/") || /[\\:]/.test(value)) return false;
  if (value.split("/").some((part) => part === "" || part === "." || part === "..")) return false;
  return skinAssetExtension(value) in types;
}

function bounded(value: unknown, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : fallback;
}

function imageRef(value: unknown, slot: SkinImageSlot): SkinImageRef | null {
  const entry = typeof value === "string" ? { src: value } : value;
  if (!isRecord(entry) || !isSkinAssetPath(entry.src, SKIN_IMAGE_TYPES)) return null;
  const slice = bounded(entry.slice, SLICE_MAX, 0);
  return {
    path: entry.src,
    slice,
    width: bounded(entry.width, WIDTH_MAX, Math.min(slice, WIDTH_MAX)),
    repeat: typeof entry.repeat === "boolean" ? entry.repeat : slot === "body" || slot === "display",
  };
}

function assets(json: Record<string, unknown>): SkinAssetRefs {
  const result: SkinAssetRefs = { images: {}, icons: {}, fonts: {} };
  const images = isRecord(json.images) ? json.images : {};
  for (const slot of SKIN_IMAGE_SLOTS) {
    const ref = imageRef(images[slot], slot);
    if (ref) result.images[slot] = ref;
  }
  const icons = isRecord(json.icons) ? json.icons : {};
  for (const slot of SKIN_ICON_SLOTS) {
    if (isSkinAssetPath(icons[slot], SKIN_IMAGE_TYPES)) result.icons[slot] = icons[slot] as string;
  }
  const fonts = isRecord(json.fonts) ? json.fonts : {};
  for (const slot of SKIN_FONT_SLOTS) {
    if (isSkinAssetPath(fonts[slot], SKIN_FONT_TYPES)) result.fonts[slot] = fonts[slot] as string;
  }
  return result;
}

export function isSkinId(id: string): boolean {
  return SKIN_ID_RE.test(id);
}

export function isSafeSkinValue(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= VALUE_MAX_LENGTH && !FORBIDDEN_VALUE_RE.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, TEXT_MAX_LENGTH) : "";
}

function accent(value: unknown): AccentColor | null {
  if (!isRecord(value)) return null;
  const hue = Number(value.hue);
  const saturation = Number(value.saturation);
  const tint = value.tint == null ? 0 : Number(value.tint);
  if (![hue, saturation, tint].every(Number.isFinite)) return null;
  return {
    hue: ((Math.round(hue) % 360) + 360) % 360,
    saturation: Math.min(100, Math.max(0, Math.round(saturation))),
    tint: Math.min(100, Math.max(0, Math.round(tint))),
  };
}

export function parseSkin(id: string, json: unknown, builtIn: boolean): SkinParseResult {
  if (!isRecord(json)) return { ok: false, error: "skin.json is not an object" };
  if (json.format !== SKIN_FORMAT) return { ok: false, error: `unsupported format ${String(json.format)}` };
  const name = text(json.name);
  if (!name) return { ok: false, error: "skin has no name" };
  const tokens: SkinToken[] = [];
  for (const section of Object.keys(SKIN_KEYS) as SkinSection[]) {
    const values = json[section];
    if (!isRecord(values)) continue;
    for (const [key, value] of Object.entries(values)) {
      const entry = SKIN_KEYS[section][key];
      if (entry && isSafeSkinValue(value)) tokens.push({ property: entry.property, value: value.trim(), kind: entry.kind });
    }
  }
  return {
    ok: true,
    skin: {
      id,
      name,
      author: text(json.author),
      version: text(json.version),
      builtIn,
      accent: accent(json.accent),
      tokens,
      assets: assets(json),
    },
  };
}
