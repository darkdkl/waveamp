import { i18n } from "../../i18n";
import {
  playerDisplay,
  presetCanvas,
  presetLock,
  presetMessage,
  presetName,
  presetNextBtn,
  presetPrevBtn,
  presetStage,
} from "../dom";
import { state } from "../state";
import { meterAnalysers } from "../audioGraph";
import { logEvent } from "../log";
import { persistConfig } from "../config";
import { setDisplayExtraHeight } from "../layout";
import { PresetPlaylist } from "./playlist";
import type { PresetEngine } from "./engine";
import type { PresetInfo } from "../../../shared/types";
import { errorMessage } from "../../../shared/errors";

const PRESET_DURATION_S = 16;
const PRESET_DURATION_SPREAD_S = 8;
const PRESET_BLEND_S = 2.7;
const MAX_FAILED_PRESETS_IN_A_ROW = 5;

let supported: boolean | null = null;
let active = false;
let engine: PresetEngine | null = null;
let enginePromise: Promise<PresetEngine | null> | null = null;
let presets: PresetInfo[] = [];
let listedFolder: string | null = null;
let playlist = new PresetPlaylist(0);
let frozen = false;
let failedInARow = 0;
let frame = 0;
let onCycleMode: () => void = () => {};
const left = new Float32Array(meterAnalysers[0].fftSize);
const right = new Float32Array(meterAnalysers[1].fftSize);

export function presetsSupported(): boolean {
  if (supported === null) {
    const probe = document.createElement("canvas").getContext("webgl2");
    supported = !!probe && !!window.electronAPI?.listPresets;
    probe?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return supported;
}

function showMessage(key: string | null): void {
  presetMessage.dataset.key = key ?? "";
  presetMessage.hidden = !key;
  presetMessage.textContent = key ? i18n.t(key) : "";
}

function renderBar(): void {
  const index = playlist.current;
  presetName.textContent = index !== null ? (presets[index]?.name ?? "") : "";
  presetLock.hidden = !frozen;
  presetLock.setAttribute("aria-label", i18n.t("presetFrozen"));
}

function applySwitching(): void {
  engine?.setLocked(frozen || !state.presetAutoSwitch);
  engine?.setHardCuts(state.presetHardCuts);
}

function resizeCanvas(): void {
  const width = Math.max(1, Math.round(presetCanvas.clientWidth * devicePixelRatio));
  const height = Math.max(1, Math.round(presetCanvas.clientHeight * devicePixelRatio));
  if (presetCanvas.width === width && presetCanvas.height === height) return;
  presetCanvas.width = width;
  presetCanvas.height = height;
  engine?.resize(width, height);
}

async function ensureEngine(): Promise<PresetEngine | null> {
  if (!enginePromise) {
    enginePromise = import("./engine")
      .then(({ PresetEngine }) => PresetEngine.create("#presetCanvas", presetCanvas.width, presetCanvas.height))
      .then((created) => {
        created.onSwitchRequested((isHardCut) => {
          if (!frozen && state.presetAutoSwitch) showPreset(playlist.next(), !isHardCut);
        });
        created.onFailed((message) => {
          logEvent("warn", "presets", `Preset failed: ${message}`);
          failedInARow += 1;
          if (failedInARow < MAX_FAILED_PRESETS_IN_A_ROW) showPreset(playlist.next(), false);
        });
        created.setSoftCutDuration(PRESET_BLEND_S);
        engine = created;
        applySwitching();
        return created;
      })
      .catch((err) => {
        logEvent("error", "presets", `Visualizer engine failed to start: ${errorMessage(err)}`);
        return null;
      });
  }
  return enginePromise;
}

async function ensurePresetList(): Promise<void> {
  const api = window.electronAPI;
  if (!api?.listPresets || listedFolder === state.presetFolder) return;
  listedFolder = state.presetFolder;
  presets = await api.listPresets(state.presetFolder).catch(() => []);
  playlist = new PresetPlaylist(presets.length);
}

async function showPreset(index: number | null, smooth: boolean): Promise<void> {
  if (index === null || !engine) return;
  const text = await window.electronAPI?.readPreset?.(index).catch(() => null);
  if (!text || !engine) return;
  engine.load(text, smooth);
  engine.setPresetDuration(PRESET_DURATION_S + Math.random() * PRESET_DURATION_SPREAD_S);
  failedInARow = 0;
  renderBar();
}

function renderFrame(): void {
  if (!active || !engine) return;
  resizeCanvas();
  meterAnalysers[0].getFloatTimeDomainData(left);
  meterAnalysers[1].getFloatTimeDomainData(right);
  engine.addPcm(left, right);
  engine.render();
  frame = requestAnimationFrame(renderFrame);
}

function setStageVisible(visible: boolean): void {
  if (presetStage.hidden === !visible) return;
  const before = playerDisplay.offsetHeight;
  playerDisplay.classList.toggle("is-presets", visible);
  presetStage.hidden = !visible;
  const after = playerDisplay.offsetHeight;
  setDisplayExtraHeight(visible ? after - before : 0);
}

export async function enterPresetsMode(): Promise<void> {
  if (active) return;
  active = true;
  setStageVisible(true);
  resizeCanvas();
  showMessage(null);
  const [ready] = await Promise.all([ensureEngine(), ensurePresetList()]);
  if (!active) return;
  if (!ready) {
    showMessage("presetsUnavailable");
    return;
  }
  if (presets.length === 0) {
    showMessage("noPresets");
    return;
  }
  if (playlist.current === null) await showPreset(playlist.next(), false);
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(renderFrame);
  renderBar();
}

export function exitPresetsMode(): void {
  if (!active) return;
  active = false;
  cancelAnimationFrame(frame);
  setStageVisible(false);
}

export function nextPreset(): void {
  if (active) showPreset(playlist.next(), true);
}

export function previousPreset(): void {
  if (active) showPreset(playlist.previous(), true);
}

export function togglePresetLock(): void {
  if (!active) return;
  frozen = !frozen;
  applySwitching();
  renderBar();
}

export function setPresetAutoSwitch(enabled: boolean): void {
  state.presetAutoSwitch = enabled;
  applySwitching();
  persistConfig();
}

export function setPresetHardCuts(enabled: boolean): void {
  state.presetHardCuts = enabled;
  applySwitching();
  persistConfig();
}

export async function setPresetFolder(folder: string): Promise<void> {
  state.presetFolder = folder;
  persistConfig();
  if (!active) return;
  await ensurePresetList();
  showMessage(presets.length === 0 ? "noPresets" : null);
  await showPreset(playlist.next(), true);
}

export function refreshPresetsText(): void {
  if (!presetMessage.hidden && presetMessage.dataset.key) showMessage(presetMessage.dataset.key);
  renderBar();
}

export function initPresetsMode(cycleMode: () => void): void {
  onCycleMode = cycleMode;
  presetStage.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    onCycleMode();
  });
  presetPrevBtn.addEventListener("click", previousPreset);
  presetNextBtn.addEventListener("click", nextPreset);
}
