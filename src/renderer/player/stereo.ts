import { audio, channelsTag } from "./dom";
import { state } from "./state";
import { meterAnalysers, setStereoWidening } from "./audioGraph";
import { persistConfig } from "./config";
import {
  classifyChannels,
  normalizeStereoStrength,
  pseudoStereoAmount,
  stereoWidth,
  type ChannelLayout,
} from "../../shared/stereo";

const DETECT_INTERVAL_MS = 150;
const ENERGY_SMOOTHING = 0.2;

const left = new Float32Array(meterAnalysers[0].fftSize);
const right = new Float32Array(meterAnalysers[1].fftSize);
let sideEnergy = 0;
let midEnergy = 0;
let layout: ChannelLayout | null = null;

function wideningActive(): boolean {
  return state.playbackMode === "radio" ? state.stereoRadio : state.stereoTracks;
}

function applyStereo(): void {
  const active = wideningActive();
  const extraSide = active ? stereoWidth(state.stereoStrength) - 1 : 0;
  const pseudo = active && state.stereoPseudo && layout === "mono" ? pseudoStereoAmount(state.stereoStrength) : 0;
  setStereoWidening(extraSide, pseudo);
}

function renderChannels(): void {
  channelsTag.hidden = !layout;
  channelsTag.textContent = layout === "mono" ? "MONO" : "STEREO";
  channelsTag.classList.toggle("is-idle", layout === "mono");
}

function resetChannels(): void {
  sideEnergy = 0;
  midEnergy = 0;
  layout = null;
  renderChannels();
  applyStereo();
}

function measureChannels(): void {
  if (audio.paused) return;
  meterAnalysers[0].getFloatTimeDomainData(left);
  meterAnalysers[1].getFloatTimeDomainData(right);
  let side = 0;
  let mid = 0;
  for (let i = 0; i < left.length; i++) {
    const d = left[i] - right[i];
    const s = left[i] + right[i];
    side += d * d;
    mid += s * s;
  }
  sideEnergy += (side / left.length - sideEnergy) * ENERGY_SMOOTHING;
  midEnergy += (mid / left.length - midEnergy) * ENERGY_SMOOTHING;
  const next = classifyChannels(layout, sideEnergy, midEnergy);
  if (next === layout) return;
  layout = next;
  renderChannels();
  applyStereo();
}

export function setStereoRadio(enabled: boolean): void {
  state.stereoRadio = enabled;
  applyStereo();
  persistConfig();
}

export function setStereoTracks(enabled: boolean): void {
  state.stereoTracks = enabled;
  applyStereo();
  persistConfig();
}

export function setStereoStrength(value: number): void {
  state.stereoStrength = normalizeStereoStrength(value);
  applyStereo();
  persistConfig();
}

export function setStereoPseudo(enabled: boolean): void {
  state.stereoPseudo = enabled;
  applyStereo();
  persistConfig();
}

export function initStereo(): void {
  audio.addEventListener("loadstart", resetChannels);
  setInterval(measureChannels, DETECT_INTERVAL_MS);
  renderChannels();
  applyStereo();
}
