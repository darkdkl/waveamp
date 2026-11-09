import type { AccentColor } from "./types";

export const SKIN_FORMAT = 1;
export const DEFAULT_SKIN_ID = "default";
export const SKIN_FILE = "skin.json";
export const SKIN_FILE_MAX_BYTES = 64 * 1024;

const TEXT_MAX_LENGTH = 60;
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const SHADOW_OFFSET_MAX = 32;
const SHADOW_BLUR_MAX = 64;
const GRADIENT_STOPS_MAX = 8;

type SkinValueKind = "color" | "shadow" | "insetShadow" | "gradient";

export interface SkinToken {
  property: string;
  value: string;
}

export type SkinProblem =
  | { kind: "tooLarge"; size: number; max: number }
  | { kind: "tooManyFiles"; count: number; max: number }
  | { kind: "fileTooLarge"; file: string; size: number; max: number }
  | { kind: "missing"; file: string }
  | { kind: "newerFormat" }
  | { kind: "broken" };

export interface PickedSkin {
  name: string;
  problem?: SkinProblem;
  replaces: boolean;
}

export interface SkinInfo {
  id: string;
  name: string;
  author: string;
  version: string;
  builtIn: boolean;
  problem?: SkinProblem;
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
export const SKIN_BUTTON_SLOTS = [
  "previous",
  "play",
  "pause",
  "stop",
  "next",
  "eq",
  "radio",
  "playlist",
  "chords",
  "reset",
  "popout",
  "search",
  "folder",
  "filter",
  "add",
  "favorites",
  "saved",
  "more",
] as const;
export const SKIN_BUTTON_STATES = ["hover", "pressed", "on"] as const;

export type SkinImageSlot = (typeof SKIN_IMAGE_SLOTS)[number];
export type SkinIconSlot = (typeof SKIN_ICON_SLOTS)[number];
export type SkinFontSlot = (typeof SKIN_FONT_SLOTS)[number];
export type SkinButtonSlot = (typeof SKIN_BUTTON_SLOTS)[number];
export type SkinButtonState = (typeof SKIN_BUTTON_STATES)[number];

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

export const SKIN_IMAGE_MAX_BYTES = Math.floor(1.4 * 1024 * 1024);
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
  source: number;
}

export interface SkinButtonRef extends Partial<Record<SkinButtonState, string>> {
  normal: SkinImageRef;
}

export interface SkinButton extends Partial<Record<SkinButtonState, number>> {
  normal: SkinImage;
}

export interface SkinAssetRefs {
  images: Partial<Record<SkinImageSlot, SkinImageRef>>;
  icons: Partial<Record<SkinIconSlot, string>>;
  fonts: Partial<Record<SkinFontSlot, string>>;
  buttons: Partial<Record<SkinButtonSlot, SkinButtonRef>>;
}

export interface SkinAssets {
  sources: string[];
  images: Partial<Record<SkinImageSlot, SkinImage>>;
  icons: Partial<Record<SkinIconSlot, string>>;
  fonts: Partial<Record<SkinFontSlot, Uint8Array<ArrayBuffer>>>;
  buttons: Partial<Record<SkinButtonSlot, SkinButton>>;
}

export interface SkinData extends SkinInfo {
  accent: AccentColor | null;
  tokens: SkinToken[];
  skipped: string[];
  assets: SkinAssetRefs;
}

export interface LoadedSkin extends Omit<SkinData, "assets"> {
  assets: SkinAssets;
}

export function skinEntries<K extends string, V>(record: Partial<Record<K, V>>): [K, V][] {
  return Object.entries(record) as [K, V][];
}

export type SkinParseResult = { ok: true; skin: SkinData } | { ok: false; error: string; problem: SkinProblem; name: string };

type SkinSection = "colors" | "effects" | "visualizer";

const color = (property: string) => ({ property, kind: "color" as const });
const shadow = (property: string) => ({ property, kind: "shadow" as const });
const insetShadow = (property: string) => ({ property, kind: "insetShadow" as const });
const gradient = (property: string) => ({ property, kind: "gradient" as const });

export const SKIN_KEYS: Record<SkinSection, Record<string, { property: string; kind: SkinValueKind }>> = {
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
    listInset: insetShadow("--skin-list-inset"),
    displayInset: insetShadow("--skin-display-inset"),
    popupShadow: shadow("--skin-popup-shadow"),
    pickerShadow: shadow("--skin-picker-shadow"),
    coverShade: gradient("--skin-cover-shade"),
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
  return Object.hasOwn(types, skinAssetExtension(value));
}

function numberIn(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : null;
}

function bounded(value: unknown, max: number, fallback: number): number {
  return numberIn(value, 0, max) ?? fallback;
}

export function isSkinColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value);
}

function shadowValue(value: unknown, inset: boolean): string | null {
  if (value === false) return "none";
  if (!isRecord(value) || !isSkinColor(value.color)) return null;
  const x = numberIn(value.x ?? 0, -SHADOW_OFFSET_MAX, SHADOW_OFFSET_MAX);
  const y = numberIn(value.y ?? 0, -SHADOW_OFFSET_MAX, SHADOW_OFFSET_MAX);
  const blur = numberIn(value.blur ?? 0, 0, SHADOW_BLUR_MAX);
  const spread = numberIn(value.spread ?? 0, -SHADOW_OFFSET_MAX, SHADOW_OFFSET_MAX);
  if (x === null || y === null || blur === null || spread === null) return null;
  return `${inset ? "inset " : ""}${x}px ${y}px ${blur}px ${spread}px ${value.color.toLowerCase()}`;
}

function gradientStop(stop: unknown): string | null {
  if (!isRecord(stop) || !isSkinColor(stop.color)) return null;
  const at = numberIn(stop.at, 0, 100);
  return at === null ? null : `${stop.color.toLowerCase()} ${at}%`;
}

function gradientValue(value: unknown): string | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > GRADIENT_STOPS_MAX) return null;
  const stops = value.map(gradientStop);
  return stops.every((stop) => stop !== null) ? `linear-gradient(90deg, ${stops.join(", ")})` : null;
}

const SKIN_VALUES: Record<SkinValueKind, (value: unknown) => string | null> = {
  color: (value) => (isSkinColor(value) ? value.toLowerCase() : null),
  shadow: (value) => shadowValue(value, false),
  insetShadow: (value) => shadowValue(value, true),
  gradient: gradientValue,
};

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

function buttonRef(value: unknown, slot: SkinButtonSlot, skipped: string[]): SkinButtonRef | null {
  const normal = isRecord(value) ? imageRef(value.normal, "button") : null;
  if (!isRecord(value) || !normal) {
    skipped.push(`buttons.${slot}`);
    return null;
  }
  const ref: SkinButtonRef = { normal };
  for (const state of SKIN_BUTTON_STATES) {
    if (!Object.hasOwn(value, state)) continue;
    const path = imageRef(value[state], "button")?.path;
    if (path) ref[state] = path;
    else skipped.push(`buttons.${slot}.${state}`);
  }
  return ref;
}

function assets(json: Record<string, unknown>, skipped: string[]): SkinAssetRefs {
  const result: SkinAssetRefs = { images: {}, icons: {}, fonts: {}, buttons: {} };
  const images = isRecord(json.images) ? json.images : {};
  for (const slot of SKIN_IMAGE_SLOTS) {
    if (!Object.hasOwn(images, slot)) continue;
    const ref = imageRef(images[slot], slot);
    if (ref) result.images[slot] = ref;
    else skipped.push(`images.${slot}`);
  }
  const icons = isRecord(json.icons) ? json.icons : {};
  for (const slot of SKIN_ICON_SLOTS) {
    if (!Object.hasOwn(icons, slot)) continue;
    if (isSkinAssetPath(icons[slot], SKIN_IMAGE_TYPES)) result.icons[slot] = icons[slot];
    else skipped.push(`icons.${slot}`);
  }
  const fonts = isRecord(json.fonts) ? json.fonts : {};
  for (const slot of SKIN_FONT_SLOTS) {
    if (!Object.hasOwn(fonts, slot)) continue;
    if (isSkinAssetPath(fonts[slot], SKIN_FONT_TYPES)) result.fonts[slot] = fonts[slot];
    else skipped.push(`fonts.${slot}`);
  }
  const buttons = isRecord(json.buttons) ? json.buttons : {};
  for (const slot of SKIN_BUTTON_SLOTS) {
    if (!Object.hasOwn(buttons, slot)) continue;
    const ref = buttonRef(buttons[slot], slot, skipped);
    if (ref) result.buttons[slot] = ref;
  }
  return result;
}

export function isSkinId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 255 && !id.startsWith(".") && !/[\\/\0]/.test(id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, TEXT_MAX_LENGTH) : "";
}

function accent(value: unknown): AccentColor | null {
  if (!isRecord(value)) return null;
  const hue = numberIn(value.hue, -Infinity, Infinity);
  const saturation = numberIn(value.saturation, 0, 100);
  const tint = numberIn(value.tint ?? 0, 0, 100);
  if (hue === null || saturation === null || tint === null) return null;
  return { hue: ((hue % 360) + 360) % 360, saturation, tint };
}

export function parseSkin(id: string, json: unknown, builtIn: boolean): SkinParseResult {
  if (!isRecord(json)) return { ok: false, error: "skin.json is not an object", problem: { kind: "broken" }, name: "" };
  const name = text(json.name);
  if (typeof json.format === "number" && json.format > SKIN_FORMAT) {
    return { ok: false, error: `format ${json.format} is newer than ${SKIN_FORMAT}`, problem: { kind: "newerFormat" }, name };
  }
  if (json.format !== SKIN_FORMAT) return { ok: false, error: `unsupported format ${String(json.format)}`, problem: { kind: "broken" }, name };
  if (!name) return { ok: false, error: "skin has no name", problem: { kind: "broken" }, name };
  const tokens: SkinToken[] = [];
  const skipped: string[] = [];
  for (const section of Object.keys(SKIN_KEYS) as SkinSection[]) {
    const values = json[section];
    if (!isRecord(values)) continue;
    for (const [key, value] of Object.entries(values)) {
      if (!Object.hasOwn(SKIN_KEYS[section], key)) continue;
      const { property, kind } = SKIN_KEYS[section][key];
      const css = SKIN_VALUES[kind](value);
      if (css === null) skipped.push(`${section}.${key}`);
      else tokens.push({ property, value: css });
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
      skipped,
      assets: assets(json, skipped),
    },
  };
}
