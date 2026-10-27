import fs from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import type { CodecFrame } from "codec-parser";
import { ANALYSIS_SAMPLE_RATE, MAX_ANALYSIS_SECONDS } from "../shared/chords";
import { Resampler, concatSamples, mixToMono } from "../shared/resample";
import type { AudioDataError, AudioDataResult, AudioSegment } from "../shared/types";

export type AnalysisSamples = Extract<AudioDataResult, { samples: Float32Array }> | { ok: false; error: Exclude<AudioDataError, "tooLarge"> };

export const ANALYSIS_READABLE_RE = /\.(flac|wav)$/i;

export type SampleReader = (filePath: string, segment: AudioSegment) => Promise<AnalysisSamples | null>;

const READ_CHUNK = 1 << 20;
const MIN_RATE = 1000;
const MAX_RATE = 768000;
const FAILED = { ok: false, error: "failed" } as const;
const TOO_LONG = { ok: false, error: "tooLong" } as const;

interface WavFormat {
  channels: number;
  sampleRate: number;
  bytesPerSample: number;
  float: boolean;
  dataStart: number;
  dataBytes: number;
}

const tag = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));

function validRate(rate: number): boolean {
  return rate >= MIN_RATE && rate <= MAX_RATE;
}

function sampleRange(segment: AudioSegment, rate: number, total: number): { from: number; to: number } {
  const from = Math.max(0, Math.round(segment.start * rate));
  const end = segment.end != null ? Math.round(segment.end * rate) : Infinity;
  return { from, to: total > 0 ? Math.min(end, total) : end };
}

function longerThanLimit(from: number, to: number, rate: number): boolean {
  return Number.isFinite(to) && (to - from) / rate > MAX_ANALYSIS_SECONDS;
}

class AnalysisOutput {
  private readonly resampler: Resampler;
  private readonly parts: Float32Array[] = [];
  private length = 0;

  constructor(rate: number) {
    this.resampler = new Resampler(rate, ANALYSIS_SAMPLE_RATE);
  }

  get tooLong(): boolean {
    return this.length > MAX_ANALYSIS_SECONDS * ANALYSIS_SAMPLE_RATE;
  }

  push(mono: Float32Array): void {
    this.add(this.resampler.push(mono));
  }

  finish(): Float32Array {
    this.add(this.resampler.flush());
    return concatSamples(this.parts);
  }

  private add(part: Float32Array): void {
    this.parts.push(part);
    this.length += part.length;
  }
}

async function flacStart(handle: FileHandle): Promise<number> {
  const id3 = new Uint8Array(10);
  await handle.read(id3, 0, id3.length, 0);
  if (String.fromCharCode(id3[0], id3[1], id3[2]) !== "ID3") return 0;
  const size = ((id3[6] & 0x7f) << 21) | ((id3[7] & 0x7f) << 14) | ((id3[8] & 0x7f) << 7) | (id3[9] & 0x7f);
  return 10 + size + (id3[5] & 0x10 ? 10 : 0);
}

async function readFlac(handle: FileHandle, segment: AudioSegment): Promise<AnalysisSamples | null> {
  const start = await flacStart(handle);
  const head = new Uint8Array(42);
  await handle.read(head, 0, head.length, start);
  if (tag(head, 0) !== "fLaC" || (head[4] & 0x7f) !== 0) return null;
  const info = new DataView(head.buffer, 8, 34);
  const blockSize = info.getUint16(2);
  const rate = info.getUint32(10) >>> 12;
  const total = Number(info.getBigUint64(10) & 0xfffffffffn);
  if (!validRate(rate) || !blockSize) return null;
  const { from, to } = sampleRange(segment, rate, total);
  if (longerThanLimit(from, to, rate)) return TOO_LONG;
  if (total > 0 && from >= total) return FAILED;

  const [{ FLACDecoder }, codecParser] = await Promise.all([import("@wasm-audio-decoders/flac"), import("codec-parser")]);
  const { default: CodecParser, frameNumber, sampleNumber } = codecParser;
  const decoder = new FLACDecoder();
  await decoder.ready;
  try {
    const streamInfo = head.slice();
    streamInfo[4] |= 0x80;
    await decoder.decodeFrames([streamInfo]);
    const parser = new CodecParser<CodecFrame>("audio/flac", { enableLogging: false });
    const output = new AnalysisOutput(rate);
    let finished = false;
    let parsed = 0;
    let used = 0;

    const decode = async (frames: Iterator<CodecFrame>): Promise<void> => {
      const selected: Uint8Array[] = [];
      let first = -1;
      for (const frame of frames as IterableIterator<CodecFrame>) {
        parsed++;
        const header = frame.header as unknown as Record<string, number | undefined>;
        const at = header[sampleNumber] ?? (header[frameNumber] ?? 0) * blockSize;
        if (at >= to) {
          finished = true;
          break;
        }
        if (at + frame.samples <= from) continue;
        if (first < 0) first = at;
        selected.push(frame.data);
      }
      if (!selected.length) return;
      used += selected.length;
      const decoded = await decoder.decodeFrames(selected);
      const begin = Math.max(0, from - first);
      const end = Math.min(decoded.samplesDecoded, to - first);
      if (end > begin) output.push(mixToMono(decoded.channelData, begin, end));
    };

    for (let position = start; !finished && !output.tooLong; ) {
      const chunk = new Uint8Array(READ_CHUNK);
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, position);
      if (!bytesRead) break;
      position += bytesRead;
      await decode(parser.parseChunk(chunk.subarray(0, bytesRead)));
    }
    if (!finished && !output.tooLong) await decode(parser.flush());
    if (output.tooLong) return TOO_LONG;
    const samples = output.finish();
    if (samples.length) return { ok: true, samples };
    return parsed > 0 && used === 0 ? FAILED : null;
  } finally {
    decoder.free();
  }
}

async function wavFormat(handle: FileHandle, size: number): Promise<WavFormat | null> {
  const riff = new Uint8Array(12);
  await handle.read(riff, 0, 12, 0);
  if (tag(riff, 0) !== "RIFF" || tag(riff, 8) !== "WAVE") return null;
  let format: Omit<WavFormat, "dataStart" | "dataBytes"> | null = null;
  const chunkHead = new Uint8Array(8);
  for (let offset = 12; offset + 8 <= size; ) {
    await handle.read(chunkHead, 0, 8, offset);
    const id = tag(chunkHead, 0);
    const length = new DataView(chunkHead.buffer).getUint32(4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      if (length < 16) return null;
      const fmt = new Uint8Array(Math.min(length, 40));
      await handle.read(fmt, 0, fmt.length, body);
      const view = new DataView(fmt.buffer);
      const code = view.getUint16(0, true);
      const kind = code === 0xfffe && fmt.length >= 26 ? view.getUint16(24, true) : code;
      const bits = view.getUint16(14, true);
      const channels = view.getUint16(2, true);
      const sampleRate = view.getUint32(4, true);
      const float = kind === 3 && bits === 32;
      if (!channels || !validRate(sampleRate) || !(float || (kind === 1 && [8, 16, 24, 32].includes(bits)))) return null;
      format = { channels, sampleRate, bytesPerSample: bits / 8, float };
    } else if (id === "data") {
      if (!format) return null;
      const dataBytes = length === 0 || length === 0xffffffff ? size - body : Math.min(length, size - body);
      return { ...format, dataStart: body, dataBytes };
    }
    offset = body + length + (length & 1);
  }
  return null;
}

function readSample(view: DataView, at: number, format: WavFormat): number {
  if (format.float) return view.getFloat32(at, true);
  switch (format.bytesPerSample) {
    case 1:
      return (view.getUint8(at) - 128) / 128;
    case 2:
      return view.getInt16(at, true) / 32768;
    case 3:
      return ((view.getInt8(at + 2) << 16) | (view.getUint8(at + 1) << 8) | view.getUint8(at)) / 8388608;
    default:
      return view.getInt32(at, true) / 2147483648;
  }
}

async function readWav(handle: FileHandle, format: WavFormat, segment: AudioSegment): Promise<AnalysisSamples> {
  const frameBytes = format.channels * format.bytesPerSample;
  const { from, to } = sampleRange(segment, format.sampleRate, Math.floor(format.dataBytes / frameBytes));
  if (longerThanLimit(from, to, format.sampleRate)) return TOO_LONG;
  const output = new AnalysisOutput(format.sampleRate);
  const framesPerChunk = Math.max(1, Math.floor(READ_CHUNK / frameBytes));
  const chunk = new Uint8Array(framesPerChunk * frameBytes);
  const view = new DataView(chunk.buffer);
  for (let frame = from; frame < to; frame += framesPerChunk) {
    const count = Math.min(framesPerChunk, to - frame);
    const { bytesRead } = await handle.read(chunk, 0, count * frameBytes, format.dataStart + frame * frameBytes);
    const frames = Math.floor(bytesRead / frameBytes);
    if (!frames) break;
    const mono = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      let sum = 0;
      for (let c = 0; c < format.channels; c++) sum += readSample(view, i * frameBytes + c * format.bytesPerSample, format);
      mono[i] = sum / format.channels;
    }
    output.push(mono);
    if (output.tooLong) return TOO_LONG;
  }
  const samples = output.finish();
  return samples.length ? { ok: true, samples } : FAILED;
}

export const readAnalysisSamples: SampleReader = async (filePath, segment) => {
  if (!ANALYSIS_READABLE_RE.test(filePath)) return null;
  const isFlac = /\.flac$/i.test(filePath);
  const handle = await fs.open(filePath, "r");
  try {
    if (isFlac) return await readFlac(handle, segment);
    const format = await wavFormat(handle, (await handle.stat()).size);
    return format ? await readWav(handle, format, segment) : null;
  } finally {
    await handle.close();
  }
};
