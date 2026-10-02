import {
  eq,
  eqBtn,
  player,
  playlist,
  playlistBtn,
  playlistListFrame,
  playlistResizeHandle,
  radio,
  radioAddFrame,
  radioBtn,
  radioFavoritesFrame,
  radioResizeHandle,
  radioResultsFrame,
} from "./dom";
import { state } from "./state";
import { persistConfig } from "./config";
import { ensureRadioFilters } from "./radio/panel";

export const BASE_ZOOM = 0.855;
export const SCALE_MIN = 70;
export const SCALE_MAX = 150;
export const SCALE_STEP = 10;

const WINDOW_WIDTH_BASE = 480;
const LIST_MIN_HEIGHT = 60;
const LIST_MAX_HEIGHT = 1920;

let basePlayerHeight = 0;
let radioChromeOffset = 72;

export function syncElectronWindowSize(instant = false): void {
  if (!window.electronAPI) return;
  let target = basePlayerHeight;
  if (state.playlistOpen) target += playlist.scrollHeight;
  if (state.eqOpen) target += eq.scrollHeight;
  if (state.radioOpen) target += radio.scrollHeight;
  target *= state.uiScale;
  const targetWidth = WINDOW_WIDTH_BASE * state.uiScale;
  if ((instant || state.restoring) && window.electronAPI.resizeWindowInstant) {
    window.electronAPI.resizeWindowInstant(target, targetWidth);
  } else {
    window.electronAPI.resizeWindow(target, targetWidth);
  }
}

export function setPlaylistOpen(open: boolean): void {
  state.playlistOpen = open;
  playlist.classList.toggle("is-open", open);
  playlistBtn.classList.toggle("is-active", open);
  playlist.style.maxHeight = open ? playlist.scrollHeight + "px" : "0px";
  if (open && state.radioOpen) setRadioOpen(false);
  syncElectronWindowSize();
  persistConfig();
}

export function setEqOpen(open: boolean): void {
  state.eqOpen = open;
  eq.classList.toggle("is-open", open);
  eqBtn.classList.toggle("is-active", open);
  eq.style.maxHeight = open ? eq.scrollHeight + "px" : "0px";
  syncElectronWindowSize();
  persistConfig();
}

export function setRadioOpen(open: boolean): void {
  state.radioOpen = open;
  radio.classList.toggle("is-open", open);
  radioBtn.classList.toggle("is-active", open);
  radio.style.maxHeight = open ? radio.scrollHeight + "px" : "0px";
  if (open && state.playlistOpen) setPlaylistOpen(false);
  syncElectronWindowSize();
  if (open) ensureRadioFilters();
}

export function setScale(percent: number): void {
  state.uiScale = (percent / 100) * BASE_ZOOM;
  if (window.electronAPI?.setZoomFactor) {
    window.electronAPI.setZoomFactor(state.uiScale);
  } else {
    player.style.zoom = String(state.uiScale);
  }
  syncElectronWindowSize();
  persistConfig();
}

function activeRadioFrame(): HTMLElement {
  if (state.radioView === "add") return radioAddFrame;
  return state.radioView === "favorites" ? radioFavoritesFrame : radioResultsFrame;
}

function applyListHeight(px: number): void {
  const searchPx = Math.max(LIST_MIN_HEIGHT, px - radioChromeOffset);
  playlistListFrame.style.height = px + "px";
  radioResultsFrame.style.height = searchPx + "px";
  radioFavoritesFrame.style.height = px + "px";
  radioAddFrame.style.height = px + "px";
  if (state.playlistOpen) playlist.style.maxHeight = playlist.scrollHeight + "px";
  if (state.radioOpen) radio.style.maxHeight = radio.scrollHeight + "px";
}

let resizingList = false;
let resizeStartY = 0;
let resizeStartHeight = 0;

function startListResize(e: MouseEvent, handle: HTMLElement, section: HTMLElement, startHeight: number): void {
  resizingList = true;
  resizeStartY = e.clientY;
  resizeStartHeight = startHeight;
  handle.classList.add("is-active");
  section.classList.add("is-resizing");
  document.body.style.cursor = "ns-resize";
  e.preventDefault();
}

// Only the plain-web CSS zoom reports post-zoom sizes; Electron's native zoom doesn't.
function cssZoomFactor(): number {
  return window.electronAPI?.setZoomFactor ? 1 : state.uiScale;
}

export function initPanelToggles(): void {
  playlistBtn.addEventListener("click", () => {
    setPlaylistOpen(!state.playlistOpen);
  });
  eqBtn.addEventListener("click", () => {
    setEqOpen(!state.eqOpen);
  });
  radioBtn.addEventListener("click", () => {
    setRadioOpen(!state.radioOpen);
  });
}

export function initListResize(): void {
  radioChromeOffset =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--radio-chrome-offset")) || 72;

  playlistResizeHandle.addEventListener("mousedown", (e) => {
    const playlistHeight = playlistListFrame.getBoundingClientRect().height / cssZoomFactor();
    startListResize(e, playlistResizeHandle, playlist, playlistHeight);
  });

  radioResizeHandle.addEventListener("mousedown", (e) => {
    const radioHeight = activeRadioFrame().getBoundingClientRect().height / cssZoomFactor();
    const canonicalHeight = state.radioView === "search" ? radioHeight + radioChromeOffset : radioHeight;
    startListResize(e, radioResizeHandle, radio, canonicalHeight);
  });

  window.addEventListener("mousemove", (e) => {
    if (!resizingList) return;
    const delta = (e.clientY - resizeStartY) / cssZoomFactor();
    const newHeight = Math.min(LIST_MAX_HEIGHT, Math.max(LIST_MIN_HEIGHT, resizeStartHeight + delta));
    applyListHeight(newHeight);
    syncElectronWindowSize(true);
  });

  window.addEventListener("mouseup", () => {
    if (!resizingList) return;
    resizingList = false;
    playlistResizeHandle.classList.remove("is-active");
    radioResizeHandle.classList.remove("is-active");
    playlist.classList.remove("is-resizing");
    radio.classList.remove("is-resizing");
    document.body.style.cursor = "";
  });
}

export function measurePlayerHeight(): void {
  basePlayerHeight = player.offsetHeight;
}
