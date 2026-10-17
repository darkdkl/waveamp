import type { EqBandCount } from "./types";

export type { EqBandCount };

export interface EqLayout {
  frequencies: number[];
  labels: string[];
  q: number;
}

const FINE_LABELS = ["31", "45", "63", "90", "125", "180", "250", "355", "500", "710", "1K", "1.4K", "2K", "2.8K", "4K", "5.6K", "8K", "11K", "16K"];

export const EQ_LAYOUTS: Record<EqBandCount, EqLayout> = {
  10: {
    frequencies: [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000],
    labels: ["60", "170", "310", "600", "1K", "3K", "6K", "12K", "14K", "16K"],
    q: 1,
  },
  19: {
    frequencies: FINE_LABELS.map((_, i) => 31.5 * 2 ** (i / 2)),
    labels: FINE_LABELS,
    q: 1.7,
  },
};

const FILTER_GAIN_LIMIT_DB = 30;
const CORRECTION_STEP_DB = 0.25;
const CORRECTION_ITERATIONS = 2;

export function normalizeBandCount(value: unknown): EqBandCount {
  return value === 19 ? 19 : 10;
}

export function curveAt(frequencies: number[], gains: number[], frequency: number): number {
  const last = frequencies.length - 1;
  if (frequency <= frequencies[0]) return gains[0];
  if (frequency >= frequencies[last]) return gains[last];
  let i = 0;
  while (frequencies[i + 1] < frequency) i++;
  const t = Math.log(frequency / frequencies[i]) / Math.log(frequencies[i + 1] / frequencies[i]);
  return gains[i] + t * (gains[i + 1] - gains[i]);
}

export function convertGains(gains: number[], from: EqBandCount, to: EqBandCount): number[] {
  if (from === to) return [...gains];
  const source = EQ_LAYOUTS[from].frequencies;
  return EQ_LAYOUTS[to].frequencies.map((frequency) => Math.round(curveAt(source, gains, frequency)) || 0);
}

export function peakingResponseDb(center: number, gainDb: number, q: number, frequency: number, sampleRate: number): number {
  const a = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * center) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cosW0 = Math.cos(w0);
  const b0 = 1 + alpha * a;
  const b2 = 1 - alpha * a;
  const a0 = 1 + alpha / a;
  const a2 = 1 - alpha / a;
  const w = (2 * Math.PI * frequency) / sampleRate;
  const cos1 = Math.cos(w);
  const cos2 = Math.cos(2 * w);
  const sin1 = Math.sin(w);
  const sin2 = Math.sin(2 * w);
  const numRe = b0 - 2 * cosW0 * cos1 + b2 * cos2;
  const numIm = 2 * cosW0 * sin1 - b2 * sin2;
  const denRe = a0 - 2 * cosW0 * cos1 + a2 * cos2;
  const denIm = 2 * cosW0 * sin1 - a2 * sin2;
  return 10 * Math.log10((numRe ** 2 + numIm ** 2) / (denRe ** 2 + denIm ** 2));
}

export function cascadeResponseDb(layout: EqLayout, filterGains: number[], frequency: number, sampleRate: number): number {
  return layout.frequencies.reduce((sum, center, i) => sum + peakingResponseDb(center, filterGains[i], layout.q, frequency, sampleRate), 0);
}

function solveLinear(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const rows = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    for (let row = 0; row < n; row++) {
      if (row === col || !rows[col][col]) continue;
      const factor = rows[row][col] / rows[col][col];
      for (let k = col; k <= n; k++) rows[row][k] -= factor * rows[col][k];
    }
  }
  return rows.map((row, i) => (row[i] ? row[n] / row[i] : 0));
}

export function filterGainsFor(layout: EqLayout, sliders: number[], sampleRate: number): number[] {
  const centers = layout.frequencies;
  let gains = [...sliders];
  for (let iteration = 0; iteration < CORRECTION_ITERATIONS; iteration++) {
    const response = centers.map((frequency) => cascadeResponseDb(layout, gains, frequency, sampleRate));
    const jacobian = centers.map((frequency) =>
      centers.map((center, col) => {
        const stepped = peakingResponseDb(center, gains[col] + CORRECTION_STEP_DB, layout.q, frequency, sampleRate);
        const base = peakingResponseDb(center, gains[col], layout.q, frequency, sampleRate);
        return (stepped - base) / CORRECTION_STEP_DB;
      })
    );
    const delta = solveLinear(jacobian, sliders.map((target, i) => target - response[i]));
    gains = gains.map((gain, i) => Math.max(-FILTER_GAIN_LIMIT_DB, Math.min(FILTER_GAIN_LIMIT_DB, gain + delta[i])));
  }
  return gains;
}
