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
import { state, type Track } from "./state";
import { formatTime, safeTrackUrl, trackDisplayName } from "./format";
import { resumeAudioContext, setVolume } from "./audioGraph";
import { logEvent } from "./log";
import { persistConfig } from "./config";
import { updateMediaSessionMetadata } from "./mediaSession";
import { getTrackSrc, releaseObjectUrl, renderPlaylist, scheduleTagRender } from "./playlist";
import { renderRadioFavorites, renderRadioResults } from "./radio/panel";
import { attemptRadioReconnect, cancelRadioReconnect, cycleFavorite } from "./radio/stream";
import { refreshCoverArt } from "./coverArt";
import { clearNowPlaying, renderRadioTitle, resetRadioTitle } from "./radio/nowPlaying";
import { isClockShown, showTrackTimeNow, syncTimeDisplay } from "./clock";
import { markStopped, renderPlayState } from "./playState";
import { seekTrack, trackLength, trackPosition, trackStart } from "./trackTime";

const SEGMENT_JOIN_TOLERANCE = 0.05;
const SEGMENT_TIMER_WINDOW = 1;

let loadedSrc: string | null = null;
let pendingStart: number | null = null;
let segmentTimer: ReturnType<typeof setTimeout> | undefined;

function renderDuration(): void {
  const length = trackLength();
  if (isFinite(length)) durTime.textContent = formatTime(length);
}

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
    renderRadioTitle();
  } else {
    resetRadioTitle();
    trackTitle.textContent =
      state.playbackMode === "local" && state.queue[state.currentIndex]
        ? trackDisplayName(state.queue[state.currentIndex])
        : i18n.t("noTrack");
  }
  renderPlayState();
  updateMediaSessionMetadata();
}

export function resetToNoTrackState(): void {
  releaseObjectUrl();
  clearNowPlaying();
  state.playbackMode = "local";
  state.currentStation = null;
  liveTag.hidden = true;
  durTime.hidden = false;
  durTime.textContent = "00:00";
  timeDisplay.textContent = "00:00";
  loadedSrc = null;
  pendingStart = null;
  syncTimeDisplay();
  seek.disabled = true;
  seek.value = "0";
  updateTrackTitleText();
  refreshCoverArt();
}

export function loadTrack(index: number, autoplay = true, direction: 1 | -1 = 1): void {
  if (index < 0 || index >= state.queue.length) return;
  state.skipDirection = direction;
  cancelRadioReconnect();
  clearNowPlaying();
  state.playbackMode = "local";
  state.currentStation = null;
  durTime.hidden = false;
  liveTag.hidden = true;
  state.currentIndex = index;
  syncTimeDisplay();
  state.localPlayRequested = autoplay;
  const track = state.queue[index];
  const src = safeTrackUrl(getTrackSrc(track));
  if (src && src === loadedSrc && track.start != null && audio.readyState > 0 && !audio.error) {
    pendingStart = null;
    audio.currentTime = track.start;
    renderDuration();
  } else if (src) {
    loadedSrc = src;
    pendingStart = track.start ?? null;
    audio.src = src;
  } else {
    logEvent("error", "playlist", `"${track.name}" has an unsupported file URL`);
    loadedSrc = null;
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
  markStopped();
  if (state.playbackMode === "local") {
    audio.currentTime = trackStart();
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
  if (trackPosition() > 3) {
    seekTrack(0);
    return;
  }
  if (state.currentIndex - 1 >= 0) {
    loadTrack(state.currentIndex - 1, true, -1);
  } else {
    seekTrack(0);
  }
}

function continueIntoNextSegment(): boolean {
  const track = state.queue[state.currentIndex];
  const next = state.queue[state.currentIndex + 1];
  if (!track || track.end == null || !next || next.path !== track.path || next.start == null) return false;
  if (Math.abs(next.start - track.end) > SEGMENT_JOIN_TOLERANCE) return false;
  state.currentIndex += 1;
  renderDuration();
  updateTrackTitleText();
  renderPlaylist();
  persistConfig();
  return true;
}

function checkSegmentEnd(): void {
  clearTimeout(segmentTimer);
  const track = state.playbackMode === "local" ? state.queue[state.currentIndex] : undefined;
  if (!track || track.end == null || audio.paused || state.isSeeking) return;
  const remaining = track.end - audio.currentTime;
  if (remaining <= 0) {
    if (!continueIntoNextSegment()) playNext();
  } else if (remaining < SEGMENT_TIMER_WINDOW) {
    segmentTimer = setTimeout(checkSegmentEnd, (remaining / (audio.playbackRate || 1)) * 1000);
  }
}

export function initTransportControls(): void {
  playBtn.addEventListener("click", () => {
    if (state.playbackMode === "local" && state.queue.length === 0) fileInput.click();
    else playAudio();
  });
  pauseBtn.addEventListener("click", () => audio.pause());
  stopBtn.addEventListener("click", stop);
  prevBtn.addEventListener("click", playPrev);
  nextBtn.addEventListener("click", playNext);
}

export function initAudioEvents(): void {
  audio.addEventListener("timeupdate", () => {
    checkSegmentEnd();
    if (state.isSeeking || state.playbackMode === "radio" || isClockShown()) return;
    timeDisplay.textContent = formatTime(trackPosition());
    const length = trackLength();
    if (length > 0 && isFinite(length)) {
      seek.value = String(Math.floor((trackPosition() / length) * 1000));
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    if (state.playbackMode === "radio") return;
    if (pendingStart !== null) {
      audio.currentTime = pendingStart;
      pendingStart = null;
    }
    renderDuration();
    const track = state.queue[state.currentIndex];
    if (track?.unplayable) {
      track.unplayable = false;
      renderPlaylist();
    }
    if (track && track.duration == null && isFinite(trackLength())) {
      track.duration = trackLength();
      scheduleTagRender();
    }
  });

  audio.addEventListener("ended", playNext);
}

const MP4_AUDIO_RE = /\.(m4a|m4b|mp4)$/i;

function canTryAlac(track: Track, code: number): boolean {
  return (
    !track.alac &&
    !!track.path &&
    MP4_AUDIO_RE.test(track.path) &&
    !!window.electronAPI?.getAlacUrl &&
    (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || code === MediaError.MEDIA_ERR_DECODE)
  );
}

export function initAudioErrorHandling(): void {
  // Not "stalled": it fires routinely while healthy streams buffer.
  audio.addEventListener("error", () => {
    if (state.playbackMode === "radio") {
      attemptRadioReconnect();
    } else if (audio.error && audio.error.code !== MediaError.MEDIA_ERR_ABORTED) {
      const track = state.queue[state.currentIndex];
      if (track && canTryAlac(track, audio.error.code)) {
        for (const other of state.queue) if (other.path === track.path) other.alac = true;
        loadTrack(state.currentIndex, state.localPlayRequested, state.skipDirection);
        return;
      }
      logEvent("error", "audio", `Local playback error (code ${audio.error.code}): ${audio.error.message}`);
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
    showTrackTimeNow();
    const length = trackLength();
    if (length > 0 && isFinite(length)) {
      timeDisplay.textContent = formatTime((Number(seek.value) / 1000) * length);
    }
  });

  seek.addEventListener("change", () => {
    const length = trackLength();
    if (length > 0 && isFinite(length)) {
      seekTrack((Number(seek.value) / 1000) * length);
    }
    state.isSeeking = false;
    syncTimeDisplay();
  });

  volume.addEventListener("input", () => {
    setVolume(Number(volume.value));
    persistConfig();
  });
  setVolume(Number(volume.value));
}
