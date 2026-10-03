import { app, dialog, type BrowserWindow } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { writeLog } from "./logging";
import { MAX_PRESET_DEPTH, MAX_PRESET_FILES, isPresetFile, presetDisplayName } from "./presetFiles";
import { errorMessage } from "../shared/errors";
import type { PresetInfo } from "../shared/types";

const BUILTIN_PRESETS_DIR = path.join(app.getAppPath(), "assets", "presets");

let presetPaths: string[] = [];

async function collectPresets(dir: string, depth: number, found: string[]): Promise<void> {
  if (depth > MAX_PRESET_DEPTH || found.length >= MAX_PRESET_FILES) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    writeLog("warn", "presets", `Cannot read "${dir}": ${errorMessage(err)}`);
    return;
  }
  for (const entry of entries) {
    if (found.length >= MAX_PRESET_FILES) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) await collectPresets(full, depth + 1, found);
    else if (entry.isFile() && isPresetFile(entry.name)) found.push(full);
  }
}

export async function listPresets(folder: string): Promise<PresetInfo[]> {
  const found: string[] = [];
  await collectPresets(BUILTIN_PRESETS_DIR, 0, found);
  const builtinCount = found.length;
  if (folder) await collectPresets(folder, 0, found);
  presetPaths = found;
  return found.map((file, index) => ({ name: presetDisplayName(file), builtin: index < builtinCount }));
}

export async function readPreset(index: number): Promise<string | null> {
  const file = presetPaths[index];
  if (!file) return null;
  try {
    return await fs.readFile(file, "latin1");
  } catch (err) {
    writeLog("warn", "presets", `Cannot read preset "${file}": ${errorMessage(err)}`);
    return null;
  }
}

export async function choosePresetFolder(parent: BrowserWindow | null): Promise<string | null> {
  const options = { properties: ["openDirectory" as const] };
  const result = await (parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options));
  return result.canceled ? null : (result.filePaths[0] ?? null);
}
