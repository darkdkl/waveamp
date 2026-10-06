import { audio, durTime, pauseBtn, playBtn, playStateIcon } from "./dom";
import { state } from "./state";
import { trackPosition } from "./trackTime";

type PlayState = "playing" | "paused" | "stopped";

const STATE_ICONS: Record<PlayState, string> = {
  playing: "M7 4l14 8-14 8z",
  paused: "M6 4h4v16H6zm8 0h4v16h-4z",
  stopped: "M5 5h14v14H5z",
};

let stopRequested = false;

function currentPlayState(): PlayState | null {
  const hasSource = state.playbackMode === "radio" ? !!state.currentStation : !!state.queue[state.currentIndex];
  if (!hasSource) return null;
  if (!audio.paused) return "playing";
  if (stopRequested || (state.playbackMode === "local" && trackPosition() === 0)) return "stopped";
  return "paused";
}

export function renderPlayState(): void {
  const current = currentPlayState();
  playStateIcon.hidden = !current;
  if (current && playStateIcon.dataset.state !== current) {
    playStateIcon.dataset.state = current;
    playStateIcon.querySelector("path")?.setAttribute("d", STATE_ICONS[current]);
  }
  durTime.classList.toggle("is-idle", current !== "playing");
  playBtn.classList.toggle("is-current", current === "playing");
  pauseBtn.classList.toggle("is-current", current === "paused");
}

export function markStopped(): void {
  stopRequested = true;
  renderPlayState();
}

export function initPlayState(): void {
  audio.addEventListener("play", () => {
    stopRequested = false;
    renderPlayState();
  });
  for (const event of ["playing", "pause", "ended", "emptied", "seeked", "loadedmetadata"]) {
    audio.addEventListener(event, renderPlayState);
  }
  renderPlayState();
}
