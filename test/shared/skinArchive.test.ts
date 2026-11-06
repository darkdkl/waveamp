import { describe, expect, it } from "vitest";
import { isArchivePath, planSkinArchive } from "../../src/shared/skinArchive";

const file = (name: string, size = 10) => ({ name, size });

describe("planSkinArchive", () => {
  it("takes skin.json from the root", () => {
    expect(planSkinArchive([file("skin.json"), file("img/a.png"), file("img/")])).toEqual({
      ok: true,
      root: "",
      files: ["skin.json", "img/a.png"],
    });
  });

  it("strips a single top folder", () => {
    expect(planSkinArchive([file("Brass/"), file("Brass/skin.json"), file("Brass/img/a.png")])).toEqual({
      ok: true,
      root: "Brass/",
      files: ["skin.json", "img/a.png"],
    });
  });

  it("skips macOS metadata and dot files", () => {
    const plan = planSkinArchive([file("skin.json"), file("__MACOSX/._skin.json"), file(".DS_Store"), file("img/.thumb")]);
    expect(plan).toEqual({ ok: true, root: "", files: ["skin.json"] });
  });

  it("refuses archives without a skin, with escaping paths or too much data", () => {
    expect(planSkinArchive([file("a/skin.json"), file("b/skin.json")])).toEqual({ ok: false, error: "noSkin" });
    expect(planSkinArchive([file("skin.json"), file("../evil.png")])).toEqual({ ok: false, error: "badPath" });
    expect(planSkinArchive([file("skin.json"), file("/etc/x")])).toEqual({ ok: false, error: "badPath" });
    expect(planSkinArchive([file("skin.json"), file("big.png", 9 * 1024 * 1024)])).toEqual({ ok: false, error: "tooLarge" });
    expect(planSkinArchive(Array.from({ length: 301 }, (_, i) => file(`f${i}.png`)))).toEqual({ ok: false, error: "tooManyFiles" });
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
