import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";

vi.mock("electron", async () => {
  const os = await import("node:os");
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "waveamp-skins-"));
  return { app: { getAppPath: () => process.cwd(), getPath: () => userData }, shell: { openPath: async () => "" } };
});
vi.mock("../../src/main/logging", () => ({ writeLog: vi.fn() }));
vi.mock("../../src/main/windows", () => ({ sendToMainWindow: vi.fn() }));

const { app } = await import("electron");
const { listSkins, readSkin } = await import("../../src/main/skins");

const userData = app.getPath("userData");
const skinsDir = path.join(userData, "skins");

function pack(name: string, skin: unknown, files: Record<string, string> = {}): void {
  const entries = Object.fromEntries(Object.entries(files).map(([file, text]) => [file, strToU8(text)]));
  fs.writeFileSync(path.join(skinsDir, name), zipSync({ "skin.json": strToU8(JSON.stringify(skin)), ...entries }));
}

const faces = { format: 1, name: "Faces", images: { button: "img/face.png" }, buttons: { play: { normal: "img/face.png", on: "img/on.png" } } };

beforeEach(() => {
  fs.rmSync(skinsDir, { recursive: true, force: true });
  fs.mkdirSync(skinsDir, { recursive: true });
});

afterAll(() => fs.rmSync(userData, { recursive: true, force: true }));

describe("listSkins", () => {
  it("lists the built-in skin first and only real .waveskin files", async () => {
    pack("Faces.waveskin", faces, { "img/face.png": "f", "img/on.png": "o" });
    pack("Other.zip", { format: 1, name: "Zip" });
    fs.mkdirSync(path.join(skinsDir, "Folder"));
    fs.writeFileSync(path.join(skinsDir, "Folder", "skin.json"), JSON.stringify({ format: 1, name: "Folder" }));
    fs.symlinkSync(path.join(skinsDir, "Faces.waveskin"), path.join(skinsDir, "Link.waveskin"));
    const skins = await listSkins();
    expect(skins.map((skin) => [skin.id, skin.problem])).toEqual([
      ["default", undefined],
      ["Faces.waveskin", undefined],
    ]);
  });

  it("keeps refused skins in the list with the reason", async () => {
    pack("Missing.waveskin", faces, { "img/face.png": "f" });
    pack("Future.waveskin", { format: 2, name: "Future" });
    fs.writeFileSync(path.join(skinsDir, "Garbage.waveskin"), "hello");
    const skins = await listSkins();
    expect(skins.slice(1).map((skin) => [skin.name, skin.problem])).toEqual([
      ["Faces", { kind: "missing", file: "img/on.png" }],
      ["Future", { kind: "newerFormat" }],
      ["Garbage", { kind: "broken" }],
    ]);
  });

  it("notices a skin file replaced in place", async () => {
    pack("Faces.waveskin", faces, { "img/face.png": "f", "img/on.png": "o" });
    expect((await listSkins())[1].problem).toBeUndefined();
    pack("Faces.waveskin", faces, { "img/face.png": "f" });
    expect((await listSkins())[1].problem).toEqual({ kind: "missing", file: "img/on.png" });
  });
});

describe("readSkin", () => {
  it("sends a picture used in several places once", async () => {
    pack("Faces.waveskin", faces, { "img/face.png": "f", "img/on.png": "o" });
    const skin = await readSkin("Faces.waveskin");
    expect(skin?.assets.sources).toHaveLength(2);
    expect(skin?.assets.images.button?.source).toBe(skin?.assets.buttons.play?.normal.source);
    expect(skin?.assets.buttons.play?.on).toBe(1);
  });

  it("loads nothing of a refused skin", async () => {
    pack("Missing.waveskin", faces, { "img/face.png": "f" });
    expect(await readSkin("Missing.waveskin")).toBeNull();
    expect(await readSkin("Folder")).toBeNull();
    expect(await readSkin("../escape.waveskin")).toBeNull();
  });

  it("reads the built-in skin from the app", async () => {
    expect((await readSkin("default"))?.builtIn).toBe(true);
  });
});
