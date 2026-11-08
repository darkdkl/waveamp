import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { isArchivePath, openSkinArchive, planSkinArchive, skinAssetProblem } from "../../src/shared/skinArchive";
import { parseSkin, SKIN_ASSETS_MAX_BYTES, SKIN_ICON_MAX_BYTES, SKIN_IMAGE_MAX_BYTES } from "../../src/shared/skin";

const MB = 1024 * 1024;
const file = (name: string, size = 10) => ({ name, size });
const sizes = (entries: Record<string, number>) => new Map(Object.entries(entries));

describe("planSkinArchive", () => {
  it("takes skin.json from the root", () => {
    expect(planSkinArchive([file("skin.json"), file("img/a.png"), file("img/")])).toEqual({
      ok: true,
      root: "",
      sizes: sizes({ "skin.json": 10, "img/a.png": 10 }),
    });
  });

  it("strips a single top folder", () => {
    expect(planSkinArchive([file("Brass/"), file("Brass/skin.json"), file("Brass/img/a.png")])).toEqual({
      ok: true,
      root: "Brass/",
      sizes: sizes({ "skin.json": 10, "img/a.png": 10 }),
    });
  });

  it("skips macOS metadata and dot files", () => {
    const plan = planSkinArchive([file("skin.json"), file("__MACOSX/._skin.json", 20 * MB), file(".DS_Store"), file("img/.thumb")]);
    expect(plan).toEqual({ ok: true, root: "", sizes: sizes({ "skin.json": 10 }) });
  });

  it("refuses archives without a skin or with escaping paths", () => {
    expect(planSkinArchive([file("a/skin.json"), file("b/skin.json")])).toEqual({ ok: false, problem: { kind: "broken" }, detail: "no skin.json" });
    for (const name of ["../evil.png", "/etc/x"]) {
      expect(planSkinArchive([file("skin.json"), file(name)])).toMatchObject({ ok: false, problem: { kind: "broken" } });
    }
  });

  it("refuses repeated file names", () => {
    expect(planSkinArchive([file("skin.json"), file("a.png", 1), file("a.png", 1024 * MB)])).toEqual({
      ok: false,
      problem: { kind: "broken" },
      detail: "repeated file names",
    });
  });

  it("refuses skins over the limits and says by how much", () => {
    expect(planSkinArchive([file("skin.json", 100), file("a.png", 5 * MB), file("b.png", 4 * MB)])).toEqual({
      ok: false,
      problem: { kind: "tooLarge", size: 9 * MB, max: SKIN_ASSETS_MAX_BYTES },
    });
    expect(planSkinArchive([file("skin.json", 100), file("a.png", SKIN_ASSETS_MAX_BYTES)])).toMatchObject({ ok: true });
    expect(planSkinArchive([file("skin.json", 65 * 1024)])).toMatchObject({ ok: false, problem: { kind: "fileTooLarge", file: "skin.json" } });
    expect(planSkinArchive(Array.from({ length: 301 }, (_, i) => file(`f${i}.png`)))).toEqual({
      ok: false,
      problem: { kind: "tooManyFiles", count: 301, max: 300 },
    });
  });
});

describe("openSkinArchive", () => {
  const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));

  it("reads the asked files in one go, relative to the skin root", () => {
    const opened = openSkinArchive(zip({ "Brass/skin.json": "{}", "Brass/img/a.png": "aa", "Brass/img/b.png": "bbb" }));
    if (!opened.ok) throw new Error(opened.detail);
    expect(opened.archive.sizes).toEqual(sizes({ "skin.json": 2, "img/a.png": 2, "img/b.png": 3 }));
    const files = opened.archive.read(["img/a.png", "img/b.png"]);
    expect([...files.keys()].sort()).toEqual(["img/a.png", "img/b.png"]);
    expect(new TextDecoder().decode(files.get("img/b.png"))).toBe("bbb");
  });

  it("refuses files the archive doesn't list", () => {
    const opened = openSkinArchive(zip({ "skin.json": "{}" }));
    expect(opened.ok && (() => opened.archive.read(["img/a.png"]))).toThrow("img/a.png cannot be unpacked");
  });

  it("treats backslashes as folders, so the same name twice is refused", () => {
    expect(openSkinArchive(zip({ "skin.json": "{}", "img/a.png": "a", "img\\a.png": "b" }))).toMatchObject({ ok: false, detail: "repeated file names" });
  });
});

describe("skinAssetProblem", () => {
  const refs = (json: Record<string, unknown>) => {
    const result = parseSkin("x", { format: 1, name: "X", ...json }, false);
    if (!result.ok) throw new Error(result.error);
    return result.skin.assets;
  };

  it("accepts a skin whose files are all there and within their limits", () => {
    const assets = refs({ images: { body: "body.png" }, icons: { play: "play.svg" }, buttons: { play: { normal: "face.png", on: "on.png" } } });
    expect(skinAssetProblem(assets, sizes({ "body.png": SKIN_IMAGE_MAX_BYTES, "play.svg": 100, "face.png": 100, "on.png": 100 }))).toBeNull();
  });

  it("names the first missing file", () => {
    const assets = refs({ buttons: { play: { normal: "face.png", pressed: "down.png" } } });
    expect(skinAssetProblem(assets, sizes({ "face.png": 100 }))).toEqual({ kind: "missing", file: "down.png" });
  });

  it("checks every file against the limit of the place it is used in", () => {
    expect(skinAssetProblem(refs({ images: { body: "body.png" } }), sizes({ "body.png": SKIN_IMAGE_MAX_BYTES + 1 }))).toEqual({
      kind: "fileTooLarge",
      file: "body.png",
      size: SKIN_IMAGE_MAX_BYTES + 1,
      max: SKIN_IMAGE_MAX_BYTES,
    });
    const shared = refs({ images: { body: "a.png" }, icons: { play: "a.png" } });
    expect(skinAssetProblem(shared, sizes({ "a.png": SKIN_ICON_MAX_BYTES + 1 }))).toMatchObject({ kind: "fileTooLarge", max: SKIN_ICON_MAX_BYTES });
  });
});

describe("isArchivePath", () => {
  it("allows folders and nested files only inside the archive", () => {
    expect(isArchivePath("img/")).toBe(true);
    expect(isArchivePath("img/a.png")).toBe(true);
    expect(isArchivePath("img//a.png")).toBe(false);
    expect(isArchivePath("C:/a.png")).toBe(false);
    expect(isArchivePath("a\\b.png")).toBe(false);
  });
});
