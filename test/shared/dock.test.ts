import { describe, expect, it } from "vitest";
import { attachedGroup, clampToAreas, offsetFrom, reflowAfterResize, snapDelta, touching, type Rect } from "../../src/shared/dock";

const main: Rect = { x: 100, y: 100, width: 410, height: 174 };
const eq: Rect = { x: 100, y: 274, width: 410, height: 174 };
const panel: Rect = { x: 100, y: 448, width: 410, height: 320 };
const screenArea: Rect = { x: 0, y: 0, width: 1920, height: 1080 };

describe("touching", () => {
  it("detects stacked and side-by-side windows", () => {
    expect(touching(main, eq)).toBe(true);
    expect(touching(main, { x: 510, y: 120, width: 300, height: 400 })).toBe(true);
  });

  it("ignores gaps and corner-only contact", () => {
    expect(touching(main, { ...eq, y: 280 })).toBe(false);
    expect(touching(main, { x: 510, y: 274, width: 100, height: 100 })).toBe(false);
  });

  it("tolerates one pixel of rounding", () => {
    expect(touching(main, { ...eq, y: 275 })).toBe(true);
  });
});

describe("attachedGroup", () => {
  it("collects windows docked through each other", () => {
    expect(attachedGroup({ main, eq, panel }, "main")).toEqual(["main", "eq", "panel"]);
  });

  it("leaves floating windows out", () => {
    expect(attachedGroup({ main, eq, panel: { ...panel, x: 900 } }, "main")).toEqual(["main", "eq"]);
  });

  it("returns nothing for a missing root", () => {
    expect(attachedGroup<"main" | "eq">({ eq }, "main")).toEqual([]);
  });
});

describe("snapDelta", () => {
  it("snaps a window under another and aligns their left edges", () => {
    const floating: Rect = { x: 600, y: 600, width: 410, height: 174 };
    expect(snapDelta([floating], { x: -493, y: -320 }, [main], [screenArea])).toEqual({ x: -500, y: -326 });
  });

  it("snaps to the side of another window", () => {
    const floating: Rect = { x: 700, y: 100, width: 300, height: 200 };
    expect(snapDelta([floating], { x: -184, y: 0 }, [main], [screenArea])).toEqual({ x: -190, y: 0 });
  });

  it("snaps to the screen edges", () => {
    expect(snapDelta([main], { x: -94, y: 0 }, [], [screenArea])).toEqual({ x: -100, y: 0 });
    expect(snapDelta([main], { x: 0, y: 800 }, [], [screenArea])).toEqual({ x: 0, y: 806 });
  });

  it("keeps the move when nothing is close", () => {
    expect(snapDelta([main], { x: 300, y: 200 }, [], [screenArea])).toEqual({ x: 300, y: 200 });
  });

  it("ignores windows far away on the other axis", () => {
    const far: Rect = { x: 600, y: 900, width: 100, height: 100 };
    expect(snapDelta([main], { x: -2, y: 0 }, [far], [])).toEqual({ x: -2, y: 0 });
  });

  it("moves a whole group with one shared correction", () => {
    expect(snapDelta([main, eq], { x: -95, y: 0 }, [], [screenArea])).toEqual({ x: -100, y: 0 });
  });
});

describe("reflowAfterResize", () => {
  it("pushes the windows below down when a window grows", () => {
    const result = reflowAfterResize({ main, eq, panel }, "main", { ...main, height: 200 }, ["main", "eq", "panel"]);
    expect(result.eq).toEqual({ ...eq, y: 300 });
    expect(result.panel).toEqual({ ...panel, y: 474 });
  });

  it("pulls them up when it shrinks and moves side windows with the width", () => {
    const side: Rect = { x: 510, y: 100, width: 300, height: 300 };
    const result = reflowAfterResize({ main, eq, side }, "main", { ...main, width: 400, height: 160 }, ["main", "eq", "side"]);
    expect(result.eq).toEqual({ ...eq, y: 260 });
    expect(result.side).toEqual({ ...side, x: 500 });
  });

  it("does not touch windows outside the group", () => {
    const result = reflowAfterResize({ main, eq, panel }, "eq", { ...eq, height: 200 }, ["main", "eq"]);
    expect(result.panel).toEqual(panel);
  });
});

describe("clampToAreas", () => {
  it("brings an off-screen window back", () => {
    expect(clampToAreas({ x: 2000, y: -50, width: 400, height: 200 }, [screenArea])).toEqual({ x: 1520, y: 0, width: 400, height: 200 });
  });

  it("keeps the window on the screen it mostly covers", () => {
    const second: Rect = { x: 1920, y: 0, width: 1280, height: 1024 };
    expect(clampToAreas({ x: 3000, y: 100, width: 400, height: 200 }, [screenArea, second])).toEqual({ x: 2800, y: 100, width: 400, height: 200 });
  });

  it("leaves visible windows alone", () => {
    expect(clampToAreas(main, [screenArea])).toEqual(main);
  });
});

describe("offsetFrom", () => {
  it("measures a window relative to the main one", () => {
    expect(offsetFrom(main, panel)).toEqual({ x: 0, y: 348 });
  });
});
