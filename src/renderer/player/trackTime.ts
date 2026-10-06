import { audio } from "./dom";
import { state, type Track } from "./state";

function currentLocalTrack(): Track | undefined {
  return state.playbackMode === "local" ? state.queue[state.currentIndex] : undefined;
}

export function trackStart(): number {
  return currentLocalTrack()?.start ?? 0;
}

export function trackLength(): number {
  const track = currentLocalTrack();
  const end = track?.end ?? audio.duration;
  return end - (track?.start ?? 0);
}

export function trackPosition(): number {
  return Math.max(0, audio.currentTime - trackStart());
}

export function seekTrack(seconds: number): void {
  const length = trackLength();
  const clamped = isFinite(length) ? Math.min(length, seconds) : seconds;
  audio.currentTime = trackStart() + Math.max(0, clamped);
}
