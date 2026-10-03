import { describe, expect, it } from "vitest";
import { interleaveStereo } from "../../../../src/renderer/player/presets/pcm";

describe("interleaveStereo", () => {
  it("interleaves the newest frames of both channels", () => {
    const left = new Float32Array([1, 2, 3, 4]);
    const right = new Float32Array([-1, -2, -3, -4]);
    const out = new Float32Array(4);
    expect(interleaveStereo(left, right, out, 2)).toBe(2);
    expect([...out]).toEqual([3, -3, 4, -4]);
  });

  it("never writes past the output buffer", () => {
    const out = new Float32Array(2);
    expect(interleaveStereo(new Float32Array(8), new Float32Array(8), out, 8)).toBe(1);
  });
});
