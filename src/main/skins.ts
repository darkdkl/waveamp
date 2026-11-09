import { app, shell } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import { writeLog } from "./logging";
import { sendToMainWindow } from "./windows";
import { errorMessage } from "../shared/errors";
import {
  SKIN_ARCHIVE_EXTENSION,
  SKIN_ARCHIVE_MAX_BYTES,
  openSkinArchive,
  skinAssetFiles,
  skinAssetProblem,
  type SkinRefusal,
} from "../shared/skinArchive";
import {
  DEFAULT_SKIN_ID,
  SKIN_BUTTON_STATES,
  SKIN_FILE,
  SKIN_IMAGE_TYPES,
  isSkinId,
  parseSkin,
  skinAssetExtension,
  skinEntries,
  type LoadedSkin,
  type SkinAssets,
  type SkinButton,
  type SkinData,
  type SkinInfo,
} from "../shared/skin";

const BUILTIN_SKIN_DIR = path.join(app.getAppPath(), "assets", "skins", DEFAULT_SKIN_ID);
const SKINS_DIR = path.join(app.getPath("userData"), "skins");
const WATCH_DELAY_MS = 300;

interface SkinSource {
  read(files: string[]): Promise<Map<string, Uint8Array>>;
}

type OpenedSkin = { ok: true; skin: SkinData; source: SkinSource } | { ok: false; info: SkinInfo };

const listed = new Map<string, { stamp: string; info: SkinInfo }>();

function isArchiveName(name: string): boolean {
  return name.toLowerCase().endsWith(`.${SKIN_ARCHIVE_EXTENSION}`);
}

function folderSource(dir: string): SkinSource {
  return {
    read: async (files) => new Map(await Promise.all(files.map(async (file) => [file, new Uint8Array(await fs.readFile(path.join(dir, file)))] as const))),
  };
}

function broken(detail: string): SkinRefusal {
  return { problem: { kind: "broken" }, detail };
}

async function openArchive(file: string): Promise<{ source: SkinSource; sizes: Map<string, number> } | SkinRefusal> {
  const stat = await fs.lstat(file);
  if (!stat.isFile()) return broken("a skin has to be a real .waveskin file");
  if (stat.size > SKIN_ARCHIVE_MAX_BYTES) return { problem: { kind: "tooLarge", size: stat.size, max: SKIN_ARCHIVE_MAX_BYTES } };
  const opened = openSkinArchive(new Uint8Array(await fs.readFile(file)));
  if (!opened.ok) return opened;
  const { archive } = opened;
  return { sizes: archive.sizes, source: { read: async (files) => archive.read(files) } };
}

function skinFile(id: string): string | null {
  if (!isSkinId(id) || !isArchiveName(id)) return null;
  const target = path.join(SKINS_DIR, id);
  return path.dirname(target) === SKINS_DIR ? target : null;
}

function info({ id, name, author, version, builtIn }: SkinData): SkinInfo {
  return { id, name, author, version, builtIn };
}

function rejected(id: string, { problem, detail }: SkinRefusal, name = ""): OpenedSkin {
  writeLog("warn", "skins", `"${id}" refused: ${detail ?? JSON.stringify(problem)}`);
  return { ok: false, info: { id, name: name || id.replace(/\.[^.]+$/, ""), author: "", version: "", builtIn: id === DEFAULT_SKIN_ID, problem } };
}

async function openSkin(id: string): Promise<OpenedSkin> {
  try {
    let source = folderSource(BUILTIN_SKIN_DIR);
    let sizes: Map<string, number> | null = null;
    if (id !== DEFAULT_SKIN_ID) {
      const file = skinFile(id);
      if (!file) return rejected(id, broken("not a skin file name"));
      const archive = await openArchive(file);
      if ("problem" in archive) return rejected(id, archive);
      ({ source, sizes } = archive);
    }
    const manifest = (await source.read([SKIN_FILE])).get(SKIN_FILE)!;
    const result = parseSkin(id, JSON.parse(new TextDecoder().decode(manifest)), id === DEFAULT_SKIN_ID);
    if (!result.ok) return rejected(id, { problem: result.problem, detail: result.error }, result.name);
    const problem = sizes && skinAssetProblem(result.skin.assets, sizes);
    if (problem) return rejected(id, { problem }, result.skin.name);
    return { ok: true, skin: result.skin, source };
  } catch (err) {
    return rejected(id, broken(errorMessage(err)));
  }
}

async function listedInfo(id: string): Promise<SkinInfo> {
  const stat = id === DEFAULT_SKIN_ID ? null : await fs.lstat(path.join(SKINS_DIR, id)).catch(() => null);
  const stamp = stat ? `${stat.ino}:${stat.size}:${stat.mtimeMs}` : "";
  const cached = listed.get(id);
  if (cached?.stamp === stamp) return cached.info;
  const opened = await openSkin(id);
  const result = opened.ok ? info(opened.skin) : opened.info;
  listed.set(id, { stamp, info: result });
  return result;
}

export async function listSkins(): Promise<SkinInfo[]> {
  let names: string[] = [];
  try {
    names = (await fs.readdir(SKINS_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && isArchiveName(entry.name))
      .map((entry) => entry.name)
      .filter(isSkinId);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") writeLog("warn", "skins", `Cannot read skins: ${errorMessage(err)}`);
  }
  const ids = [DEFAULT_SKIN_ID, ...names];
  for (const id of listed.keys()) if (!ids.includes(id)) listed.delete(id);
  const [builtIn, ...skins] = await Promise.all(ids.map(listedInfo));
  return [builtIn, ...skins.sort((a, b) => a.name.localeCompare(b.name))];
}

function dataUrl(relative: string, data: Uint8Array): string {
  return `data:${SKIN_IMAGE_TYPES[skinAssetExtension(relative)]};base64,${Buffer.from(data).toString("base64")}`;
}

function buildAssets(skin: SkinData, files: Map<string, Uint8Array>): SkinAssets {
  const loaded: SkinAssets = { sources: [], images: {}, icons: {}, fonts: {}, buttons: {} };
  const sources = new Map<string, number>();
  const imageSource = (relative: string): number => {
    if (!sources.has(relative)) sources.set(relative, loaded.sources.push(dataUrl(relative, files.get(relative)!)) - 1);
    return sources.get(relative)!;
  };
  for (const [slot, ref] of skinEntries(skin.assets.images)) {
    loaded.images[slot] = { source: imageSource(ref.path), slice: ref.slice, width: ref.width, repeat: ref.repeat };
  }
  for (const [slot, relative] of skinEntries(skin.assets.icons)) loaded.icons[slot] = dataUrl(relative, files.get(relative)!);
  for (const [slot, relative] of skinEntries(skin.assets.fonts)) loaded.fonts[slot] = new Uint8Array(files.get(relative)!);
  for (const [slot, ref] of skinEntries(skin.assets.buttons)) {
    const button: SkinButton = { normal: { source: imageSource(ref.normal.path), slice: ref.normal.slice, width: ref.normal.width, repeat: false } };
    for (const state of SKIN_BUTTON_STATES) {
      const path = ref[state];
      if (path) button[state] = imageSource(path);
    }
    loaded.buttons[slot] = button;
  }
  return loaded;
}

export async function readSkin(id: string): Promise<LoadedSkin | null> {
  const opened = await openSkin(id);
  if (!opened.ok) return null;
  try {
    const files = await opened.source.read([...skinAssetFiles(opened.skin.assets).keys()]);
    return { ...opened.skin, assets: buildAssets(opened.skin, files) };
  } catch (err) {
    writeLog("warn", "skins", `"${id}": ${errorMessage(err)}`);
    return null;
  }
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
  if (!filename) changedSkins = null;
  else changedSkins?.add(filename);
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
    watcher = watch(SKINS_DIR, (_event, filename) => noteChange(filename));
    watcher.on("error", (err) => {
      writeLog("warn", "skins", `Stopped watching skins: ${errorMessage(err)}`);
      watcher?.close();
      watcher = null;
    });
  } catch (err) {
    writeLog("warn", "skins", `Cannot watch skins: ${errorMessage(err)}`);
  }
}
