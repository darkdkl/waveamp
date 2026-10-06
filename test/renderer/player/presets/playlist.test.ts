import { describe, expect, it } from "vitest";
import { PresetPlaylist } from "../../../../src/renderer/player/presets/playlist";

function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("PresetPlaylist", () => {
  it("is empty without presets", () => {
    const playlist = new PresetPlaylist(0);
    expect(playlist.next()).toBeNull();
    expect(playlist.current).toBeNull();
  });

  it("never repeats the current preset", () => {
    const playlist = new PresetPlaylist(3, sequence([0.1, 0.1]));
    expect(playlist.next()).toBe(0);
    expect(playlist.next()).toBe(1);
  });

  it("goes back through history and forward again", () => {
    const playlist = new PresetPlaylist(10, sequence([0.25, 0.55, 0.85]));
    const first = playlist.next();
    const second = playlist.next();
    const third = playlist.next();
    expect(playlist.previous()).toBe(second);
    expect(playlist.previous()).toBe(first);
    expect(playlist.previous()).toBeNull();
    expect(playlist.next()).toBe(second);
    expect(playlist.next()).toBe(third);
  });
});
