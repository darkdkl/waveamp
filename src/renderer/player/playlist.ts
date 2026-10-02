import { i18n } from "../i18n";
import {
  addFilesMenuItem,
  addFolderMenuItem,
  audio,
  fileInput,
  folderInput,
  player,
  playlist,
  playlistAddBtn,
  playlistAddMenu,
  playlistAddWrap,
  playlistClearBtn,
  playlistEmpty,
  playlistList,
} from "./dom";
import { state, type Track } from "./state";
import { formatTime, isAddableAudioFile, trackDisplayName, trackLabel } from "./format";
import { logEvent } from "./log";
import { persistConfig } from "./config";
import { syncElectronWindowSize } from "./layout";
import { createDropdown } from "./dropdown";
import { loadTrack, resetToNoTrackState, stop, updateTrackTitleText } from "./playback";

const TAG_READ_CONCURRENCY = 4;

export async function loadTrackTags(tracks: Track[]): Promise<void> {
  const api = window.electronAPI;
  if (!api?.readTrackTags) return;
  const pending = tracks.filter((track): track is Track & { path: string } => !!track.path);
  const worker = async () => {
    for (let track = pending.shift(); track; track = pending.shift()) {
      const tags = await api.readTrackTags(track.path);
      if (!tags) continue;
      track.tags = tags;
      if (track.duration == null) track.duration = tags.duration;
      scheduleTagRender();
    }
  };
  await Promise.all(Array.from({ length: TAG_READ_CONCURRENCY }, worker));
}

let tagRenderQueued = false;

export function scheduleTagRender(): void {
  if (tagRenderQueued) return;
  tagRenderQueued = true;
  requestAnimationFrame(() => {
    tagRenderQueued = false;
    const scrollTop = playlistList.scrollTop;
    renderPlaylist();
    playlistList.scrollTop = scrollTop;
    updateTrackTitleText();
  });
}

let lastObjectUrl: string | null = null;

export function getTrackSrc(track: Track): string {
  if (track.path && window.electronAPI?.getFileUrl) {
    return window.electronAPI.getFileUrl(track.path);
  }
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  lastObjectUrl = URL.createObjectURL(track.file as File);
  return lastObjectUrl;
}

export function releaseObjectUrl(): void {
  if (lastObjectUrl) {
    URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = null;
  }
}

export function renderPlaylist(): void {
  playlistList.innerHTML = "";
  playlistEmpty.hidden = state.queue.length > 0;
  playlistList.hidden = state.queue.length === 0;

  state.queue.forEach((track, index) => {
    const item = document.createElement("li");
    item.className =
      "playlist__item" +
      (index === state.currentIndex ? " is-active" : "") +
      (track.unplayable ? " is-unplayable" : "");
    if (track.unplayable) item.title = i18n.t("trackUnplayable");

    const idx = document.createElement("span");
    idx.className = "playlist__item-index";
    idx.textContent = String(index + 1);

    const name = document.createElement("span");
    name.className = "playlist__item-name";
    name.textContent = trackDisplayName(track);

    const duration = document.createElement("span");
    duration.className = "playlist__item-duration";
    duration.textContent = track.duration != null ? formatTime(track.duration) : "";

    const remove = document.createElement("button");
    remove.className = "playlist__item-remove";
    remove.type = "button";
    remove.title = i18n.t("removeFromPlaylist");
    remove.setAttribute("aria-label", i18n.t("removeFromPlaylist"));
    remove.textContent = "✕";
    remove.addEventListener("click", (e) => {
      e.stopPropagation();
      removeTrack(index);
    });

    item.append(idx, name, duration, remove);
    item.addEventListener("click", () => loadTrack(index));
    playlistList.appendChild(item);
  });

  if (state.playlistOpen) {
    playlist.style.maxHeight = playlist.scrollHeight + "px";
  }
  syncElectronWindowSize();
}

function removeTrack(index: number): void {
  const removingCurrent = state.playbackMode === "local" && index === state.currentIndex;
  state.queue.splice(index, 1);

  if (state.queue.length === 0) {
    state.currentIndex = -1;
    if (state.playbackMode === "local") {
      stop();
      audio.removeAttribute("src");
      audio.load();
      resetToNoTrackState();
    }
    renderPlaylist();
    persistConfig();
    return;
  }

  if (removingCurrent) {
    loadTrack(Math.min(index, state.queue.length - 1));
    return;
  }

  if (state.playbackMode === "local" && index < state.currentIndex) {
    state.currentIndex -= 1;
  }
  renderPlaylist();
  persistConfig();
}

function clearPlaylist(): void {
  state.queue = [];
  state.currentIndex = -1;
  if (state.playbackMode === "local") {
    stop();
    audio.removeAttribute("src");
    audio.load();
    resetToNoTrackState();
  }
  renderPlaylist();
  persistConfig();
}

function addFiles(fileList: FileList | File[]): void {
  const files = Array.from(fileList).filter(isAddableAudioFile);
  if (files.length === 0) return;
  const wasEmpty = state.queue.length === 0;
  const tracks = files.map((file) => {
    const path = window.electronAPI?.getFilePath ? window.electronAPI.getFilePath(file) : null;
    if (window.electronAPI?.getFilePath && !path) {
      logEvent("warn", "playlist", `Could not resolve a file path for "${file.name}"`);
    }
    return { name: trackLabel(file.name), file, path };
  });
  state.queue.push(...tracks);
  renderPlaylist();
  if (wasEmpty) {
    loadTrack(0);
  }
  persistConfig();
  loadTrackTags(tracks);
}

export function initPlaylistAddMenu(): void {
  const setAddMenuOpen = createDropdown(playlistAddBtn, playlistAddMenu, playlistAddWrap);

  addFilesMenuItem.addEventListener("click", () => {
    setAddMenuOpen(false);
    fileInput.click();
  });

  addFolderMenuItem.addEventListener("click", () => {
    setAddMenuOpen(false);
    folderInput.click();
  });

  playlistClearBtn.addEventListener("click", () => {
    setAddMenuOpen(false);
    clearPlaylist();
  });
}

export function initFileInputs(): void {
  fileInput.addEventListener("change", () => {
    addFiles(fileInput.files ?? []);
    fileInput.value = "";
  });

  folderInput.addEventListener("change", () => {
    addFiles(folderInput.files ?? []);
    folderInput.value = "";
  });
}

export function initDragAndDrop(): void {
  ["dragenter", "dragover"].forEach((evt) => {
    player.addEventListener(evt, (e) => {
      e.preventDefault();
      player.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    player.addEventListener(evt, (e) => {
      e.preventDefault();
      if (evt === "dragleave" && e.target !== player) return;
      player.classList.remove("is-dragover");
    });
  });

  player.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  });
}
