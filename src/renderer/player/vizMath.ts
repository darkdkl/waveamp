import type { VizResponse } from "../../shared/types";

export const SLOW_TAU_MS = 200;
export const SMOOTH_TAU_MS = 65;
export const PEAK_RISE_TAU_MS = 5;

export function followLevel(
  current: number,
  target: number,
  dt: number,
  peakFallTauMs: number,
  response: VizResponse
): number {
  const tau = response === "peak" ? (target > current ? PEAK_RISE_TAU_MS : peakFallTauMs) : responseTauMs(response);
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

export function responseTauMs(response: VizResponse): number {
  return response === "slow" ? SLOW_TAU_MS : SMOOTH_TAU_MS;
}

export function parseVizResponse(value: string): VizResponse {
  return value === "slow" || value === "peak" ? value : "smooth";
}

export function needlePosition(dbVu: number): number {
  return Math.min(1.05, 10 ** ((dbVu - 3) / 20));
}

export function spectrumBinMap(columns: number, binCount: number): number[] {
  return Array.from({ length: columns }, (_, i) => {
    const maxBin = binCount - 1;
    const t = i / (columns - 1);
    return Math.min(maxBin, Math.round(maxBin ** t));
  });
}
