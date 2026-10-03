import path from "node:path";

export const MAX_PRESET_FILES = 20_000;
export const MAX_PRESET_DEPTH = 6;

export function isPresetFile(name: string): boolean {
  return /\.milk$/i.test(name) && !name.startsWith(".");
}

export function presetDisplayName(filePath: string): string {
  return path.basename(filePath).replace(/\.milk$/i, "").replace(/\s+/g, " ").trim();
}
