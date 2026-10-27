export type LiveState = "idle" | "listening" | "live" | "unavailable" | "failed";

export type LiveSignal = "pause" | "ended" | "emptied" | "play" | "waiting" | "playing";

export function isListening(state: LiveState): boolean {
  return state === "listening" || state === "live";
}

export function liveStateAfter(state: LiveState, signal: LiveSignal, streamBlocked: boolean): LiveState {
  if (!isListening(state)) return state;
  if (signal === "pause" || signal === "ended") return "idle";
  if (signal === "playing" && streamBlocked) return "unavailable";
  return state;
}

export function radioIdleState(streamBlocked: boolean): LiveState {
  return streamBlocked ? "unavailable" : "idle";
}
