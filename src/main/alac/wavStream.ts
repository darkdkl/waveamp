import fs from "node:fs/promises";
import { AlacDecoder, type DecodedFrame } from "./decoder";
import { readAlacTrack, type AlacTrack, type ByteSource } from "./mp4";

const WAV_HEADER_BYTES = 44;
const TRACK_CACHE_LIMIT = 8;

export interface WavLayout {
  channels: number;
  bytesPerSample: number;
  blockAlign: number;
  dataBytes: number;
  totalBytes: number;
}

export function wavLayout(track: AlacTrack): WavLayout {
  const { numChannels, bitDepth } = track.config;
  const bytesPerSample = bitDepth === 16 ? 2 : bitDepth === 32 ? 4 : 3;
  const blockAlign = numChannels * bytesPerSample;
  const dataBytes = track.totalSamples * blockAlign;
  return { channels: numChannels, bytesPerSample, blockAlign, dataBytes, totalBytes: WAV_HEADER_BYTES + dataBytes };
}

export function wavHeader(track: AlacTrack): Uint8Array {
  const layout = wavLayout(track);
  const header = new Uint8Array(WAV_HEADER_BYTES);
  const view = new DataView(header.buffer);
  const ascii = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, Math.min(0xffffffff, layout.totalBytes - 8), true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, layout.channels, true);
  view.setUint32(24, track.config.sampleRate, true);
  view.setUint32(28, track.config.sampleRate * layout.blockAlign, true);
  view.setUint16(32, layout.blockAlign, true);
  view.setUint16(34, layout.bytesPerSample * 8, true);
  ascii(36, "data");
  view.setUint32(40, Math.min(0xffffffff, layout.dataBytes), true);
  return header;
}

export function interleave(frame: DecodedFrame, samples: number, bitDepth: number, layout: WavLayout): Uint8Array {
  const out = new Uint8Array(samples * layout.blockAlign);
  const view = new DataView(out.buffer);
  const available = Math.min(samples, frame.samples);
  const shift = bitDepth === 20 ? 4 : 0;
  for (let i = 0; i < available; i++) {
    for (let ch = 0; ch < layout.channels; ch++) {
      const offset = i * layout.blockAlign + ch * layout.bytesPerSample;
      const value = frame.channels[ch][i] << shift;
      if (layout.bytesPerSample === 2) view.setInt16(offset, value, true);
      else if (layout.bytesPerSample === 4) view.setInt32(offset, value, true);
      else {
        out[offset] = value & 0xff;
        out[offset + 1] = (value >> 8) & 0xff;
        out[offset + 2] = (value >> 16) & 0xff;
      }
    }
  }
  return out;
}

export function frameIndexForSample(track: AlacTrack, sample: number): number {
  let low = 0;
  let high = track.frameStarts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (track.frameStarts[mid] <= sample) low = mid;
    else high = mid - 1;
  }
  return low;
}

function frameSamples(track: AlacTrack, index: number): number {
  const next = index + 1 < track.frameStarts.length ? track.frameStarts[index + 1] : track.totalSamples;
  return next - track.frameStarts[index];
}

export function wavStream(
  track: AlacTrack,
  source: ByteSource,
  first: number,
  last: number,
  onClose: () => void,
  onFrameError: (err: Error) => void
): ReadableStream<Uint8Array> {
  const layout = wavLayout(track);
  const decoder = new AlacDecoder(track.config);
  let position = first;
  let frame = -1;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    onClose();
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (position > last) {
          controller.close();
          close();
          return;
        }
        if (position < WAV_HEADER_BYTES) {
          const header = wavHeader(track).subarray(position, Math.min(WAV_HEADER_BYTES, last + 1));
          position += header.length;
          controller.enqueue(header);
          return;
        }
        const dataPosition = position - WAV_HEADER_BYTES;
        const sample = Math.floor(dataPosition / layout.blockAlign);
        if (frame < 0) frame = frameIndexForSample(track, sample);
        if (frame >= track.frameStarts.length) {
          controller.close();
          close();
          return;
        }
        const count = frameSamples(track, frame);
        let decoded: DecodedFrame;
        try {
          decoded = decoder.decode(await source.read(track.frameOffsets[frame], track.frameSizes[frame]));
        } catch (err) {
          onFrameError(err as Error);
          decoded = { samples: 0, channels: [] };
        }
        const bytes = interleave(decoded, count, track.config.bitDepth, layout);
        const frameStartByte = track.frameStarts[frame] * layout.blockAlign;
        const from = dataPosition - frameStartByte;
        const to = Math.min(bytes.length, last + 1 - WAV_HEADER_BYTES - frameStartByte);
        frame += 1;
        position += to - from;
        controller.enqueue(bytes.subarray(from, to));
      } catch (err) {
        controller.error(err);
        close();
      }
    },
    cancel() {
      close();
    },
  });
}

interface CachedTrack {
  mtimeMs: number;
  size: number;
  track: AlacTrack | null;
}

const trackCache = new Map<string, CachedTrack>();

function fileSource(handle: fs.FileHandle, size: number): ByteSource {
  return {
    size,
    async read(offset, length) {
      const buffer = new Uint8Array(Math.max(0, Math.min(length, size - offset)));
      await handle.read(buffer, 0, buffer.length, offset);
      return buffer;
    },
  };
}

export async function openAlacFile(filePath: string): Promise<{ track: AlacTrack; source: ByteSource; close: () => void } | null> {
  const handle = await fs.open(filePath, "r");
  try {
    const stat = await handle.stat();
    const source = fileSource(handle, stat.size);
    let cached = trackCache.get(filePath);
    if (!cached || cached.mtimeMs !== stat.mtimeMs || cached.size !== stat.size) {
      cached = { mtimeMs: stat.mtimeMs, size: stat.size, track: await readAlacTrack(source) };
      trackCache.delete(filePath);
      trackCache.set(filePath, cached);
      if (trackCache.size > TRACK_CACHE_LIMIT) trackCache.delete(trackCache.keys().next().value as string);
    }
    if (!cached.track) {
      await handle.close();
      return null;
    }
    return { track: cached.track, source, close: () => void handle.close().catch(() => {}) };
  } catch (err) {
    await handle.close().catch(() => {});
    throw err;
  }
}

export function parseRange(header: string | null, total: number): { first: number; last: number } | null {
  if (!header) return { first: 0, last: total - 1 };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    return suffix > 0 ? { first: Math.max(0, total - suffix), last: total - 1 } : null;
  }
  const first = Number(match[1]);
  const last = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
  return first <= last && first < total ? { first, last } : null;
}
