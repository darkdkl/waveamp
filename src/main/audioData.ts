import fs from "node:fs/promises";
import { openAlacFile, wavLayout, wavStream } from "./alac/wavStream";
import { loadMusicMetadata } from "./tags";
import { PLAYABLE_EXT_RE } from "../shared/cue";
import { MAX_ANALYSIS_SECONDS } from "../shared/chords";
import { ANALYSIS_READABLE_RE, readAnalysisSamples, type SampleReader } from "./analysisAudio";
import type { AudioDataResult, AudioSegment } from "../shared/types";

const MAX_BYTES = 400 * 1024 * 1024;
const FAILED = { ok: false, error: "failed" } as const;
const TOO_LONG = { ok: false, error: "tooLong" } as const;

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

async function readEncoded(filePath: string, size: number, alac: boolean): Promise<AudioDataResult> {
  if (await tooLong(filePath)) return TOO_LONG;
  if (alac) {
    const opened = await openAlacFile(filePath);
    if (!opened) return FAILED;
    const total = wavLayout(opened.track).totalBytes;
    if (total > MAX_BYTES) {
      opened.close();
      return { ok: false, error: "tooLarge" };
    }
    return { ok: true, data: await collect(wavStream(opened.track, opened.source, 0, total - 1, opened.close, () => {}), total) };
  }
  if (size > MAX_BYTES) return { ok: false, error: "tooLarge" };
  return { ok: true, data: await fs.readFile(filePath) };
}

export function audioSegment(start: unknown, end: unknown): AudioSegment {
  const from = Number(start);
  const to = end == null ? null : Number(end);
  return {
    start: Number.isFinite(from) && from > 0 ? from : 0,
    end: to != null && Number.isFinite(to) && to > 0 ? to : null,
  };
}

export async function readAudioData(
  filePath: string,
  alac: boolean,
  segment: AudioSegment = { start: 0, end: null },
  readSamples: SampleReader = readAnalysisSamples
): Promise<AudioDataResult> {
  if (!PLAYABLE_EXT_RE.test(filePath)) return FAILED;
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) return FAILED;
  if (segment.end != null && segment.end - segment.start > MAX_ANALYSIS_SECONDS) return TOO_LONG;
  if (!alac && ANALYSIS_READABLE_RE.test(filePath)) {
    const samples = await readSamples(filePath, segment);
    if (samples) return samples;
  }
  return readEncoded(filePath, stat.size, alac);
}
