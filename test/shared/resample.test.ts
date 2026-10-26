import { describe, expect, it } from "vitest";
import { Resampler, concatSamples, mixToMono } from "../../src/shared/resample";

function sine(frequency: number, rate: number, seconds: number, amplitude = 0.5): Float32Array {
  const out = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / rate);
  return out;
}

function rms(samples: Float32Array, from = 0, to = samples.length): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (to - from));
}

function resample(input: Float32Array, from: number, to: number, chunk = input.length): Float32Array {
  const resampler = new Resampler(from, to);
  const parts: Float32Array[] = [];
  for (let i = 0; i < input.length; i += chunk) parts.push(resampler.push(input.subarray(i, i + chunk)));
  parts.push(resampler.flush());
  return concatSamples(parts);
}

describe("Resampler", () => {
  it("keeps the length in proportion to the rates", () => {
    expect(resample(sine(440, 44100, 2), 44100, 11025).length).toBe(22050);
    expect(Math.abs(resample(sine(440, 96000, 2), 96000, 11025).length - 22050)).toBeLessThanOrEqual(1);
  });

  it("passes a tone in the passband at its level", () => {
    for (const rate of [44100, 48000, 96000]) {
      const out = resample(sine(1000, rate, 1), rate, 11025);
      expect(rms(out, 500, out.length - 500)).toBeCloseTo(0.5 / Math.SQRT2, 2);
    }
  });

  it("keeps the frequency of a tone", () => {
    const out = resample(sine(440, 44100, 1), 44100, 11025);
    const expected = sine(440, 11025, 1);
    let error = 0;
    for (let i = 500; i < out.length - 500; i++) error = Math.max(error, Math.abs(out[i] - expected[i]));
    expect(error).toBeLessThan(0.01);
  });

  it("removes tones above the new Nyquist frequency instead of folding them down", () => {
    for (const frequency of [7000, 9000, 15000]) {
      const out = resample(sine(frequency, 44100, 1), 44100, 11025);
      expect(rms(out, 500, out.length - 500)).toBeLessThan(0.005);
    }
  });

  it("raises a low sample rate without changing the tone", () => {
    const out = resample(sine(300, 8000, 1), 8000, 11025);
    expect(out.length).toBe(11025);
    const expected = sine(300, 11025, 1);
    let error = 0;
    for (let i = 500; i < out.length - 500; i++) error = Math.max(error, Math.abs(out[i] - expected[i]));
    expect(error).toBeLessThan(0.01);
  });

  it("gives the same result in chunks as in one go", () => {
    const input = sine(523.25, 48000, 1.5);
    const whole = resample(input, 48000, 11025);
    const chunked = resample(input, 48000, 11025, 4097);
    expect(chunked.length).toBe(whole.length);
    for (let i = 0; i < whole.length; i++) expect(chunked[i]).toBeCloseTo(whole[i], 5);
  });
});

describe("mixToMono", () => {
  it("averages the channels over the requested range", () => {
    const left = Float32Array.from([1, 1, 1, 1]);
    const right = Float32Array.from([0, 0, 1, 1]);
    expect(Array.from(mixToMono([left, right], 1, 4))).toEqual([0.5, 1, 1]);
  });
});
