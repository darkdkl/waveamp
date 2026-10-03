export function interleaveStereo(left: Float32Array, right: Float32Array, out: Float32Array, frames: number): number {
  const count = Math.min(frames, left.length, right.length, Math.floor(out.length / 2));
  const offset = left.length - count;
  for (let i = 0; i < count; i++) {
    out[2 * i] = left[offset + i];
    out[2 * i + 1] = right[offset + i];
  }
  return count;
}
