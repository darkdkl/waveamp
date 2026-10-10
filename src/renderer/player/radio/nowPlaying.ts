import { audio, saveTrackBtn, trackTitle } from "../dom";
import { state } from "../state";
import { safeStreamUrl } from "../format";
import { persistConfig } from "../config";
import { updateMediaSessionMetadata } from "../mediaSession";
import { renderSaveTrackButton, toggleCurrentTrackSaved } from "./savedTracks";
import { setTrackTitleText, titleScrollCycleMs } from "../titleScroll";

const TRACK_PHASE_MS = 8000;
const STATION_PHASE_MS = 4000;
const CROSSFADE_MS = 400;

let showingStation = false;
let phaseTimer: ReturnType<typeof setTimeout> | undefined;
let fadeTimer: ReturnType<typeof setTimeout> | undefined;
let pollingUrl: string | null = null;

function stopCycle(): void {
  clearTimeout(phaseTimer);
  clearTimeout(fadeTimer);
  showingStation = false;
  trackTitle.classList.remove("is-fading");
}

function schedulePhase(): void {
  phaseTimer = setTimeout(
    () => {
      trackTitle.classList.add("is-fading");
      fadeTimer = setTimeout(() => {
        showingStation = !showingStation;
        renderRadioTitle();
        trackTitle.classList.remove("is-fading");
        schedulePhase();
      }, CROSSFADE_MS / 2);
    },
    Math.max(showingStation ? STATION_PHASE_MS : TRACK_PHASE_MS, titleScrollCycleMs())
  );
}

export function resetRadioTitle(): void {
  trackTitle.classList.remove("is-station");
  trackTitle.removeAttribute("title");
  saveTrackBtn.hidden = true;
}

export function renderRadioTitle(): void {
  const station = state.currentStation;
  if (!station) return;
  const track = state.nowPlayingTitle;
  const showStation = !track || showingStation;
  setTrackTitleText(showStation ? station.name : track, showStation ? "station" : "track");
  trackTitle.classList.toggle("is-station", !!track && showingStation);
  trackTitle.title = track ? `${track}\n${station.name}` : station.name;
  renderSaveTrackButton();
}

function setNowPlayingTitle(title: string | null): void {
  if (title === state.nowPlayingTitle) return;
  state.nowPlayingTitle = title;
  stopCycle();
  if (state.playbackMode === "radio") renderRadioTitle();
  if (title) schedulePhase();
  updateMediaSessionMetadata();
}

function currentStreamUrl(): string | null {
  const station = state.currentStation;
  if (!state.radioTrackTitleEnabled || state.playbackMode !== "radio" || !station || audio.paused) return null;
  return safeStreamUrl(station.url);
}

export function syncNowPlayingPolling(): void {
  const url = currentStreamUrl();
  if (url === pollingUrl) return;
  pollingUrl = url;
  if (url) window.electronAPI?.startNowPlaying?.(url);
  else window.electronAPI?.stopNowPlaying?.();
}

export function clearNowPlaying(): void {
  pollingUrl = null;
  window.electronAPI?.stopNowPlaying?.();
  stopCycle();
  state.nowPlayingTitle = null;
  resetRadioTitle();
  updateMediaSessionMetadata();
}

export function setRadioTrackTitleEnabled(enabled: boolean): void {
  state.radioTrackTitleEnabled = enabled;
  if (enabled) {
    syncNowPlayingPolling();
  } else {
    pollingUrl = null;
    window.electronAPI?.stopNowPlaying?.();
    setNowPlayingTitle(null);
  }
  persistConfig();
}

export function initNowPlaying(): void {
  trackTitle.style.transitionDuration = `${CROSSFADE_MS / 2}ms`;
  audio.addEventListener("playing", syncNowPlayingPolling);
  audio.addEventListener("pause", () => {
    syncNowPlayingPolling();
    if (state.playbackMode === "radio") setNowPlayingTitle(null);
  });
  saveTrackBtn.addEventListener("click", toggleCurrentTrackSaved);
  window.electronAPI?.onNowPlaying?.((update) => {
    if (update.url === pollingUrl) setNowPlayingTitle(update.title);
  });
}
