import { app, shell } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { writeLog } from "./logging";
import { errorMessage } from "../shared/errors";
import {
  DEFAULT_SKIN_ID,
  SKIN_ASSETS_MAX_BYTES,
  SKIN_FILE,
  SKIN_FILE_MAX_BYTES,
  SKIN_FONT_MAX_BYTES,
  SKIN_FONT_TYPES,
  SKIN_ICON_MAX_BYTES,
  SKIN_IMAGE_MAX_BYTES,
  SKIN_IMAGE_TYPES,
  isSkinId,
  parseSkin,
  skinAssetExtension,
  skinEntries,
  type LoadedSkin,
  type SkinAssets,
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

class AssetBudget {
  private used = 0;

  take(bytes: number): boolean {
    if (this.used + bytes > SKIN_ASSETS_MAX_BYTES) return false;
    this.used += bytes;
    return true;
  }
}

async function readAsset(skin: SkinData, relative: string, maxBytes: number, budget: AssetBudget): Promise<Buffer | null> {
  const dir = path.resolve(skinDir(skin.id));
  const file = path.resolve(dir, relative);
  if (!file.startsWith(dir + path.sep)) return null;
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > maxBytes || !budget.take(stat.size)) {
      writeLog("warn", "skins", `"${skin.id}": ${relative} is missing or too large`);
      return null;
    }
    return await fs.readFile(file);
  } catch (err) {
    writeLog("warn", "skins", `"${skin.id}": ${relative}: ${errorMessage(err)}`);
    return null;
  }
}

function dataUrl(relative: string, data: Buffer): string {
  return `data:${SKIN_IMAGE_TYPES[skinAssetExtension(relative)]};base64,${data.toString("base64")}`;
}

async function loadAssets(skin: SkinData): Promise<SkinAssets> {
  const budget = new AssetBudget();
  const loaded: SkinAssets = { images: {}, icons: {}, fonts: {} };
  for (const [slot, ref] of skinEntries(skin.assets.images)) {
    const data = await readAsset(skin, ref.path, SKIN_IMAGE_MAX_BYTES, budget);
    if (data) loaded.images[slot] = { url: dataUrl(ref.path, data), slice: ref.slice, width: ref.width, repeat: ref.repeat };
  }
  for (const [slot, relative] of skinEntries(skin.assets.icons)) {
    const data = await readAsset(skin, relative, SKIN_ICON_MAX_BYTES, budget);
    if (data) loaded.icons[slot] = dataUrl(relative, data);
  }
  for (const [slot, relative] of skinEntries(skin.assets.fonts)) {
    const data = await readAsset(skin, relative, SKIN_FONT_MAX_BYTES, budget);
    if (data) loaded.fonts[slot] = { data: data.toString("base64"), type: SKIN_FONT_TYPES[skinAssetExtension(relative)] };
  }
  return loaded;
}

export async function readSkin(id: string): Promise<LoadedSkin | null> {
  const skin = await loadSkin(id);
  return skin ? { ...skin, assets: await loadAssets(skin) } : null;
}

export async function openSkinsFolder(): Promise<void> {
  await fs.mkdir(SKINS_DIR, { recursive: true });
  const error = await shell.openPath(SKINS_DIR);
  if (error) writeLog("warn", "skins", `Cannot open ${SKINS_DIR}: ${error}`);
}
