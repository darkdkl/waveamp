import { app, shell } from "electron";
import { unzipSync } from "fflate";
import path from "node:path";
import fs from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import { writeLog } from "./logging";
import { sendToMainWindow } from "./windows";
import { errorMessage } from "../shared/errors";
import { SKIN_ARCHIVE_EXTENSION, SKIN_ARCHIVE_MAX_BYTES, planSkinArchive, type ArchiveEntry } from "../shared/skinArchive";
import {
  DEFAULT_SKIN_ID,
  SKIN_ASSETS_MAX_BYTES,
  SKIN_FILE,
  SKIN_FILE_MAX_BYTES,
  SKIN_FONT_MAX_BYTES,
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
const WATCH_DELAY_MS = 300;

interface SkinSource {
  read(relative: string, maxBytes: number): Promise<Uint8Array | null>;
}

function isArchiveName(name: string): boolean {
  return name.toLowerCase().endsWith(`.${SKIN_ARCHIVE_EXTENSION}`);
}

function folderSource(dir: string, confined: boolean): SkinSource {
  const root = path.resolve(dir);
  return {
    async read(relative, maxBytes) {
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) return null;
      const base = confined ? await fs.realpath(root) : root;
      const real = confined ? await fs.realpath(file).catch(() => null) : file;
      if (!real?.startsWith(base + path.sep)) return null;
      const stat = await fs.stat(real).catch(() => null);
      if (!stat?.isFile() || stat.size > maxBytes) return null;
      return new Uint8Array(await fs.readFile(real));
    },
  };
}

function entryName(name: string): string {
  return name.replace(/\\/g, "/");
}

function listArchive(data: Uint8Array): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  unzipSync(data, {
    filter: (file) => {
      entries.push({ name: entryName(file.name), size: file.originalSize });
      return false;
    },
  });
  return entries;
}

async function archiveSource(file: string, id: string): Promise<SkinSource | null> {
  const stat = await fs.stat(file);
  if (stat.size > SKIN_ARCHIVE_MAX_BYTES) {
    writeLog("warn", "skins", `"${id}" is larger than ${SKIN_ARCHIVE_MAX_BYTES} bytes`);
    return null;
  }
  const data = new Uint8Array(await fs.readFile(file));
  const entries = listArchive(data);
  const plan = planSkinArchive(entries);
  if (!plan.ok) {
    writeLog("warn", "skins", `"${id}": archive refused (${plan.error})`);
    return null;
  }
  const sizes = new Map(entries.map((entry) => [entry.name, entry.size]));
  const files = new Set(plan.files);
  return {
    async read(relative, maxBytes) {
      const name = plan.root + relative;
      if (!files.has(relative) || (sizes.get(name) ?? Infinity) > maxBytes) return null;
      const [content] = Object.values(unzipSync(data, { filter: (entry) => entryName(entry.name) === name }));
      return content && content.length <= maxBytes ? content : null;
    },
  };
}

function skinPath(id: string): string | null {
  if (id === DEFAULT_SKIN_ID) return BUILTIN_SKIN_DIR;
  if (!isSkinId(id)) return null;
  const target = path.join(SKINS_DIR, id);
  return path.dirname(target) === SKINS_DIR ? target : null;
}

async function openSource(id: string): Promise<SkinSource | null> {
  const target = skinPath(id);
  if (!target) return null;
  if (id === DEFAULT_SKIN_ID) return folderSource(target, false);
  if ((await fs.lstat(target)).isSymbolicLink()) {
    writeLog("warn", "skins", `"${id}" is a link; a skin has to be a real folder or file`);
    return null;
  }
  return isArchiveName(id) ? archiveSource(target, id) : folderSource(target, true);
}

async function parseFrom(id: string, source: SkinSource): Promise<SkinData | null> {
  const manifest = await source.read(SKIN_FILE, SKIN_FILE_MAX_BYTES);
  if (!manifest) {
    writeLog("warn", "skins", `"${id}": no readable ${SKIN_FILE} up to ${SKIN_FILE_MAX_BYTES} bytes`);
    return null;
  }
  const result = parseSkin(id, JSON.parse(new TextDecoder().decode(manifest)), id === DEFAULT_SKIN_ID);
  if (result.ok) return result.skin;
  writeLog("warn", "skins", `"${id}": ${result.error}`);
  return null;
}

async function loadSkin(id: string): Promise<{ skin: SkinData; source: SkinSource } | null> {
  try {
    const source = await openSource(id);
    const skin = source && (await parseFrom(id, source));
    return skin && source ? { skin, source } : null;
  } catch (err) {
    writeLog("warn", "skins", `"${id}": ${errorMessage(err)}`);
    return null;
  }
}

function info({ id, name, author, version, builtIn }: SkinData): SkinInfo {
  return { id, name, author, version, builtIn };
}

export async function listSkins(): Promise<SkinInfo[]> {
  let names: string[] = [];
  try {
    names = (await fs.readdir(SKINS_DIR, { withFileTypes: true }))
      .filter((entry) => (entry.isDirectory() || (entry.isFile() && isArchiveName(entry.name))) && entry.name !== DEFAULT_SKIN_ID)
      .map((entry) => entry.name)
      .filter(isSkinId);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") writeLog("warn", "skins", `Cannot read skins: ${errorMessage(err)}`);
  }
  const loaded = await Promise.all([DEFAULT_SKIN_ID, ...names].map(loadSkin));
  const [builtIn, ...skins] = loaded.map((entry) => entry?.skin ?? null);
  const user = skins.filter((skin): skin is SkinData => !!skin).sort((a, b) => a.name.localeCompare(b.name));
  return [...(builtIn ? [builtIn] : []), ...user].map(info);
}

class AssetBudget {
  private used = 0;

  take(bytes: number): boolean {
    if (this.used + bytes > SKIN_ASSETS_MAX_BYTES) return false;
    this.used += bytes;
    return true;
  }
}

async function readAsset(id: string, source: SkinSource, relative: string, maxBytes: number, budget: AssetBudget): Promise<Buffer | null> {
  try {
    const data = await source.read(relative, maxBytes);
    if (data && budget.take(data.length)) return Buffer.from(data);
    writeLog("warn", "skins", `"${id}": ${relative} is missing or too large`);
  } catch (err) {
    writeLog("warn", "skins", `"${id}": ${relative}: ${errorMessage(err)}`);
  }
  return null;
}

function dataUrl(relative: string, data: Buffer): string {
  return `data:${SKIN_IMAGE_TYPES[skinAssetExtension(relative)]};base64,${data.toString("base64")}`;
}

async function loadAssets(skin: SkinData, source: SkinSource): Promise<SkinAssets> {
  const budget = new AssetBudget();
  const loaded: SkinAssets = { images: {}, icons: {}, fonts: {} };
  for (const [slot, ref] of skinEntries(skin.assets.images)) {
    const data = await readAsset(skin.id, source, ref.path, SKIN_IMAGE_MAX_BYTES, budget);
    if (data) loaded.images[slot] = { url: dataUrl(ref.path, data), slice: ref.slice, width: ref.width, repeat: ref.repeat };
  }
  for (const [slot, relative] of skinEntries(skin.assets.icons)) {
    const data = await readAsset(skin.id, source, relative, SKIN_ICON_MAX_BYTES, budget);
    if (data) loaded.icons[slot] = dataUrl(relative, data);
  }
  for (const [slot, relative] of skinEntries(skin.assets.fonts)) {
    const data = await readAsset(skin.id, source, relative, SKIN_FONT_MAX_BYTES, budget);
    if (data) loaded.fonts[slot] = new Uint8Array(data);
  }
  return loaded;
}

export async function readSkin(id: string): Promise<LoadedSkin | null> {
  const loaded = await loadSkin(id);
  return loaded ? { ...loaded.skin, assets: await loadAssets(loaded.skin, loaded.source) } : null;
}

export async function openSkinsFolder(): Promise<void> {
  await watchSkins();
  const error = await shell.openPath(SKINS_DIR);
  if (error) writeLog("warn", "skins", `Cannot open ${SKINS_DIR}: ${error}`);
}

let watcher: FSWatcher | null = null;
let watchTimer: ReturnType<typeof setTimeout> | undefined;
let changedSkins: Set<string> | null = new Set();

function noteChange(filename: string | null): void {
  const name = filename?.split(/[\\/]/)[0];
  if (!name) changedSkins = null;
  else changedSkins?.add(name);
  clearTimeout(watchTimer);
  watchTimer = setTimeout(() => {
    sendToMainWindow("skins-changed", changedSkins && [...changedSkins]);
    changedSkins = new Set();
  }, WATCH_DELAY_MS);
}

export async function watchSkins(): Promise<void> {
  watcher?.close();
  watcher = null;
  try {
    await fs.mkdir(SKINS_DIR, { recursive: true });
    watcher = watch(SKINS_DIR, { recursive: true }, (_event, filename) => noteChange(filename));
    watcher.on("error", (err) => {
      writeLog("warn", "skins", `Stopped watching skins: ${errorMessage(err)}`);
      watcher?.close();
      watcher = null;
    });
  } catch (err) {
    writeLog("warn", "skins", `Cannot watch skins: ${errorMessage(err)}`);
  }
}
