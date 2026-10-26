import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { readAudioData } from "../../src/main/audioData";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "waveamp-audio-data-"));

function wav(name: string, seconds: number): string {
  const rate = 1000;
  const length = Math.round(seconds * rate);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(length, 40);
  const file = path.join(dir, name);
  fs.writeFileSync(file, Buffer.concat([header, Buffer.alloc(length, 128)]));
  return file;
}

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("readAudioData", () => {
  it("refuses files that are not audio", async () => {
    const file = path.join(dir, "notes.txt");
    fs.writeFileSync(file, "secret");
    expect(await readAudioData(file, false)).toEqual({ ok: false, error: "failed" });
  });

  it("returns the bytes of a short audio file", async () => {
    const file = wav("short.wav", 1);
    const result = await readAudioData(file, false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.byteLength).toBe(fs.statSync(file).size);
  });

  it("refuses files longer than the analysis limit before reading them", async () => {
    expect(await readAudioData(wav("long.wav", 21 * 60), false)).toEqual({ ok: false, error: "tooLong" });
  });
});
