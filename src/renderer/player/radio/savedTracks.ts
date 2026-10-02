import { i18n } from "../../i18n";
import {
  liveTag,
  radio,
  radioSavedCount,
  radioSavedEmpty,
  radioSavedList,
  radioSavedMenu,
  radioSavedMenuBtn,
  radioSavedMenuWrap,
  saveTrackBtn,
  savedClearBtn,
  savedCopyAllBtn,
} from "../dom";
import { state } from "../state";
import { syncElectronWindowSize } from "../layout";
import { createDropdown } from "../dropdown";
import { normalizeSavedTracks, savedTrackKey } from "../../../shared/savedTracks";
import type { SavedTrack } from "../../../shared/types";

const COPY_FEEDBACK_MS = 1000;

function copyText(text: string): void {
  const api = window.electronAPI;
  if (api?.copyText) api.copyText(text);
  else navigator.clipboard?.writeText(text).catch(() => {});
}

function savedIndex(title: string): number {
  const key = savedTrackKey(title);
  return state.savedTracks.findIndex((track) => savedTrackKey(track.title) === key);
}

function savedTracksChanged(): void {
  window.electronAPI?.saveSavedTracks?.(state.savedTracks);
  renderSavedTracks();
  renderSaveTrackButton();
}

export function renderSaveTrackButton(): void {
  const title = state.playbackMode === "radio" ? state.nowPlayingTitle : null;
  saveTrackBtn.hidden = !title;
  if (!title) return;
  const saved = savedIndex(title) >= 0;
  saveTrackBtn.classList.toggle("is-saved", saved);
  saveTrackBtn.title = i18n.t(saved ? "unsaveTrack" : "saveTrack");
  saveTrackBtn.setAttribute("aria-label", saveTrackBtn.title);
  saveTrackBtn.setAttribute("aria-pressed", String(saved));
  if (liveTag.offsetWidth) saveTrackBtn.style.width = liveTag.offsetWidth + "px";
}

export function toggleCurrentTrackSaved(): void {
  const title = state.playbackMode === "radio" ? state.nowPlayingTitle : null;
  if (!title) return;
  const index = savedIndex(title);
  if (index >= 0) {
    state.savedTracks.splice(index, 1);
  } else {
    state.savedTracks.unshift({ title, station: state.currentStation?.name ?? "", savedAt: Date.now() });
  }
  savedTracksChanged();
}

function removeSavedTrack(track: SavedTrack): void {
  const index = savedIndex(track.title);
  if (index < 0) return;
  state.savedTracks.splice(index, 1);
  savedTracksChanged();
}

async function clearSavedTracks(): Promise<void> {
  if (state.savedTracks.length === 0) return;
  const message = i18n.t("clearSavedTracksConfirm");
  const api = window.electronAPI;
  const confirmed = api?.confirm
    ? await api.confirm(message, i18n.t("yes"), i18n.t("cancel"))
    : window.confirm(message);
  if (!confirmed) return;
  state.savedTracks = [];
  savedTracksChanged();
}

function createSavedRow(track: SavedTrack): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "radio__item";

  const meta = document.createElement("div");
  meta.className = "radio__meta";
  const name = document.createElement("div");
  name.className = "radio__name";
  name.textContent = track.title;
  const sub = document.createElement("div");
  sub.className = "radio__sub";
  sub.textContent = track.station;
  meta.append(name, sub);

  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  const copy = () => {
    copyText(track.title);
    clearTimeout(feedbackTimer);
    li.classList.add("is-copied");
    sub.textContent = i18n.t("copied");
    feedbackTimer = setTimeout(() => {
      li.classList.remove("is-copied");
      sub.textContent = track.station;
    }, COPY_FEEDBACK_MS);
  };

  const copyBtn = document.createElement("button");
  copyBtn.className = "radio__fav-btn";
  copyBtn.type = "button";
  copyBtn.textContent = "⧉";
  copyBtn.title = i18n.t("copyTitle");
  copyBtn.setAttribute("aria-label", copyBtn.title);
  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    copy();
  });

  const removeBtn = document.createElement("button");
  removeBtn.className = "playlist__item-remove";
  removeBtn.type = "button";
  removeBtn.textContent = "✕";
  removeBtn.title = i18n.t("removeSavedTrack");
  removeBtn.setAttribute("aria-label", removeBtn.title);
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeSavedTrack(track);
  });

  li.append(meta, copyBtn, removeBtn);
  li.addEventListener("click", copy);
  return li;
}

export function renderSavedTracks(): void {
  const tracks = state.savedTracks;
  radioSavedList.innerHTML = "";
  tracks.forEach((track) => radioSavedList.appendChild(createSavedRow(track)));
  radioSavedList.hidden = tracks.length === 0;
  radioSavedEmpty.hidden = tracks.length > 0;
  radioSavedCount.hidden = tracks.length === 0;
  radioSavedCount.textContent = String(tracks.length);
  savedCopyAllBtn.disabled = tracks.length === 0;
  savedClearBtn.disabled = tracks.length === 0;
  if (state.radioOpen && state.radioView === "saved") {
    radio.style.maxHeight = radio.scrollHeight + "px";
    syncElectronWindowSize();
  }
}

export async function loadSavedTracks(): Promise<void> {
  if (!window.electronAPI?.loadSavedTracks) return;
  state.savedTracks = normalizeSavedTracks(await window.electronAPI.loadSavedTracks().catch(() => []));
  renderSavedTracks();
  renderSaveTrackButton();
}

export function initSavedTracks(): void {
  const setMenuOpen = createDropdown(radioSavedMenuBtn, radioSavedMenu, radioSavedMenuWrap);
  savedCopyAllBtn.addEventListener("click", () => {
    setMenuOpen(false);
    copyText(state.savedTracks.map((track) => track.title).join("\n"));
  });
  savedClearBtn.addEventListener("click", () => {
    setMenuOpen(false);
    clearSavedTracks();
  });
  renderSavedTracks();
}
