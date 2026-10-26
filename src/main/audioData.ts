import fs from "node:fs/promises";
import { openAlacFile, wavLayout, wavStream } from "./alac/wavStream";
import { loadMusicMetadata } from "./tags";
import { PLAYABLE_EXT_RE } from "../shared/cue";
import { MAX_ANALYSIS_SECONDS } from "../shared/chords";
import type { AudioDataResult } from "../shared/types";

const MAX_BYTES = 400 * 1024 * 1024;

async function collect(stream: ReadableStream<Uint8Array>, total: number): Promise<Uint8Array> {
  const out = new Uint8Array(total);
  const reader = stream.getReader();
  let offset = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value.subarray(0, Math.max(0, total - offset)), offset);
    offset += value.length;
  }
  return out.subarray(0, Math.min(offset, total));
}

async function tooLong(filePath: string): Promise<boolean> {
  const { parseFile } = await loadMusicMetadata();
  const { format } = await parseFile(filePath, { skipCovers: true, duration: false });
  return typeof format.duration === "number" && format.duration > MAX_ANALYSIS_SECONDS;
}

export async function readAudioData(filePath: string, alac: boolean): Promise<AudioDataResult> {
  if (!PLAYABLE_EXT_RE.test(filePath)) return { ok: false, error: "failed" };
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) return { ok: false, error: "failed" };
  if (await tooLong(filePath)) return { ok: false, error: "tooLong" };
  if (alac) {
    const opened = await openAlacFile(filePath);
    if (!opened) return { ok: false, error: "failed" };
    const total = wavLayout(opened.track).totalBytes;
    if (total > MAX_BYTES) {
      opened.close();
      return { ok: false, error: "tooLarge" };
    }
    return { ok: true, data: await collect(wavStream(opened.track, opened.source, 0, total - 1, opened.close, () => {}), total) };
  }
  if (stat.size > MAX_BYTES) return { ok: false, error: "tooLarge" };
  return { ok: true, data: await fs.readFile(filePath) };
}
