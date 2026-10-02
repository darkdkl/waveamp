import { i18n } from "../../i18n";
import { audio, durTime, liveTag, seek, trackTitle } from "../dom";
import { state } from "../state";
import { safeStreamUrl } from "../format";
import { logEvent } from "../log";
import { persistConfig } from "../config";
import { playAudio, updateTrackTitleText } from "../playback";
import { renderRadioFavorites, renderRadioResults } from "./panel";
import { refreshCoverArt } from "../coverArt";
import { clearNowPlaying } from "./nowPlaying";
import { syncTimeDisplay } from "../clock";
import type { Station } from "../../../shared/types";

const RADIO_MAX_RECONNECT = 3;
let radioReconnectAttempts = 0;
let radioReconnectTimer: ReturnType<typeof setTimeout> | undefined;
// crossOrigin is needed for EQ/viz on radio, but stations without CORS headers
// won't play with it — retry once without it, losing EQ/viz for that station.
let radioCrossOriginFallbackTried = false;

export function cancelRadioReconnect(): void {
  clearTimeout(radioReconnectTimer);
}

function playStream(station: Station): void {
  const url = safeStreamUrl(station.url);
  if (!url) {
    logEvent("error", "radio", `"${station.name}" has an unsupported stream URL`);
    clearNowPlaying();
    trackTitle.textContent = station.name + i18n.t("noConnection");
    return;
  }
  audio.src = url;
  playAudio();
}

export function tuneStation(station: Station): void {
  clearTimeout(radioReconnectTimer);
  clearNowPlaying();
  state.playbackMode = "radio";
  state.currentStation = station;
  radioReconnectAttempts = 0;
  radioCrossOriginFallbackTried = false;
  audio.crossOrigin = "anonymous";

  updateTrackTitleText();
  refreshCoverArt();
  seek.disabled = true;
  seek.value = "0";
  syncTimeDisplay();
  durTime.hidden = true;
  liveTag.hidden = false;
  setLiveActive(false);

  renderRadioResults();
  renderRadioFavorites();

  playStream(station);

  if (!station.custom && window.electronAPI?.registerStationClick) {
    window.electronAPI.registerStationClick(station.stationuuid).catch(() => {});
  }

  persistConfig();
}

export function cycleFavorite(direction: number): void {
  const favorites = state.favoriteStations;
  if (favorites.length === 0) return;
  const idx = favorites.findIndex((s) => s.stationuuid === state.currentStation?.stationuuid);
  const nextIdx = idx === -1 ? 0 : (idx + direction + favorites.length) % favorites.length;
  tuneStation(favorites[nextIdx]);
}

export function attemptRadioReconnect(): void {
  const station = state.currentStation;
  if (!station) return;
  clearTimeout(radioReconnectTimer);
  clearNowPlaying();
  const errorInfo = audio.error ? `code ${audio.error.code}: ${audio.error.message}` : "unknown error";

  // A missing-CORS failure looks like a network error — retry once without crossOrigin.
  if (!radioCrossOriginFallbackTried) {
    radioCrossOriginFallbackTried = true;
    logEvent("info", "radio", `"${station.name}" failed with CORS (${errorInfo}), retrying without it`);
    audio.removeAttribute("crossorigin");
    playStream(station);
    return;
  }

  if (radioReconnectAttempts >= RADIO_MAX_RECONNECT) {
    logEvent("error", "radio", `"${station.name}" giving up after ${RADIO_MAX_RECONNECT} attempts (${errorInfo})`);
    trackTitle.textContent = station.name + i18n.t("noConnection");
    return;
  }
  radioReconnectAttempts += 1;
  logEvent(
    "warn",
    "radio",
    `"${station.name}" reconnect attempt ${radioReconnectAttempts}/${RADIO_MAX_RECONNECT} (${errorInfo})`
  );
  trackTitle.textContent = station.name + i18n.t("reconnecting");
  radioReconnectTimer = setTimeout(() => {
    if (state.playbackMode === "radio" && state.currentStation) playStream(state.currentStation);
  }, 1500);
}

function setLiveActive(active: boolean): void {
  liveTag.classList.toggle("is-idle", !active);
}

export function initRadioStream(): void {
  audio.addEventListener("playing", () => {
    setLiveActive(true);
    if (state.playbackMode !== "radio") return;
    radioReconnectAttempts = 0;
    updateTrackTitleText();
  });
  for (const event of ["pause", "waiting", "error", "emptied"]) {
    audio.addEventListener(event, () => setLiveActive(false));
  }
}
