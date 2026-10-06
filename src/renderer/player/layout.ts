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
  radioSavedFrame,
  windowEdgeResize,
  windowGripResize,
} from "./dom";
import { state } from "./state";
import { persistConfig } from "./config";
import { ensureRadioFilters } from "./radio/panel";

export const BASE_ZOOM = 0.855;
export const SCALE_MIN = 70;
export const SCALE_MAX = 150;
export const SCALE_STEP = 10;

const WINDOW_WIDTH_BASE = 480;
const LIST_MIN_HEIGHT = 240;
const FRAME_MIN_HEIGHT = 60;
const LIST_MAX_HEIGHT = 1920;

let basePlayerHeight = 0;
let displayExtraHeight = 0;
let windowSizeFrozen = false;
let radioChromeOffset = 72;
let radioSavedOffset = 38;

export function syncElectronWindowSize(instant = false): void {
  if (!window.electronAPI || windowSizeFrozen) return;
  let target = basePlayerHeight + displayExtraHeight;
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
  if (state.radioView === "saved") return radioSavedFrame;
  return state.radioView === "favorites" ? radioFavoritesFrame : radioResultsFrame;
}

function activeRadioOffset(): number {
  if (state.radioView === "search") return radioChromeOffset;
  return state.radioView === "saved" ? radioSavedOffset : 0;
}

function applyListHeight(px: number): void {
  const searchPx = Math.max(FRAME_MIN_HEIGHT, px - radioChromeOffset);
  playlistListFrame.style.height = px + "px";
  radioResultsFrame.style.height = searchPx + "px";
  radioFavoritesFrame.style.height = px + "px";
  radioAddFrame.style.height = px + "px";
  radioSavedFrame.style.height = Math.max(FRAME_MIN_HEIGHT, px - radioSavedOffset) + "px";
  if (state.playlistOpen) playlist.style.maxHeight = playlist.scrollHeight + "px";
  if (state.radioOpen) radio.style.maxHeight = radio.scrollHeight + "px";
}

let resizingList = false;
let resizeStartY = 0;
let resizeStartHeight = 0;
let activeResizeHandle: HTMLElement | null = null;

function startListResize(e: MouseEvent, handle: HTMLElement, section: HTMLElement, startHeight: number, cursor = "ns-resize"): void {
  resizingList = true;
  resizeStartY = e.clientY;
  resizeStartHeight = startHeight;
  activeResizeHandle = handle;
  handle.classList.add("is-active");
  section.classList.add("is-resizing");
  document.body.style.cursor = cursor;
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
  const rootStyle = getComputedStyle(document.documentElement);
  radioChromeOffset = parseFloat(rootStyle.getPropertyValue("--radio-chrome-offset")) || 72;
  radioSavedOffset = parseFloat(rootStyle.getPropertyValue("--radio-saved-offset")) || 38;

  const startPlaylistResize = (e: MouseEvent, handle: HTMLElement, cursor?: string) => {
    const playlistHeight = playlistListFrame.getBoundingClientRect().height / cssZoomFactor();
    startListResize(e, handle, playlist, playlistHeight, cursor);
  };
  const startRadioResize = (e: MouseEvent, handle: HTMLElement, cursor?: string) => {
    const radioHeight = activeRadioFrame().getBoundingClientRect().height / cssZoomFactor();
    startListResize(e, handle, radio, radioHeight + activeRadioOffset(), cursor);
  };
  const startOpenListResize = (e: MouseEvent, handle: HTMLElement, cursor: string) => {
    if (state.radioOpen) startRadioResize(e, handle, cursor);
    else if (state.playlistOpen) startPlaylistResize(e, handle, cursor);
  };

  playlistResizeHandle.addEventListener("mousedown", (e) => startPlaylistResize(e, playlistResizeHandle));
  radioResizeHandle.addEventListener("mousedown", (e) => startRadioResize(e, radioResizeHandle));
  windowEdgeResize.addEventListener("mousedown", (e) => startOpenListResize(e, windowEdgeResize, "ns-resize"));
  windowGripResize.addEventListener("mousedown", (e) => startOpenListResize(e, windowGripResize, "nwse-resize"));

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
    activeResizeHandle?.classList.remove("is-active");
    activeResizeHandle = null;
    playlist.classList.remove("is-resizing");
    radio.classList.remove("is-resizing");
    document.body.style.cursor = "";
  });
}

export function setWindowSizeFrozen(frozen: boolean): void {
  windowSizeFrozen = frozen;
  if (!frozen) syncElectronWindowSize();
}

export function setDisplayExtraHeight(px: number): void {
  displayExtraHeight = Math.max(0, px);
  syncElectronWindowSize();
}

export function measurePlayerHeight(): void {
  basePlayerHeight = player.offsetHeight;
}
