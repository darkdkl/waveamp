import { describe, expect, it } from "vitest";
import { liveStateAfter, radioIdleState, type LiveSignal, type LiveState } from "../../../src/renderer/player/chordsLive";

function run(state: LiveState, signals: LiveSignal[], blocked = false): LiveState {
  return signals.reduce((current, signal) => liveStateAfter(current, signal, blocked), state);
}

describe("live chord state", () => {
  it("keeps listening through a stream reconnect", () => {
    const reconnect: LiveSignal[] = ["emptied", "play", "waiting", "playing"];
    expect(run("live", reconnect)).toBe("live");
    expect(run("listening", reconnect)).toBe("listening");
  });

  it("stops when the user pauses or the stream ends", () => {
    expect(run("live", ["pause"])).toBe("idle");
    expect(run("listening", ["ended"])).toBe("idle");
  });

  it("gives up when the stream comes back without CORS", () => {
    expect(run("live", ["emptied", "play", "playing"], true)).toBe("unavailable");
  });

  it("leaves other states alone", () => {
    for (const state of ["idle", "unavailable", "failed"] as LiveState[]) expect(run(state, ["pause", "playing"], true)).toBe(state);
  });

  it("offers detection only for stations that allow it", () => {
    expect(radioIdleState(false)).toBe("idle");
    expect(radioIdleState(true)).toBe("unavailable");
  });
});
