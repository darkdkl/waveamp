import { audio, timeDisplay } from "./dom";
import { state } from "./state";
import { formatClock, formatTime } from "./format";
import { persistConfig } from "./config";

const TRACK_TIME_PHASE_MS = 10_000;
const CLOCK_PHASE_MS = 4000;
const CROSSFADE_MS = 400;
const COLON_BLINK_MS = 500;

let clockShown = false;
let tickTimer: ReturnType<typeof setTimeout> | undefined;
let phaseTimer: ReturnType<typeof setTimeout> | undefined;
let fadeTimer: ReturnType<typeof setTimeout> | undefined;

function renderClock(): void {
  const now = Date.now();
  timeDisplay.textContent = formatClock(new Date(now), now % 1000 < COLON_BLINK_MS);
}

function startTicking(): void {
  if (tickTimer) return;
  const tick = () => {
    renderClock();
    tickTimer = setTimeout(tick, COLON_BLINK_MS - (Date.now() % COLON_BLINK_MS));
  };
  tick();
}

function stopTicking(): void {
  clearTimeout(tickTimer);
  tickTimer = undefined;
}

function applyView(showClock: boolean): void {
  clockShown = showClock;
  if (showClock) {
    startTicking();
  } else {
    stopTicking();
    timeDisplay.textContent = formatTime(audio.currentTime);
  }
}

function stopCycle(): void {
  clearTimeout(phaseTimer);
  clearTimeout(fadeTimer);
  phaseTimer = undefined;
  timeDisplay.classList.remove("is-fading");
}

function schedulePhase(): void {
  phaseTimer = setTimeout(
    () => {
      timeDisplay.classList.add("is-fading");
      fadeTimer = setTimeout(() => {
        applyView(!clockShown);
        timeDisplay.classList.remove("is-fading");
        schedulePhase();
      }, CROSSFADE_MS / 2);
    },
    clockShown ? CLOCK_PHASE_MS : TRACK_TIME_PHASE_MS
  );
}

export function isClockShown(): boolean {
  return clockShown;
}

export function syncTimeDisplay(): void {
  if (state.playbackMode === "radio" && state.currentStation) {
    stopCycle();
    applyView(true);
    return;
  }
  const cycling = state.playerClockEnabled && !!state.queue[state.currentIndex] && !audio.paused;
  if (cycling) {
    if (!phaseTimer) schedulePhase();
    return;
  }
  stopCycle();
  applyView(false);
}

export function showTrackTimeNow(): void {
  if (state.playbackMode !== "local" || !clockShown) return;
  stopCycle();
  applyView(false);
}

export function setPlayerClockEnabled(enabled: boolean): void {
  state.playerClockEnabled = enabled;
  syncTimeDisplay();
  persistConfig();
}

export function initClock(): void {
  timeDisplay.style.transitionDuration = `${CROSSFADE_MS / 2}ms`;
  for (const event of ["play", "playing", "pause", "ended", "emptied"]) {
    audio.addEventListener(event, syncTimeDisplay);
  }
}
