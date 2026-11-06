import { app, shell } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { writeLog } from "./logging";
import { errorMessage } from "../shared/errors";
import {
  DEFAULT_SKIN_ID,
  SKIN_FILE,
  SKIN_FILE_MAX_BYTES,
  isSkinId,
  parseSkin,
  type SkinData,
  type SkinInfo,
} from "../shared/skin";

const BUILTIN_SKIN_DIR = path.join(app.getAppPath(), "assets", "skins", DEFAULT_SKIN_ID);
const SKINS_DIR = path.join(app.getPath("userData"), "skins");

function skinDir(id: string): string {
  return id === DEFAULT_SKIN_ID ? BUILTIN_SKIN_DIR : path.join(SKINS_DIR, id);
}

async function loadSkin(id: string): Promise<SkinData | null> {
  if (!isSkinId(id)) return null;
  const file = path.join(skinDir(id), SKIN_FILE);
  try {
    const stat = await fs.stat(file);
    if (stat.size > SKIN_FILE_MAX_BYTES) {
      writeLog("warn", "skins", `"${id}": ${SKIN_FILE} is larger than ${SKIN_FILE_MAX_BYTES} bytes`);
      return null;
    }
    const result = parseSkin(id, JSON.parse(await fs.readFile(file, "utf-8")), id === DEFAULT_SKIN_ID);
    if (result.ok) return result.skin;
    writeLog("warn", "skins", `"${id}": ${result.error}`);
  } catch (err) {
    writeLog("warn", "skins", `"${id}": ${errorMessage(err)}`);
  }
  return null;
}

function info({ id, name, author, version, builtIn }: SkinData): SkinInfo {
  return { id, name, author, version, builtIn };
}

export async function listSkins(): Promise<SkinInfo[]> {
  const builtIn = await loadSkin(DEFAULT_SKIN_ID);
  let entries: string[] = [];
  try {
    entries = (await fs.readdir(SKINS_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name !== DEFAULT_SKIN_ID && isSkinId(entry.name))
      .map((entry) => entry.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") writeLog("warn", "skins", `Cannot read skins: ${errorMessage(err)}`);
  }
  const skins = (await Promise.all(entries.map(loadSkin))).filter((skin): skin is SkinData => !!skin);
  skins.sort((a, b) => a.name.localeCompare(b.name));
  return [...(builtIn ? [builtIn] : []), ...skins].map(info);
}

export function readSkin(id: string): Promise<SkinData | null> {
  return loadSkin(id);
}

export async function openSkinsFolder(): Promise<void> {
  await fs.mkdir(SKINS_DIR, { recursive: true });
  const error = await shell.openPath(SKINS_DIR);
  if (error) writeLog("warn", "skins", `Cannot open ${SKINS_DIR}: ${error}`);
}
