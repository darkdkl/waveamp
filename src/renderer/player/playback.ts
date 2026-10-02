import { i18n } from "../i18n";
import {
  audio,
  durTime,
  fileInput,
  liveTag,
  nextBtn,
  pauseBtn,
  playBtn,
  prevBtn,
  seek,
  stopBtn,
  timeDisplay,
  trackTitle,
  volume,
} from "./dom";
import { state } from "./state";
import { formatTime, safeTrackUrl, trackDisplayName } from "./format";
import { resumeAudioContext, setVolume } from "./audioGraph";
import { logEvent } from "./log";
import { persistConfig } from "./config";
import { updateMediaSessionMetadata } from "./mediaSession";
import { getTrackSrc, releaseObjectUrl, renderPlaylist, scheduleTagRender } from "./playlist";
import { renderRadioFavorites, renderRadioResults } from "./radio/panel";
import { attemptRadioReconnect, cancelRadioReconnect, cycleFavorite } from "./radio/stream";
import { refreshCoverArt } from "./coverArt";

export function playAudio(): void {
  if (state.playbackMode === "local" && audio.error && state.queue[state.currentIndex]?.unplayable) {
    skipUnplayableTrack();
    return;
  }
  state.localPlayRequested = state.playbackMode === "local";
  resumeAudioContext();
  audio.play().catch(() => {});
}

function skipUnplayableTrack(): void {
  state.localPlayRequested = false;
  const next = state.currentIndex + state.skipDirection;
  if (next >= 0 && next < state.queue.length) loadTrack(next, true, state.skipDirection);
}

// trackTitle has no data-i18n (applyTranslations would overwrite the track name),
// so its text is always derived here.
export function updateTrackTitleText(): void {
  if (state.playbackMode === "radio" && state.currentStation) {
    trackTitle.textContent = state.currentStation.name;
  } else if (state.playbackMode === "local" && state.queue[state.currentIndex]) {
    trackTitle.textContent = trackDisplayName(state.queue[state.currentIndex]);
  } else {
    trackTitle.textContent = i18n.t("noTrack");
  }
  updateMediaSessionMetadata();
}

export function resetToNoTrackState(): void {
  releaseObjectUrl();
  state.playbackMode = "local";
  state.currentStation = null;
  liveTag.hidden = true;
  durTime.hidden = false;
  durTime.textContent = "00:00";
  timeDisplay.textContent = "00:00";
  seek.disabled = true;
  seek.value = "0";
  updateTrackTitleText();
  refreshCoverArt();
}

export function loadTrack(index: number, autoplay = true, direction: 1 | -1 = 1): void {
  if (index < 0 || index >= state.queue.length) return;
  state.skipDirection = direction;
  cancelRadioReconnect();
  state.playbackMode = "local";
  state.currentStation = null;
  durTime.hidden = false;
  liveTag.hidden = true;
  state.currentIndex = index;
  state.localPlayRequested = autoplay;
  const track = state.queue[index];
  const src = safeTrackUrl(getTrackSrc(track));
  if (src) {
    audio.src = src;
  } else {
    logEvent("error", "playlist", `"${track.name}" has an unsupported file URL`);
    audio.removeAttribute("src");
    track.unplayable = true;
  }
  updateTrackTitleText();
  refreshCoverArt();
  seek.disabled = false;
  renderPlaylist();
  renderRadioResults();
  renderRadioFavorites();
  if (autoplay) {
    playAudio();
  }
  persistConfig();
}

export function playPause(): void {
  if (state.playbackMode === "local" && state.queue.length === 0) {
    fileInput.click();
    return;
  }
  if (audio.paused) {
    playAudio();
  } else {
    audio.pause();
  }
}

export function stop(): void {
  audio.pause();
  if (state.playbackMode === "local") {
    audio.currentTime = 0;
  }
}

export function playNext(): void {
  if (state.playbackMode === "radio") {
    cycleFavorite(1);
    return;
  }
  if (state.currentIndex + 1 < state.queue.length) {
    loadTrack(state.currentIndex + 1);
  } else {
    stop();
  }
}

export function playPrev(): void {
  if (state.playbackMode === "radio") {
    cycleFavorite(-1);
    return;
  }
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (state.currentIndex - 1 >= 0) {
    loadTrack(state.currentIndex - 1, true, -1);
  } else {
    audio.currentTime = 0;
  }
}

export function initTransportControls(): void {
  playBtn.addEventListener("click", playAudio);
  pauseBtn.addEventListener("click", () => audio.pause());
  stopBtn.addEventListener("click", stop);
  prevBtn.addEventListener("click", playPrev);
  nextBtn.addEventListener("click", playNext);
}

export function initAudioEvents(): void {
  audio.addEventListener("timeupdate", () => {
    if (state.isSeeking || state.playbackMode === "radio") return;
    timeDisplay.textContent = formatTime(audio.currentTime);
    if (audio.duration) {
      seek.value = String(Math.floor((audio.currentTime / audio.duration) * 1000));
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    if (state.playbackMode === "radio") return;
    durTime.textContent = formatTime(audio.duration);
    const track = state.queue[state.currentIndex];
    if (track?.unplayable) {
      track.unplayable = false;
      renderPlaylist();
    }
    if (track && track.duration == null && isFinite(audio.duration)) {
      track.duration = audio.duration;
      scheduleTagRender();
    }
  });

  audio.addEventListener("ended", playNext);
}

export function initAudioErrorHandling(): void {
  // Not "stalled": it fires routinely while healthy streams buffer.
  audio.addEventListener("error", () => {
    if (state.playbackMode === "radio") {
      attemptRadioReconnect();
    } else if (audio.error && audio.error.code !== MediaError.MEDIA_ERR_ABORTED) {
      logEvent("error", "audio", `Local playback error (code ${audio.error.code}): ${audio.error.message}`);
      const track = state.queue[state.currentIndex];
      if (!track) return;
      track.unplayable = true;
      renderPlaylist();
      if (state.localPlayRequested) skipUnplayableTrack();
    }
  });
}

export function initSeekAndVolume(): void {
  seek.addEventListener("input", () => {
    state.isSeeking = true;
    if (audio.duration) {
      const t = (Number(seek.value) / 1000) * audio.duration;
      timeDisplay.textContent = formatTime(t);
    }
  });

  seek.addEventListener("change", () => {
    if (audio.duration) {
      audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
    }
    state.isSeeking = false;
  });

  volume.addEventListener("input", () => {
    setVolume(Number(volume.value));
    persistConfig();
  });
  setVolume(Number(volume.value));
}
