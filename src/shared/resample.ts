const PHASES = 256;
const ZERO_CROSSINGS = 12;
const PASSBAND = 0.45;

function blackman(x: number): number {
  return 0.42 + 0.5 * Math.cos(Math.PI * x) + 0.08 * Math.cos(2 * Math.PI * x);
}

export function mixToMono(channels: Float32Array[], from = 0, to = channels[0]?.length ?? 0): Float32Array {
  const out = new Float32Array(Math.max(0, to - from));
  if (!channels.length) return out;
  for (const channel of channels) {
    for (let i = 0; i < out.length; i++) out[i] += channel[from + i];
  }
  if (channels.length > 1) for (let i = 0; i < out.length; i++) out[i] /= channels.length;
  return out;
}

export function concatSamples(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export class Resampler {
  private readonly step: number;
  private readonly half: number;
  private readonly kernel: Float32Array;
  private buffer = new Float32Array(0);
  private bufferStart = 0;
  private produced = 0;

  constructor(inputRate: number, outputRate: number) {
    this.step = inputRate / outputRate;
    const cutoff = (PASSBAND * Math.min(inputRate, outputRate)) / inputRate;
    this.half = Math.ceil(ZERO_CROSSINGS / (2 * cutoff));
    this.kernel = new Float32Array(this.half * PHASES + 2);
    for (let i = 0; i < this.kernel.length; i++) {
      const x = i / PHASES;
      if (x >= this.half) continue;
      const arg = 2 * cutoff * x;
      const sinc = arg === 0 ? 1 : Math.sin(Math.PI * arg) / (Math.PI * arg);
      this.kernel[i] = 2 * cutoff * sinc * blackman(x / this.half);
    }
  }

  push(input: Float32Array): Float32Array {
    const merged = new Float32Array(this.buffer.length + input.length);
    merged.set(this.buffer);
    merged.set(input, this.buffer.length);
    this.buffer = merged;
    return this.drain(false);
  }

  flush(): Float32Array {
    return this.drain(true);
  }

  private drain(final: boolean): Float32Array {
    const end = this.bufferStart + this.buffer.length;
    const out: number[] = [];
    for (;;) {
      const center = this.produced * this.step;
      if (final ? center >= end : center + this.half >= end) break;
      out.push(this.sample(center));
      this.produced++;
    }
    const keepFrom = Math.max(this.bufferStart, Math.floor(this.produced * this.step) - this.half);
    this.buffer = this.buffer.subarray(keepFrom - this.bufferStart);
    this.bufferStart = keepFrom;
    return Float32Array.from(out);
  }

  private sample(center: number): number {
    const first = Math.max(this.bufferStart, Math.ceil(center - this.half));
    const last = Math.min(this.bufferStart + this.buffer.length - 1, Math.floor(center + this.half));
    let sum = 0;
    let weights = 0;
    for (let k = first; k <= last; k++) {
      const position = Math.abs(center - k) * PHASES;
      const index = Math.floor(position);
      const weight = this.kernel[index] + (position - index) * (this.kernel[index + 1] - this.kernel[index]);
      sum += this.buffer[k - this.bufferStart] * weight;
      weights += weight;
    }
    return weights > 0 ? sum / weights : 0;
  }
}
