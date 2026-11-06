import { SKIN_ASSETS_MAX_BYTES, SKIN_FILE, SKIN_FILE_MAX_BYTES } from "./skin";

export const SKIN_ARCHIVE_EXTENSION = "waveskin";
export const SKIN_ARCHIVE_MAX_BYTES = 16 * 1024 * 1024;
export const SKIN_ARCHIVE_MAX_FILES = 300;
export const SKIN_ARCHIVE_MAX_UNPACKED = SKIN_ASSETS_MAX_BYTES + SKIN_FILE_MAX_BYTES;

export interface ArchiveEntry {
  name: string;
  size: number;
}

export type ArchivePlan =
  | { ok: true; root: string; files: string[] }
  | { ok: false; error: "noSkin" | "tooLarge" | "tooManyFiles" | "badPath" };

export function isArchivePath(name: string): boolean {
  if (name.length === 0 || name.length > 240 || name.startsWith("/") || /[\\:\0]/.test(name)) return false;
  return name.split("/").every((part, index, parts) => (part !== "" || index === parts.length - 1) && part !== "." && part !== "..");
}

export function planSkinArchive(entries: ArchiveEntry[]): ArchivePlan {
  const files = entries.filter((entry) => !entry.name.endsWith("/"));
  if (files.length > SKIN_ARCHIVE_MAX_FILES) return { ok: false, error: "tooManyFiles" };
  if (files.some((entry) => !isArchivePath(entry.name))) return { ok: false, error: "badPath" };
  if (files.reduce((sum, entry) => sum + entry.size, 0) > SKIN_ARCHIVE_MAX_UNPACKED) return { ok: false, error: "tooLarge" };
  const names = files.map((entry) => entry.name).filter((name) => !name.startsWith("__MACOSX/") && !name.split("/").pop()!.startsWith("."));
  let root = "";
  if (!names.includes(SKIN_FILE)) {
    const tops = new Set(names.map((name) => name.split("/")[0]));
    const [top] = tops;
    if (tops.size !== 1 || !names.includes(`${top}/${SKIN_FILE}`)) return { ok: false, error: "noSkin" };
    root = `${top}/`;
  }
  return { ok: true, root, files: names.filter((name) => name.startsWith(root)).map((name) => name.slice(root.length)) };
}
