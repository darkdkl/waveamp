import { describe, expect, it } from "vitest";
import { dragMoved, NO_DRAG, startsDrag, type DragNode } from "../../../src/renderer/player/dragHandle";

const blocked = NO_DRAG.split(", ");

function node(...selectors: string[]): DragNode {
  return { matches: (selector) => selector.split(", ").some((part) => selectors.includes(part)) };
}

const root = node(".player");

describe("startsDrag", () => {
  it("drags from empty space and from plain text or icons inside it", () => {
    expect(startsDrag([root])).toBe(true);
    expect(startsDrag([node(".player__logo-accent"), node(".player__logo"), node(".player__titlebar"), root])).toBe(true);
    expect(startsDrag([node("path"), node("svg"), node(".player__logo"), node(".player__titlebar"), root])).toBe(true);
    expect(startsDrag([node(".eq__label"), node(".eq__band"), node(".eq__inner"), node(".eq"), root])).toBe(true);
  });

  it("never drags from controls, lists, screens or resize handles, at any depth", () => {
    expect(startsDrag([node("path"), node("svg"), node("button"), node(".transport"), root])).toBe(false);
    expect(startsDrag([node(".playlist__name"), node("li"), node("ul"), node(".playlist__list-frame"), root])).toBe(false);
    expect(startsDrag([node("canvas"), node(".display__stage"), node(".player__display"), root])).toBe(false);
    expect(startsDrag([node(".chords__name"), node(".chords__chord"), node(".chords__lcd"), root])).toBe(false);
    expect(startsDrag([node("svg"), node(".window-grip"), root])).toBe(false);
  });

  it("keeps the controls that have their own dragging out of it", () => {
    for (const selector of ["input", ".player__seek", ".volume", ".eq__slider-wrap", ".playlist__resize-handle", ".radio__resize-handle", ".window-edge"]) {
      expect(blocked, selector).toContain(selector);
    }
  });

  it("refuses an empty path, such as a target outside the window", () => {
    expect(startsDrag([])).toBe(false);
  });
});

describe("dragMoved", () => {
  it("waits for a few pixels of movement", () => {
    expect(dragMoved(2, 2)).toBe(false);
    expect(dragMoved(3, 3)).toBe(true);
    expect(dragMoved(0, -4)).toBe(true);
  });
});
