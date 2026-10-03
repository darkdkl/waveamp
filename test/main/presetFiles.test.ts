import { describe, expect, it } from "vitest";
import { isPresetFile, presetDisplayName } from "../../src/main/presetFiles";

describe("isPresetFile", () => {
  it("accepts .milk files in any case", () => {
    expect(isPresetFile("Flexi - mindblob.milk")).toBe(true);
    expect(isPresetFile("LOUD.MILK")).toBe(true);
  });

  it("rejects other and hidden files", () => {
    expect(isPresetFile("cover.jpg")).toBe(false);
    expect(isPresetFile("._Flexi.milk")).toBe(false);
  });
});

describe("presetDisplayName", () => {
  it("drops the folder and the extension", () => {
    expect(presetDisplayName("/presets/Dancer/Aurora/shifter  -  urchin.milk")).toBe("shifter - urchin");
  });
});
