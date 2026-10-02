import { hotkeys } from "../hotkeys";
import { audio, fileInput, folderInput, volume } from "./dom";
import { state } from "./state";
import { setVolume } from "./audioGraph";
import { persistConfig } from "./config";
import { setEqOpen, setPlaylistOpen, setRadioOpen } from "./layout";
import { cycleVizMode } from "./visualizer";
import { playAudio, playNext, playPause, playPrev, stop } from "./playback";
import { openStationForm } from "./radio/stationForm";
import { toggleCurrentTrackSaved } from "./radio/savedTracks";
import { pushSettingsState } from "./settingsBridge";
import type { HotkeyConfig } from "../../shared/types";

const SEEK_STEP_SECONDS = 5;
const VOLUME_STEP = 5;
const REPEATABLE_HOTKEYS = new Set(["seekForward", "seekBackward", "volumeUp", "volumeDown"]);
const RANGE_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);
let volumeBeforeMute: number | null = null;

function changeVolumeBy(delta: number): void {
  const value = Math.max(0, Math.min(100, Number(volume.value) + delta));
  volume.value = String(value);
  setVolume(value);
  persistConfig();
}

function runHotkeyAction(action: string): void {
  switch (action) {
    case "playPause":
      playPause();
      break;
    case "play":
      if (audio.paused && audio.src) playAudio();
      break;
    case "pause":
      audio.pause();
      break;
    case "stop":
      stop();
      break;
    case "next":
      playNext();
      break;
    case "previous":
      playPrev();
      break;
    case "seekForward":
    case "seekBackward":
      if (state.playbackMode === "local" && isFinite(audio.duration)) {
        const delta = action === "seekForward" ? SEEK_STEP_SECONDS : -SEEK_STEP_SECONDS;
        audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + delta));
      }
      break;
    case "volumeUp":
      changeVolumeBy(VOLUME_STEP);
      break;
    case "volumeDown":
      changeVolumeBy(-VOLUME_STEP);
      break;
    case "mute":
      if (Number(volume.value) > 0) {
        volumeBeforeMute = Number(volume.value);
        changeVolumeBy(-volumeBeforeMute);
      } else {
        changeVolumeBy(volumeBeforeMute || 50);
        volumeBeforeMute = null;
      }
      break;
    case "toggleEq":
      setEqOpen(!state.eqOpen);
      break;
    case "togglePlaylist":
      setPlaylistOpen(!state.playlistOpen);
      break;
    case "toggleRadio":
      setRadioOpen(!state.radioOpen);
      break;
    case "openSettings":
      window.electronAPI?.openSettingsWindow?.();
      break;
    case "addFiles":
      fileInput.click();
      break;
    case "addFolder":
      folderInput.click();
      break;
    case "addStation":
      if (!state.radioOpen) setRadioOpen(true);
      openStationForm();
      break;
    case "saveTrack":
      toggleCurrentTrackSaved();
      break;
    case "cycleVisualizer":
      cycleVizMode();
      break;
  }
}

export async function applyGlobalHotkeys(): Promise<void> {
  if (!window.electronAPI?.setGlobalHotkeys) return;
  state.globalHotkeyFailures = await window.electronAPI.setGlobalHotkeys({
    enabled: state.hotkeyConfig.globalEnabled,
    bindings: state.hotkeyConfig.global,
  });
  pushSettingsState();
}

export function setHotkeys(config: Partial<HotkeyConfig> | null | undefined): void {
  state.hotkeyConfig = hotkeys.normalize(config);
  persistConfig();
  applyGlobalHotkeys();
}

export function initPlayerHotkeys(): void {
  document.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;
    const isRange = target instanceof HTMLInputElement && target.type === "range";
    if (isRange && RANGE_KEYS.has(e.code)) return;
    if (
      (target instanceof HTMLInputElement && !isRange) ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable
    ) {
      return;
    }
    const combo = hotkeys.comboFromEvent(e);
    if (!combo) return;
    // Focused buttons handle Space/Enter natively.
    if (target instanceof HTMLButtonElement && (combo === "Space" || combo === "Enter")) return;
    const local = state.hotkeyConfig.local;
    const action = Object.keys(local).find((id) => local[id] === combo);
    if (!action) return;
    e.preventDefault();
    if (e.repeat && !REPEATABLE_HOTKEYS.has(action)) return;
    runHotkeyAction(action);
  });

  window.electronAPI?.onHotkey?.((action) => runHotkeyAction(action));
}
