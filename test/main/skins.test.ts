import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";

vi.mock("electron", async () => {
  const os = await import("node:os");
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "waveamp-skins-"));
  const showOpenDialog = vi.fn();
  return { app: { getAppPath: () => process.cwd(), getPath: () => userData }, shell: { openPath: async () => "" }, dialog: { showOpenDialog } };
});
vi.mock("../../src/main/logging", () => ({ writeLog: vi.fn() }));
vi.mock("../../src/main/windows", () => ({ sendToMainWindow: vi.fn() }));

const { app, dialog } = await import("electron");
const { installPickedSkin, listSkins, pickSkin, readSkin } = await import("../../src/main/skins");

const userData = app.getPath("userData");
const skinsDir = path.join(userData, "skins");

function pack(name: string, skin: unknown, files: Record<string, string> = {}, dir = skinsDir): string {
  const entries = Object.fromEntries(Object.entries(files).map(([file, text]) => [file, strToU8(text)]));
  const file = path.join(dir, name);
  fs.writeFileSync(file, zipSync({ "skin.json": strToU8(JSON.stringify(skin)), ...entries }));
  return file;
}

const downloads = path.join(userData, "downloads");

function choose(file: string | null): void {
  vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: !file, filePaths: file ? [file] : [] });
}

const faces = { format: 1, name: "Faces", images: { button: "img/face.png" }, buttons: { play: { normal: "img/face.png", on: "img/on.png" } } };

beforeEach(() => {
  for (const dir of [skinsDir, downloads]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
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

describe("installing a skin", () => {
  const installed = () => fs.readdirSync(skinsDir).sort();

  it("copies a new skin under its name and keeps the original", async () => {
    const file = pack("brass-v1.waveskin", { format: 1, name: "Brass" }, {}, downloads);
    choose(file);
    expect(await pickSkin(null)).toEqual({ name: "Brass", replaces: false });
    expect(await installPickedSkin()).toBe("Brass.waveskin");
    expect(installed()).toEqual(["Brass.waveskin"]);
    expect(fs.existsSync(file)).toBe(true);
  });

  it("replaces the file of a skin with the same name, whatever the file is called", async () => {
    pack("old-brass.waveskin", { format: 1, name: "Brass", version: "1" });
    choose(pack("brass-v2.waveskin", { format: 1, name: " brass ", version: "2" }, {}, downloads));
    expect(await pickSkin(null)).toEqual({ name: "brass", replaces: true });
    expect(await installPickedSkin()).toBe("old-brass.waveskin");
    expect(installed()).toEqual(["old-brass.waveskin"]);
    expect((await listSkins())[1].version).toBe("2");
  });

  it("picks a free file name when another skin holds it", async () => {
    pack("Brass.waveskin", { format: 1, name: "Old brass" });
    choose(pack("x.waveskin", { format: 1, name: "Brass" }, {}, downloads));
    await pickSkin(null);
    expect(await installPickedSkin()).toBe("Brass (2).waveskin");
  });

  it("copies nothing from a skin that fails the checks", async () => {
    choose(pack("broken.waveskin", { format: 1, name: "Broken", icons: { play: "img/play.png" } }, {}, downloads));
    expect(await pickSkin(null)).toEqual({ name: "Broken", problem: { kind: "missing", file: "img/play.png" }, replaces: false });
    expect(await installPickedSkin()).toBeNull();
    expect(installed()).toEqual([]);
  });

  it("turns on a skin picked from the skins folder without asking or copying", async () => {
    const file = pack("Brass.waveskin", { format: 1, name: "Brass" });
    choose(file);
    expect(await pickSkin(null)).toEqual({ name: "Brass", replaces: false });
    expect(await installPickedSkin()).toBe("Brass.waveskin");
    expect(installed()).toEqual(["Brass.waveskin"]);
  });

  it("keeps file names Windows can write", async () => {
    choose(pack("a.waveskin", { format: 1, name: "Con" }, {}, downloads));
    await pickSkin(null);
    expect(await installPickedSkin()).toBe("Con (skin).waveskin");
    choose(pack("b.waveskin", { format: 1, name: "Brass..." }, {}, downloads));
    await pickSkin(null);
    expect(await installPickedSkin()).toBe("Brass.waveskin");
  });

  it("chooses the file name when copying, not when picking", async () => {
    choose(pack("x.waveskin", { format: 1, name: "Brass" }, {}, downloads));
    await pickSkin(null);
    pack("Brass.waveskin", { format: 1, name: "Other" });
    expect(await installPickedSkin()).toBe("Brass (2).waveskin");
    expect(installed()).toEqual(["Brass (2).waveskin", "Brass.waveskin"]);
  });

  it("leaves nothing behind when the copy fails", async () => {
    const file = pack("x.waveskin", { format: 1, name: "Brass" }, {}, downloads);
    choose(file);
    await pickSkin(null);
    fs.rmSync(file);
    expect(await installPickedSkin()).toBeNull();
    expect(installed()).toEqual([]);
  });

  it("does nothing when the dialog is closed", async () => {
    choose(null);
    expect(await pickSkin(null)).toBeNull();
    expect(await installPickedSkin()).toBeNull();
  });
});
