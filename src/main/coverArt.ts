import { nativeImage, type NativeImage } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { loadMusicMetadata } from "./tags";
import { findFolderCover, pickTagPicture } from "./coverFiles";

const COVER_MAX_SIZE = 320;
const CACHE_LIMIT = 40;
const cache = new Map<string, Promise<string | null>>();

function toDataUrl(image: NativeImage): string | null {
  if (image.isEmpty()) return null;
  const { width, height } = image.getSize();
  const scale = Math.min(1, COVER_MAX_SIZE / Math.max(width, height));
  const resized = scale < 1 ? image.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: "good" }) : image;
  return `data:image/jpeg;base64,${resized.toJPEG(85).toString("base64")}`;
}

async function readEmbeddedCover(filePath: string): Promise<string | null> {
  const { parseFile } = await loadMusicMetadata();
  const { common } = await parseFile(filePath, { duration: false });
  const picture = pickTagPicture(common.picture);
  return picture ? toDataUrl(nativeImage.createFromBuffer(Buffer.from(picture.data))) : null;
}

async function readFolderCover(filePath: string): Promise<string | null> {
  const dir = path.dirname(filePath);
  const name = findFolderCover(await fs.readdir(dir));
  return name ? toDataUrl(nativeImage.createFromPath(path.join(dir, name))) : null;
}

async function loadCoverArt(filePath: string): Promise<string | null> {
  const embedded = await readEmbeddedCover(filePath).catch(() => null);
  return embedded ?? (await readFolderCover(filePath).catch(() => null));
}

export function readCoverArt(filePath: string): Promise<string | null> {
  let pending = cache.get(filePath);
  if (!pending) {
    pending = loadCoverArt(filePath);
    cache.set(filePath, pending);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  }
  return pending;
}
