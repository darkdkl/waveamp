import appIconUrl from "../../../assets/icon.png";
import { audio } from "./dom";
import { state } from "./state";
import { playAudio, playNext, playPause, playPrev, stop } from "./playback";

// MediaMetadata artwork rejects file:// URLs, so use a blob: URL.
let appIconArtworkUrl: string | null = null;

export function updateMediaSessionMetadata(): void {
  if (!("mediaSession" in navigator)) return;
  const station = state.currentStation;
  if (state.playbackMode === "radio" && station) {
    const artSrc = station.favicon || appIconArtworkUrl;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: [station.country, station.tags].filter(Boolean).join(" · ") || "WaveAMP Radio",
      album: "WaveAMP",
      artwork: artSrc ? [{ src: artSrc, sizes: "any", type: "" }] : [],
    });
  } else if (state.playbackMode === "local" && state.queue[state.currentIndex]) {
    const track = state.queue[state.currentIndex];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.tags?.title || track.name,
      artist: track.tags?.artist || "WaveAMP",
      album: track.tags?.album || "",
      artwork: appIconArtworkUrl ? [{ src: appIconArtworkUrl, sizes: "1024x1024", type: "image/png" }] : [],
    });
  } else {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
  }
}

export function loadMediaSessionArtwork(): void {
  if (!("mediaSession" in navigator)) return;
  fetch(appIconUrl)
    .then((r) => r.blob())
    .then((blob) => {
      appIconArtworkUrl = URL.createObjectURL(blob);
      updateMediaSessionMetadata();
    })
    .catch(() => {});
}

function registerMediaSessionActionHandlers(): void {
  navigator.mediaSession.setActionHandler("play", () => playAudio());
  navigator.mediaSession.setActionHandler("pause", () => audio.pause());
  navigator.mediaSession.setActionHandler("stop", () => stop());
  navigator.mediaSession.setActionHandler("previoustrack", () => playPrev());
  navigator.mediaSession.setActionHandler("nexttrack", () => playNext());
}

export function initMediaSession(): void {
  if ("mediaSession" in navigator) {
    audio.addEventListener("play", () => {
      navigator.mediaSession.playbackState = "playing";
    });
    audio.addEventListener("pause", () => {
      navigator.mediaSession.playbackState = "paused";
    });

    // A failed station can make Chromium drop the OS media-key registration;
    // re-set the handlers on every "playing".
    audio.addEventListener("playing", registerMediaSessionActionHandlers);
    registerMediaSessionActionHandlers();
  }

  window.electronAPI?.onMediaKey?.((action) => {
    if (action === "playpause") playPause();
    else if (action === "next") playNext();
    else if (action === "previous") playPrev();
    else if (action === "stop") stop();
  });
}
