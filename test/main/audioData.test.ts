import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { readAudioData } from "../../src/main/audioData";
import type { AudioDataResult } from "../../src/shared/types";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "waveamp-audio-data-"));
const ANALYSIS_RATE = 11025;

type Signal = (seconds: number) => number;

const silenceThenTone: Signal = (t) => (t < 2 ? 0 : 0.5 * Math.sin(2 * Math.PI * 440 * t));

interface WavOptions {
  rate?: number;
  signal?: Signal;
  channels?: number;
  bits?: 8 | 16 | 24 | 32;
  float?: boolean;
  extensible?: boolean;
  formatCode?: number;
  unknownSize?: boolean;
}

function wav(
  name: string,
  seconds: number,
  { rate = 1000, signal = () => 0, channels = 1, bits = 8, float = false, extensible = false, formatCode, unknownSize = false }: WavOptions = {}
): string {
  const frames = Math.round(seconds * rate);
  const bytes = bits / 8;
  const length = frames * channels * bytes;
  const code = formatCode ?? (float ? 3 : 1);
  const fmt = Buffer.alloc(extensible ? 40 : 16);
  fmt.writeUInt16LE(extensible ? 0xfffe : code, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * channels * bytes, 8);
  fmt.writeUInt16LE(channels * bytes, 12);
  fmt.writeUInt16LE(bits, 14);
  if (extensible) {
    fmt.writeUInt16LE(22, 16);
    fmt.writeUInt16LE(bits, 18);
    fmt.writeUInt16LE(code, 24);
  }
  const data = Buffer.alloc(length);
  for (let i = 0; i < frames; i++) {
    const value = signal(i / rate);
    for (let c = 0; c < channels; c++) {
      const at = (i * channels + c) * bytes;
      if (float) data.writeFloatLE(value, at);
      else if (bits === 8) data.writeUInt8(Math.round(128 + value * 127), at);
      else data.writeIntLE(Math.round(value * (2 ** (bits - 1) - 1)), at, bytes);
    }
  }
  const chunk = (id: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.write(id, 0);
    head.writeUInt32LE(unknownSize && id === "data" ? 0 : body.length, 4);
    return Buffer.concat([head, body]);
  };
  const body = Buffer.concat([Buffer.from("WAVE"), chunk("fmt ", fmt), chunk("data", data)]);
  const riff = Buffer.alloc(8);
  riff.write("RIFF", 0);
  riff.writeUInt32LE(body.length, 4);
  const file = path.join(dir, name);
  fs.writeFileSync(file, Buffer.concat([riff, body]));
  return file;
}

function crc8(bytes: number[]): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 0x80 ? ((crc << 1) ^ 7) & 0xff : (crc << 1) & 0xff;
  }
  return crc;
}

function crc16(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x8005) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

function utf8Number(value: number): number[] {
  if (value < 0x80) return [value];
  if (value < 0x800) return [0xc0 | (value >> 6), 0x80 | (value & 63)];
  if (value < 0x10000) return [0xe0 | (value >> 12), 0x80 | ((value >> 6) & 63), 0x80 | (value & 63)];
  return [0xf0 | (value >> 18), 0x80 | ((value >> 12) & 63), 0x80 | ((value >> 6) & 63), 0x80 | (value & 63)];
}

interface FlacOptions {
  rate?: number;
  bits?: 16 | 24;
  channels?: number;
  rateInFrames?: boolean;
  signal?: Signal;
  unknownLength?: boolean;
  variableBlocks?: boolean;
  id3?: boolean;
}

const RATE_CODES: Record<number, number> = { 8000: 4, 44100: 9, 48000: 10, 96000: 11 };

function flac(
  name: string,
  seconds: number,
  { rate = 44100, bits = 16, channels = 2, rateInFrames = true, signal = silenceThenTone, unknownLength = false, variableBlocks = false, id3 = false }: FlacOptions = {}
): string {
  const total = Math.round(seconds * rate);
  const blocks = variableBlocks ? [4096, 1500] : [4096];
  const bytes = bits / 8;
  const scale = 2 ** (bits - 1) - 1;
  const info = Buffer.alloc(34);
  info.writeUInt16BE(Math.min(...blocks), 0);
  info.writeUInt16BE(Math.max(...blocks), 2);
  info.writeBigUInt64BE((BigInt(rate) << 44n) | (BigInt(channels - 1) << 41n) | (BigInt(bits - 1) << 36n) | BigInt(unknownLength ? 0 : total), 10);
  const tagBytes = id3 ? [Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 1, 0]), Buffer.alloc(128)] : [];
  const parts = [...tagBytes, Buffer.from("fLaC"), Buffer.from([0x80, 0, 0, 34]), info];
  for (let frame = 0, start = 0; start < total; start += blocks[frame % blocks.length], frame++) {
    const size = Math.min(blocks[frame % blocks.length], total - start);
    const number = variableBlocks ? start : frame;
    const head = [0xff, variableBlocks ? 0xf9 : 0xf8, (7 << 4) | (rateInFrames ? RATE_CODES[rate] : 0), ((channels - 1) << 4) | ((bits === 24 ? 6 : 4) << 1), ...utf8Number(number), (size - 1) >> 8, (size - 1) & 0xff];
    head.push(crc8(head));
    const body = Buffer.alloc(head.length + channels * (1 + size * bytes) + 2);
    body.set(head);
    let at = head.length;
    for (let c = 0; c < channels; c++) {
      body[at++] = 0x02;
      for (let i = 0; i < size; i++) {
        body.writeIntBE(Math.round(signal((start + i) / rate) * scale), at, bytes);
        at += bytes;
      }
    }
    body.writeUInt16BE(crc16(body.subarray(0, at)), at);
    parts.push(body);
  }
  const file = path.join(dir, name);
  fs.writeFileSync(file, Buffer.concat(parts));
  return file;
}

function samplesOf(result: AudioDataResult): Float32Array {
  expect(result.ok).toBe(true);
  if (!result.ok || !("samples" in result)) throw new Error("expected samples");
  return result.samples;
}

function rms(samples: Float32Array, fromSecond: number, toSecond: number): number {
  const from = Math.round(fromSecond * ANALYSIS_RATE);
  const to = Math.round(toSecond * ANALYSIS_RATE);
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (to - from));
}

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("readAudioData", () => {
  it("refuses files that are not audio", async () => {
    const file = path.join(dir, "notes.txt");
    fs.writeFileSync(file, "secret");
    expect(await readAudioData(file, false)).toEqual({ ok: false, error: "failed" });
  });

  it("returns a short WAV file as samples at the analysis rate", async () => {
    expect(samplesOf(await readAudioData(wav("short.wav", 1), false))).toHaveLength(ANALYSIS_RATE);
  });

  it("refuses files longer than the analysis limit before reading them", async () => {
    expect(await readAudioData(wav("long.wav", 21 * 60), false)).toEqual({ ok: false, error: "tooLong" });
  });

  it("cuts a CUE track out of a FLAC album to the sample", async () => {
    const file = flac("album.flac", 6);
    const samples = samplesOf(await readAudioData(file, false, { start: 1.5, end: 2.5 }));
    expect(samples).toHaveLength(ANALYSIS_RATE);
    expect(rms(samples, 0, 0.45)).toBeLessThan(0.01);
    expect(rms(samples, 0.55, 1)).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });

  it("reads the last track of a FLAC album to the end of the file", async () => {
    const samples = samplesOf(await readAudioData(flac("last.flac", 6), false, { start: 4, end: null }));
    expect(samples).toHaveLength(2 * ANALYSIS_RATE);
    expect(rms(samples, 0.1, 1.9)).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });

  it("reads hi-res FLAC", async () => {
    const samples = samplesOf(await readAudioData(flac("hires.flac", 3, { rate: 96000, bits: 24 }), false, { start: 2, end: 3 }));
    expect(samples).toHaveLength(ANALYSIS_RATE);
    expect(rms(samples, 0.1, 0.9)).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });

  it("reads FLAC whose frames take the sample rate from the stream header", async () => {
    const samples = samplesOf(await readAudioData(flac("streaminfo.flac", 3, { rateInFrames: false }), false, { start: 2, end: 3 }));
    expect(rms(samples, 0.1, 0.9)).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });

  it("limits a CUE track rather than the whole album", async () => {
    const quiet = flac("long-album.flac", 21 * 60, { rate: 8000, channels: 1, signal: () => 0 });
    expect(samplesOf(await readAudioData(quiet, false, { start: 60, end: 61 }))).toHaveLength(ANALYSIS_RATE);
    expect(await readAudioData(quiet, false, { start: 0, end: null })).toEqual({ ok: false, error: "tooLong" });
  });

  it("reads the last track of a FLAC album whose length is unknown", async () => {
    const samples = samplesOf(await readAudioData(flac("unknown.flac", 6, { unknownLength: true }), false, { start: 4, end: null }));
    expect(samples).toHaveLength(2 * ANALYSIS_RATE);
    expect(rms(samples, 0.1, 1.9)).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });

  it("finds CUE tracks in FLAC with a variable block size", async () => {
    const samples = samplesOf(await readAudioData(flac("variable.flac", 6, { variableBlocks: true }), false, { start: 1.5, end: 2.5 }));
    expect(samples).toHaveLength(ANALYSIS_RATE);
    expect(rms(samples, 0, 0.45)).toBeLessThan(0.01);
    expect(rms(samples, 0.55, 1)).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });

  it("skips an ID3 tag in front of a FLAC stream", async () => {
    const samples = samplesOf(await readAudioData(flac("tagged.flac", 3, { id3: true }), false, { start: 2, end: 3 }));
    expect(rms(samples, 0.1, 0.9)).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });

  it("reads 24-bit, extensible and floating-point WAV", async () => {
    const formats: WavOptions[] = [{ bits: 24 }, { bits: 24, extensible: true }, { bits: 32, float: true }];
    for (const [i, format] of formats.entries()) {
      const file = wav(`format-${i}.wav`, 3, { rate: 48000, channels: 2, signal: silenceThenTone, ...format });
      const samples = samplesOf(await readAudioData(file, false, { start: 2, end: 3 }));
      expect(samples).toHaveLength(ANALYSIS_RATE);
      expect(rms(samples, 0.1, 0.9)).toBeCloseTo(0.5 / Math.SQRT2, 2);
    }
  });

  it("reads a WAV whose header never got its data size", async () => {
    const samples = samplesOf(await readAudioData(wav("unfinished.wav", 3, { rate: 44100, signal: silenceThenTone, bits: 16, unknownSize: true }), false));
    expect(samples).toHaveLength(3 * ANALYSIS_RATE);
    expect(rms(samples, 2.1, 2.9)).toBeCloseTo(0.5 / Math.SQRT2, 2);
    expect(await readAudioData(wav("unfinished-long.wav", 21 * 60, { unknownSize: true }), false)).toEqual({ ok: false, error: "tooLong" });
  });

  it("fails fast when a CUE track starts past the end of a FLAC of unknown length", async () => {
    const file = flac("short-unknown.flac", 3, { unknownLength: true });
    expect(await readAudioData(file, false, { start: 60, end: 70 })).toEqual({ ok: false, error: "failed" });
  });

  it("only asks the FLAC and WAV reader about FLAC and WAV files", async () => {
    const asked: string[] = [];
    const file = path.join(dir, "song.mp3");
    fs.writeFileSync(file, Buffer.alloc(64));
    await readAudioData(file, false, { start: 0, end: null }, async (filePath) => {
      asked.push(filePath);
      return null;
    }).catch(() => null);
    expect(asked).toEqual([]);
  });

  it("hands files it cannot read to the built-in decoder", async () => {
    const adpcm = wav("adpcm.wav", 1, { formatCode: 2, bits: 8 });
    const result = await readAudioData(adpcm, false);
    expect(result.ok && "data" in result).toBe(true);
    const fallback = await readAudioData(wav("plain.wav", 1), false, { start: 0, end: null }, async () => null);
    expect(fallback.ok && "data" in fallback).toBe(true);
  });

  it("cuts a CUE track out of a WAV album", async () => {
    const file = wav("album.wav", 6, { rate: 44100, signal: silenceThenTone, channels: 2, bits: 16 });
    const samples = samplesOf(await readAudioData(file, false, { start: 1.5, end: 2.5 }));
    expect(samples).toHaveLength(ANALYSIS_RATE);
    expect(rms(samples, 0, 0.45)).toBeLessThan(0.01);
    expect(rms(samples, 0.55, 1)).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });
});
