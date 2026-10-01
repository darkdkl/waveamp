import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const { comboToAccelerator } = createRequire(import.meta.url)("../../src/main/accelerator.js");

describe("comboToAccelerator", () => {
  it("maps modifiers and arrow keys", () => {
    expect(comboToAccelerator("Ctrl+Alt+ArrowUp", "linux")).toBe("Control+Alt+Up");
    expect(comboToAccelerator("Ctrl+Alt+PageDown", "win32")).toBe("Control+Alt+PageDown");
  });

  it("maps Meta per platform", () => {
    expect(comboToAccelerator("Meta+KeyK", "darwin")).toBe("Command+K");
    expect(comboToAccelerator("Meta+KeyK", "linux")).toBe("Super+K");
  });

  it("maps letters, digits, numpad and punctuation", () => {
    expect(comboToAccelerator("Shift+KeyL", "linux")).toBe("Shift+L");
    expect(comboToAccelerator("Ctrl+Digit5", "linux")).toBe("Control+5");
    expect(comboToAccelerator("Alt+Numpad3", "linux")).toBe("Alt+num3");
    expect(comboToAccelerator("Ctrl+Comma", "linux")).toBe("Control+,");
    expect(comboToAccelerator("Ctrl+Alt+Space", "darwin")).toBe("Control+Alt+Space");
    expect(comboToAccelerator("F5", "linux")).toBe("F5");
  });

  it("returns null for keys or modifiers it can't express", () => {
    expect(comboToAccelerator("Ctrl+IntlRo", "linux")).toBeNull();
    expect(comboToAccelerator("Hyper+KeyA", "linux")).toBeNull();
  });
});
