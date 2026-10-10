import { trackTitle } from "./dom";
import { state } from "./state";
import { persistConfig } from "./config";
import { normalizeTitleScrollMode, normalizeTitleScrollSpeed, titleScrollPlan, TITLE_SCROLL_SEPARATOR } from "../../shared/titleScroll";

export type TitleKind = "track" | "station" | "status";

let text = "";
let kind: TitleKind = "status";
let animation: Animation | null = null;
let cycleMs = 0;
let observedWidth = 0;
const scrolledOnce: Record<TitleKind, string | null> = { track: null, station: null, status: null };

function stop(): void {
  animation?.cancel();
  animation = null;
  cycleMs = 0;
  trackTitle.classList.remove("is-scrolling");
  trackTitle.textContent = text;
}

function start(): void {
  stop();
  const mode = state.titleScroll;
  const textWidth = trackTitle.scrollWidth;
  const overflow = textWidth - trackTitle.clientWidth;
  if (mode === "off" || overflow <= 1) return;
  if (mode === "once" && scrolledOnce[kind] === text) return;
  const inner = document.createElement("span");
  inner.className = "display__track-scroll";
  inner.textContent = mode === "loop" ? text + TITLE_SCROLL_SEPARATOR + text : text;
  trackTitle.classList.add("is-scrolling");
  trackTitle.replaceChildren(inner);
  const plan = titleScrollPlan(mode, overflow, inner.offsetWidth - textWidth, state.titleScrollSpeed);
  if (!plan) return stop();
  if (mode === "once") scrolledOnce[kind] = text;
  cycleMs = plan.durationMs;
  const running = inner.animate(
    plan.keyframes.map((k) => ({ offset: k.offset, transform: `translateX(${k.x}px)` })),
    { duration: plan.durationMs, iterations: plan.iterations, easing: "linear" }
  );
  running.onfinish = () => {
    if (animation === running) stop();
  };
  animation = running;
}

export function setTrackTitleText(next: string, nextKind: TitleKind = "status"): void {
  text = next;
  kind = nextKind;
  trackTitle.textContent = next;
  start();
}

export function titleScrollCycleMs(): number {
  return cycleMs;
}

export function setTitleScroll(mode: unknown): void {
  state.titleScroll = normalizeTitleScrollMode(mode);
  scrolledOnce.track = scrolledOnce.station = scrolledOnce.status = null;
  start();
  persistConfig();
}

export function setTitleScrollSpeed(speed: unknown): void {
  state.titleScrollSpeed = normalizeTitleScrollSpeed(speed);
  start();
  persistConfig();
}

export function initTitleScroll(): void {
  new ResizeObserver(() => {
    if (trackTitle.clientWidth === observedWidth) return;
    observedWidth = trackTitle.clientWidth;
    start();
  }).observe(trackTitle);
}
