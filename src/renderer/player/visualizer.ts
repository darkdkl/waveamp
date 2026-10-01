import { viz, vizCanvas } from "./dom";
import { state } from "./state";
import { analyserNode, meterAnalysers } from "./audioGraph";
import { SMOOTH_TAU_MS, followLevel, needlePosition, spectrumBinMap } from "./vizMath";
import { persistConfig } from "./config";
import type { VizMode } from "../../shared/types";

const VIZ_COLUMNS = 26;
const VIZ_SEGMENTS = 9;
const vizFreqData = new Uint8Array(analyserNode.frequencyBinCount);
const vizSegments: HTMLElement[][] = [];
const vizBinMap = spectrumBinMap(VIZ_COLUMNS, vizFreqData.length);

const VIZ_MODES: VizMode[] = ["spectrum", "meters", "scope"];

const NEEDLE_PEAK_FALL_TAU_MS = 650;
const SPECTRUM_PEAK_FALL_TAU_MS = 300;
const VU_REFERENCE_DBFS = -12;
const VU_SCALE_MARKS = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3];
const VU_MAJOR_MARKS = [-20, -10, -5, 0, 3];

const vizCtx = vizCanvas.getContext("2d");
const meterSamples = new Float32Array(meterAnalysers[0].fftSize);
const scopeRight = new Float32Array(meterAnalysers[1].fftSize);
const SCOPE_WINDOW = 512;
const scopeTrace = new Float32Array(SCOPE_WINDOW);
const spectrumLevels = new Float32Array(VIZ_COLUMNS);
const needles = [0, 0];
let lastVizFrame = performance.now();

function buildViz(): void {
  for (let c = 0; c < VIZ_COLUMNS; c++) {
    const col = document.createElement("div");
    col.className = "display__viz-col";
    const segs = [];
    for (let s = 0; s < VIZ_SEGMENTS; s++) {
      const seg = document.createElement("div");
      seg.className = "display__viz-seg";
      col.appendChild(seg);
      segs.push(seg);
    }
    viz.appendChild(col);
    vizSegments.push(segs);
  }
}

export function setVizMode(mode: string): void {
  state.vizMode = VIZ_MODES.includes(mode as VizMode) ? (mode as VizMode) : "spectrum";
  viz.hidden = state.vizMode !== "spectrum";
  vizCanvas.hidden = state.vizMode === "spectrum";
  persistConfig();
}

export function cycleVizMode(): void {
  setVizMode(VIZ_MODES[(VIZ_MODES.indexOf(state.vizMode) + 1) % VIZ_MODES.length]);
}

export function setVizResponse(value: string): void {
  state.vizResponse = value === "peak" ? "peak" : "smooth";
  persistConfig();
}

function meterTarget(analyser: AnalyserNode): number {
  analyser.getFloatTimeDomainData(meterSamples);
  if (state.vizResponse === "peak") {
    let peak = 0;
    for (const sample of meterSamples) peak = Math.max(peak, Math.abs(sample));
    return needlePosition(20 * Math.log10(peak) + 3);
  }
  let sumSquares = 0;
  for (const sample of meterSamples) sumSquares += sample * sample;
  const rms = Math.sqrt(sumSquares / meterSamples.length);
  return needlePosition(20 * Math.log10(rms) - VU_REFERENCE_DBFS);
}

// Custom properties may hold calc()/color-mix() a canvas can't parse — resolve to rgb().
function resolveCssColor(name: string): string {
  vizCanvas.style.color = `var(${name})`;
  return getComputedStyle(vizCanvas).color;
}

let vizColors = null;
let vizColorsReadAt = -Infinity;

function currentVizColors(now: number) {
  if (!vizColors || now - vizColorsReadAt > 500) {
    vizColors = { fg: resolveCssColor("--lcd-fg"), dim: resolveCssColor("--lcd-fg-dim"), hot: "#e06060" };
    vizColorsReadAt = now;
  }
  return vizColors;
}

function prepareVizCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = vizCanvas.clientWidth;
  const height = vizCanvas.clientHeight;
  if (vizCanvas.width !== Math.round(width * dpr) || vizCanvas.height !== Math.round(height * dpr)) {
    vizCanvas.width = Math.round(width * dpr);
    vizCanvas.height = Math.round(height * dpr);
  }
  vizCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  vizCtx.clearRect(0, 0, width, height);
  return { width, height };
}

function drawMeter(x, width, height, position, label, colors) {
  const halfWidth = width / 2 - 4;
  const drop = height - 9;
  const halfSweep = 2 * Math.atan(drop / halfWidth);
  const radius = halfWidth / Math.sin(halfSweep);
  const cx = x + width / 2;
  const cy = radius + 2;
  const angleAt = (pos) => -Math.PI / 2 + (pos - 0.5) * 2 * halfSweep;

  vizCtx.save();
  vizCtx.beginPath();
  vizCtx.rect(x, 0, width, height);
  vizCtx.clip();

  vizCtx.lineWidth = 1;
  vizCtx.strokeStyle = colors.dim;
  vizCtx.beginPath();
  vizCtx.arc(cx, cy, radius, angleAt(needlePosition(-20)), angleAt(needlePosition(0)));
  vizCtx.stroke();
  vizCtx.strokeStyle = colors.hot;
  vizCtx.beginPath();
  vizCtx.arc(cx, cy, radius, angleAt(needlePosition(0)), angleAt(1));
  vizCtx.stroke();

  for (const db of VU_SCALE_MARKS) {
    const angle = angleAt(needlePosition(db));
    const inner = radius - (VU_MAJOR_MARKS.includes(db) ? 5 : 3);
    vizCtx.strokeStyle = db > 0 ? colors.hot : colors.dim;
    vizCtx.beginPath();
    vizCtx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    vizCtx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    vizCtx.stroke();
  }

  vizCtx.fillStyle = colors.dim;
  vizCtx.font = '7px "DejaVu Sans Mono", monospace';
  vizCtx.fillText(label, x + 2, height - 2);

  const needleAngle = angleAt(Math.min(1.03, position));
  vizCtx.strokeStyle = colors.fg;
  vizCtx.lineWidth = 1.2;
  vizCtx.beginPath();
  vizCtx.moveTo(cx, cy);
  vizCtx.lineTo(cx + Math.cos(needleAngle) * (radius + 2), cy + Math.sin(needleAngle) * (radius + 2));
  vizCtx.stroke();
  vizCtx.restore();
}

function renderMeters(dt: number, now: number): void {
  meterAnalysers.forEach((analyser, channel) => {
    needles[channel] = followLevel(
      needles[channel],
      meterTarget(analyser),
      dt,
      NEEDLE_PEAK_FALL_TAU_MS,
      state.vizResponse
    );
  });
  const { width, height } = prepareVizCanvas();
  const colors = currentVizColors(now);
  const gap = 6;
  const meterWidth = (width - gap) / 2;
  drawMeter(0, meterWidth, height, needles[0], "L", colors);
  drawMeter(meterWidth + gap, meterWidth, height, needles[1], "R", colors);
}

function renderScope(dt: number, now: number): void {
  meterAnalysers[0].getFloatTimeDomainData(meterSamples);
  meterAnalysers[1].getFloatTimeDomainData(scopeRight);
  const mixAt = (i) => (meterSamples[i] + scopeRight[i]) / 2;
  let start = 0;
  for (let i = 1; i < meterSamples.length - SCOPE_WINDOW; i++) {
    if (mixAt(i - 1) < 0 && mixAt(i) >= 0) {
      start = i;
      break;
    }
  }
  const blend = state.vizResponse === "smooth" ? 1 - Math.exp(-dt / SMOOTH_TAU_MS) : 1;
  for (let i = 0; i < SCOPE_WINDOW; i++) {
    scopeTrace[i] += (mixAt(start + i) - scopeTrace[i]) * blend;
  }

  const { width, height } = prepareVizCanvas();
  vizCtx.strokeStyle = currentVizColors(now).fg;
  vizCtx.lineWidth = 1.2;
  vizCtx.beginPath();
  scopeTrace.forEach((sample, i) => {
    const x = (i / (SCOPE_WINDOW - 1)) * width;
    const y = height / 2 - Math.max(-1, Math.min(1, sample)) * (height / 2 - 1);
    if (i === 0) vizCtx.moveTo(x, y);
    else vizCtx.lineTo(x, y);
  });
  vizCtx.stroke();
}

function renderSpectrum(dt: number): void {
  analyserNode.getByteFrequencyData(vizFreqData);
  for (let c = 0; c < VIZ_COLUMNS; c++) {
    spectrumLevels[c] = followLevel(
      spectrumLevels[c],
      vizFreqData[vizBinMap[c]] / 255,
      dt,
      SPECTRUM_PEAK_FALL_TAU_MS,
      state.vizResponse
    );
    const lit = Math.round(spectrumLevels[c] * VIZ_SEGMENTS);
    const segs = vizSegments[c];
    for (let s = 0; s < VIZ_SEGMENTS; s++) {
      segs[s].classList.toggle("is-lit", s < lit);
    }
  }
}

function renderViz(now: number): void {
  const dt = Math.min(100, now - lastVizFrame);
  lastVizFrame = now;
  if (state.vizMode === "meters") renderMeters(dt, now);
  else if (state.vizMode === "scope") renderScope(dt, now);
  else renderSpectrum(dt);
  requestAnimationFrame(renderViz);
}

export function initVisualizerControls(): void {
  [viz, vizCanvas].forEach((el) => el.addEventListener("click", cycleVizMode));
}

export function startVisualizer(): void {
  buildViz();
  requestAnimationFrame(renderViz);
}
