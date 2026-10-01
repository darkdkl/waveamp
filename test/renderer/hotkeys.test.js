import { describe, expect, it } from "vitest";
import { loadScript, plain } from "../loadScript.js";

function loadHotkeys(platform) {
  return loadScript("hotkeys.js", { navigator: { platform } }).window.hotkeys;
}

const linux = loadHotkeys("Linux x86_64");
const mac = loadHotkeys("MacIntel");

function keyEvent(code, mods = {}) {
  return { code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods };
}

describe("comboFromEvent", () => {
  it("builds modifiers in a fixed order plus the physical key", () => {
    expect(linux.comboFromEvent(keyEvent("KeyA", { metaKey: true, shiftKey: true, ctrlKey: true, altKey: true }))).toBe(
      "Ctrl+Alt+Shift+Meta+KeyA"
    );
    expect(linux.comboFromEvent(keyEvent("Space"))).toBe("Space");
  });

  it("ignores modifier-only presses and events without a code", () => {
    expect(linux.comboFromEvent(keyEvent("ShiftLeft", { shiftKey: true }))).toBeNull();
    expect(linux.comboFromEvent(keyEvent(""))).toBeNull();
  });
});

describe("rejectReason", () => {
  it("rejects reserved combos", () => {
    expect(linux.rejectReason("Ctrl+KeyC", "local")).toBe("hotkeyReserved");
    expect(linux.rejectReason("Tab", "local")).toBe("hotkeyReserved");
    expect(linux.rejectReason("Alt+F4", "global")).toBe("hotkeyReserved");
  });

  it("requires a real modifier for global combos", () => {
    expect(linux.rejectReason("KeyA", "global")).toBe("hotkeyGlobalNeedsModifier");
    expect(linux.rejectReason("Shift+KeyA", "global")).toBe("hotkeyGlobalNeedsModifier");
    expect(linux.rejectReason("Ctrl+Alt+KeyA", "global")).toBeNull();
  });

  it("allows plain keys in the window", () => {
    expect(linux.rejectReason("KeyA", "local")).toBeNull();
    expect(linux.rejectReason("Shift+Tab", "local")).toBeNull();
  });
});

describe("format", () => {
  it("uses words joined with + on Windows/Linux", () => {
    expect(linux.format("Ctrl+Alt+ArrowUp")).toBe("Ctrl+Alt+↑");
    expect(linux.format("Meta+KeyK")).toBe("Win+K");
    expect(linux.format("Shift+Digit5")).toBe("Shift+5");
  });

  it("uses symbols on macOS", () => {
    expect(mac.format("Meta+Comma")).toBe("⌘,");
    expect(mac.format("Ctrl+Alt+Space")).toBe("⌃⌥Space");
  });

  it("formats an empty combo as an empty string", () => {
    expect(linux.format("")).toBe("");
  });
});

describe("normalize", () => {
  it("keeps saved strings, including cleared ones, and falls back to defaults", () => {
    const config = linux.normalize({ local: { mute: "KeyN", stop: "" , next: 5 }, globalEnabled: true });
    expect(config.local.mute).toBe("KeyN");
    expect(config.local.stop).toBe("");
    expect(config.local.next).toBe(linux.defaults().local.next);
    expect(config.globalEnabled).toBe(true);
  });

  it("disables global hotkeys unless explicitly enabled", () => {
    expect(linux.normalize({ globalEnabled: "yes" }).globalEnabled).toBe(false);
    expect(linux.normalize(null).globalEnabled).toBe(false);
  });
});

describe.each([
  ["Linux", linux],
  ["macOS", mac],
])("defaults on %s", (name, hotkeys) => {
  const defaults = plain(hotkeys.defaults());

  it("covers every action", () => {
    expect(Object.keys(defaults.local).sort()).toEqual(hotkeys.ACTIONS.map((a) => a.id).sort());
  });

  it.each(["local", "global"])("has no duplicate %s combos", (scope) => {
    const combos = Object.values(defaults[scope]).filter(Boolean);
    expect(new Set(combos).size).toBe(combos.length);
  });

  it.each(["local", "global"])("has only valid %s combos", (scope) => {
    for (const combo of Object.values(defaults[scope]).filter(Boolean)) {
      expect(hotkeys.rejectReason(combo, scope), combo).toBeNull();
    }
  });
});
