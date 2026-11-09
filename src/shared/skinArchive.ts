import { unzipSync } from "fflate";
import {
  SKIN_ASSETS_MAX_BYTES,
  SKIN_BUTTON_STATES,
  SKIN_FILE,
  SKIN_FILE_MAX_BYTES,
  SKIN_FONT_MAX_BYTES,
  SKIN_ICON_MAX_BYTES,
  SKIN_IMAGE_MAX_BYTES,
  skinEntries,
  type SkinAssetRefs,
  type SkinProblem,
} from "./skin";

export const SKIN_ARCHIVE_EXTENSION = "waveskin";
export const SKIN_ARCHIVE_MAX_BYTES = 16 * 1024 * 1024;
export const SKIN_ARCHIVE_MAX_FILES = 300;

export interface ArchiveEntry {
  name: string;
  size: number;
}

export interface SkinRefusal {
  problem: SkinProblem;
  detail?: string;
}

export type ArchivePlan = { ok: true; root: string; sizes: Map<string, number> } | ({ ok: false } & SkinRefusal);

export interface SkinArchive {
  sizes: Map<string, number>;
  read(files: string[]): Map<string, Uint8Array>;
}

export function isArchivePath(name: string): boolean {
  if (name.length === 0 || name.length > 240 || name.startsWith("/") || /[\\:\0]/.test(name)) return false;
  return name.split("/").every((part, index, parts) => (part !== "" || index === parts.length - 1) && part !== "." && part !== "..");
}

export function planSkinArchive(entries: ArchiveEntry[]): ArchivePlan {
  const files = entries.filter((entry) => !entry.name.endsWith("/"));
  if (files.length > SKIN_ARCHIVE_MAX_FILES) return { ok: false, problem: { kind: "tooManyFiles", count: files.length, max: SKIN_ARCHIVE_MAX_FILES } };
  if (files.some((entry) => !isArchivePath(entry.name))) return { ok: false, problem: { kind: "broken" }, detail: "unsafe file names" };
  if (new Set(files.map((entry) => entry.name)).size !== files.length) return { ok: false, problem: { kind: "broken" }, detail: "repeated file names" };
  const content = files.filter((entry) => !entry.name.startsWith("__MACOSX/") && !entry.name.split("/").pop()!.startsWith("."));
  const names = content.map((entry) => entry.name);
  let root = "";
  if (!names.includes(SKIN_FILE)) {
    const tops = new Set(names.map((name) => name.split("/")[0]));
    const [top] = tops;
    if (tops.size !== 1 || !names.includes(`${top}/${SKIN_FILE}`)) return { ok: false, problem: { kind: "broken" }, detail: `no ${SKIN_FILE}` };
    root = `${top}/`;
  }
  const sizes = new Map(content.filter((entry) => entry.name.startsWith(root)).map((entry) => [entry.name.slice(root.length), entry.size]));
  const manifest = sizes.get(SKIN_FILE)!;
  if (manifest > SKIN_FILE_MAX_BYTES) return { ok: false, problem: { kind: "fileTooLarge", file: SKIN_FILE, size: manifest, max: SKIN_FILE_MAX_BYTES } };
  const size = [...sizes.values()].reduce((sum, each) => sum + each, 0) - manifest;
  if (size > SKIN_ASSETS_MAX_BYTES) return { ok: false, problem: { kind: "tooLarge", size, max: SKIN_ASSETS_MAX_BYTES } };
  return { ok: true, root, sizes };
}

function entryName(name: string): string {
  return name.replace(/\\/g, "/");
}

export function openSkinArchive(data: Uint8Array): ({ ok: true; archive: SkinArchive }) | ({ ok: false } & SkinRefusal) {
  const entries: ArchiveEntry[] = [];
  unzipSync(data, {
    filter: (file) => {
      entries.push({ name: entryName(file.name), size: file.originalSize });
      return false;
    },
  });
  const plan = planSkinArchive(entries);
  if (!plan.ok) return plan;
  const { root, sizes } = plan;
  return {
    ok: true,
    archive: {
      sizes,
      read(files) {
        const wanted = new Set(files.map((file) => root + file));
        const unpacked = unzipSync(data, { filter: (entry) => wanted.has(entryName(entry.name)) });
        const result = new Map<string, Uint8Array>();
        for (const [name, content] of Object.entries(unpacked)) result.set(entryName(name).slice(root.length), content);
        for (const file of files) {
          const size = sizes.get(file);
          if (size === undefined || result.get(file)?.length !== size) throw new Error(`${file} cannot be unpacked`);
        }
        return result;
      },
    },
  };
}

export function skinAssetFiles(refs: SkinAssetRefs): Map<string, number> {
  const files = new Map<string, number>();
  for (const [file, max] of assetLimits(refs)) files.set(file, Math.min(max, files.get(file) ?? max));
  return files;
}

function assetLimits(refs: SkinAssetRefs): [string, number][] {
  return [
    ...skinEntries(refs.images).map(([, ref]): [string, number] => [ref.path, SKIN_IMAGE_MAX_BYTES]),
    ...skinEntries(refs.buttons).flatMap(([, ref]) =>
      [ref.normal.path, ...SKIN_BUTTON_STATES.map((state) => ref[state])]
        .filter((path): path is string => !!path)
        .map((path): [string, number] => [path, SKIN_IMAGE_MAX_BYTES])
    ),
    ...skinEntries(refs.icons).map(([, path]): [string, number] => [path, SKIN_ICON_MAX_BYTES]),
    ...skinEntries(refs.fonts).map(([, path]): [string, number] => [path, SKIN_FONT_MAX_BYTES]),
  ];
}

export function skinAssetProblem(refs: SkinAssetRefs, sizes: Map<string, number>): SkinProblem | null {
  for (const [file, max] of skinAssetFiles(refs)) {
    const size = sizes.get(file);
    if (size === undefined) return { kind: "missing", file };
    if (size > max) return { kind: "fileTooLarge", file, size, max };
  }
  return null;
}
