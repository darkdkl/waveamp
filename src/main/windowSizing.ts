export interface Size {
  width: number;
  height: number;
}

export function normalizeScalePercent(scale: unknown): number {
  return typeof scale === "number" ? Math.min(150, Math.max(70, Math.round(scale / 10) * 10)) : 100;
}

export function scaledSize({ width, height }: Size, percent: number, workArea: Size): Size {
  return {
    width: Math.min(Math.round((width * percent) / 100), workArea.width),
    height: Math.min(Math.round((height * percent) / 100), workArea.height),
  };
}

export function rescaledSize(current: Size, ratio: number, workArea: Size): Size {
  return {
    width: Math.min(Math.round(current.width * ratio), workArea.width),
    height: Math.min(Math.round(current.height * ratio), workArea.height),
  };
}
