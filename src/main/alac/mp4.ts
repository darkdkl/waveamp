import { parseAlacConfig, type AlacConfig } from "./decoder";

export interface ByteSource {
  size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}

export interface AlacTrack {
  config: AlacConfig;
  totalSamples: number;
  frameOffsets: number[];
  frameSizes: number[];
  frameStarts: number[];
}

interface Box {
  type: string;
  start: number;
  end: number;
}

const MAX_MOOV_BYTES = 64 * 1024 * 1024;

function boxType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function* childBoxes(bytes: Uint8Array, start: number, end: number): Generator<Box> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) return;
      size = Number(view.getBigUint64(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) return;
    yield { type: boxType(bytes, offset + 4), start: offset + header, end: offset + size };
    offset += size;
  }
}

function findChild(bytes: Uint8Array, parent: Box, type: string): Box | null {
  for (const box of childBoxes(bytes, parent.start, parent.end)) if (box.type === type) return box;
  return null;
}

function findPath(bytes: Uint8Array, parent: Box, path: string[]): Box | null {
  let box: Box | null = parent;
  for (const type of path) {
    box = box && findChild(bytes, box, type);
  }
  return box;
}

function findAlacConfig(bytes: Uint8Array, stsd: Box): Uint8Array | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const entry of childBoxes(bytes, stsd.start + 8, stsd.end)) {
    if (entry.type !== "alac") continue;
    for (let offset = entry.start + 28; offset + 36 <= entry.end; offset++) {
      if (view.getUint32(offset) === 36 && boxType(bytes, offset + 4) === "alac") {
        return bytes.subarray(offset + 12, offset + 36);
      }
    }
  }
  return null;
}

async function readTopLevel(source: ByteSource): Promise<Uint8Array | null> {
  let offset = 0;
  while (offset + 8 <= source.size) {
    const header = await source.read(offset, 16);
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    let size = view.getUint32(0);
    let headerSize = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(8));
      headerSize = 16;
    } else if (size === 0) {
      size = source.size - offset;
    }
    if (size < headerSize) return null;
    if (boxType(header, 4) === "moov") {
      if (size > MAX_MOOV_BYTES) return null;
      return source.read(offset, size);
    }
    offset += size;
  }
  return null;
}

function sampleTable(bytes: Uint8Array, stbl: Box, frameLength: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const stsz = findChild(bytes, stbl, "stsz");
  const stsc = findChild(bytes, stbl, "stsc");
  const stts = findChild(bytes, stbl, "stts");
  const stco = findChild(bytes, stbl, "stco") ?? findChild(bytes, stbl, "co64");
  if (!stsz || !stsc || !stco) throw new Error("MP4 sample table is incomplete");

  const uniformSize = view.getUint32(stsz.start + 4);
  const frameCount = view.getUint32(stsz.start + 8);
  const frameSizes = Array.from({ length: frameCount }, (_, i) =>
    uniformSize || view.getUint32(stsz.start + 12 + i * 4)
  );

  const wide = boxType(bytes, stco.start - 4) === "co64";
  const chunkCount = view.getUint32(stco.start + 4);
  const chunkOffsets = Array.from({ length: chunkCount }, (_, i) =>
    wide ? Number(view.getBigUint64(stco.start + 8 + i * 8)) : view.getUint32(stco.start + 8 + i * 4)
  );

  const runs = Array.from({ length: view.getUint32(stsc.start + 4) }, (_, i) => ({
    firstChunk: view.getUint32(stsc.start + 8 + i * 12) - 1,
    perChunk: view.getUint32(stsc.start + 12 + i * 12),
  }));
  const frameOffsets: number[] = [];
  for (let r = 0; r < runs.length && frameOffsets.length < frameCount; r++) {
    const lastChunk = r + 1 < runs.length ? runs[r + 1].firstChunk : chunkCount;
    for (let chunk = runs[r].firstChunk; chunk < lastChunk && frameOffsets.length < frameCount; chunk++) {
      let offset = chunkOffsets[chunk];
      for (let s = 0; s < runs[r].perChunk && frameOffsets.length < frameCount; s++) {
        frameOffsets.push(offset);
        offset += frameSizes[frameOffsets.length - 1];
      }
    }
  }
  if (frameOffsets.length !== frameCount) throw new Error("MP4 chunk table does not cover all frames");

  const frameStarts: number[] = [];
  let totalSamples = 0;
  if (stts) {
    const entries = view.getUint32(stts.start + 4);
    for (let e = 0; e < entries; e++) {
      const count = view.getUint32(stts.start + 8 + e * 8);
      const delta = view.getUint32(stts.start + 12 + e * 8);
      for (let i = 0; i < count && frameStarts.length < frameCount; i++) {
        frameStarts.push(totalSamples);
        totalSamples += delta;
      }
    }
  }
  while (frameStarts.length < frameCount) {
    frameStarts.push(totalSamples);
    totalSamples += frameLength;
  }
  return { frameOffsets, frameSizes, frameStarts, totalSamples };
}

export async function readAlacTrack(source: ByteSource): Promise<AlacTrack | null> {
  const moov = await readTopLevel(source);
  if (!moov) return null;
  const root: Box = { type: "moov", start: new DataView(moov.buffer, moov.byteOffset).getUint32(0) === 1 ? 16 : 8, end: moov.length };
  for (const trak of childBoxes(moov, root.start, root.end)) {
    if (trak.type !== "trak") continue;
    const stbl = findPath(moov, trak, ["mdia", "minf", "stbl"]);
    const stsd = stbl && findChild(moov, stbl, "stsd");
    const configBytes = stsd && findAlacConfig(moov, stsd);
    if (!stbl || !configBytes) continue;
    const config = parseAlacConfig(configBytes);
    return { config, ...sampleTable(moov, stbl, config.frameLength) };
  }
  return null;
}
