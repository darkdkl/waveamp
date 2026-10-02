import type { DeepPartial, HotkeyConfig } from "../shared/types";
import { i18n } from "./i18n";

// Combos are modifiers + KeyboardEvent.code (the physical key), so they work on any layout.
const isMac = /Mac/.test(navigator.platform || navigator.userAgent);

// [id, i18n key, in-window, global (Win/Linux), global (macOS)]
const ACTIONS = [
  ["playPause", "hotkeyPlayPause", "Space", "Ctrl+Alt+Home", "Ctrl+Alt+Space"],
  ["play", "hotkeyPlay", "KeyX", "", ""],
  ["pause", "hotkeyPause", "KeyC", "", ""],
  ["stop", "hotkeyStop", "KeyV", "Ctrl+Alt+End", ""],
  ["next", "hotkeyNext", "KeyB", "Ctrl+Alt+PageDown", "Ctrl+Alt+ArrowRight"],
  ["previous", "hotkeyPrevious", "KeyZ", "Ctrl+Alt+PageUp", "Ctrl+Alt+ArrowLeft"],
  ["seekForward", "hotkeySeekForward", "ArrowRight", "Ctrl+Alt+ArrowRight", ""],
  ["seekBackward", "hotkeySeekBackward", "ArrowLeft", "Ctrl+Alt+ArrowLeft", ""],
  ["volumeUp", "hotkeyVolumeUp", "ArrowUp", "Ctrl+Alt+ArrowUp", "Ctrl+Alt+ArrowUp"],
  ["volumeDown", "hotkeyVolumeDown", "ArrowDown", "Ctrl+Alt+ArrowDown", "Ctrl+Alt+ArrowDown"],
  ["mute", "hotkeyMute", "KeyM", "", ""],
  ["toggleEq", "hotkeyToggleEq", "Alt+KeyG", "", ""],
  ["togglePlaylist", "hotkeyTogglePlaylist", "Alt+KeyE", "", ""],
  ["toggleRadio", "hotkeyToggleRadio", "Alt+KeyR", "", ""],
  ["openSettings", "hotkeyOpenSettings", isMac ? "Meta+Comma" : "Ctrl+KeyP", "", ""],
  ["addFiles", "hotkeyAddFiles", "KeyL", "", ""],
  ["addFolder", "hotkeyAddFolder", "Shift+KeyL", "", ""],
  ["addStation", "hotkeyAddStation", "", "", ""],
  ["cycleVisualizer", "hotkeyCycleVisualizer", "", "", ""],
].map(([id, nameKey, local, global, macGlobal]) => ({ id, nameKey, local, global: isMac ? macGlobal : global }));

const MODIFIERS = ["Ctrl", "Alt", "Shift", "Meta"];
const MODIFIER_CODES = new Set([
  "ControlLeft", "ControlRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight",
]);

const RESERVED = new Set([
  "Ctrl+KeyA", "Ctrl+KeyC", "Ctrl+KeyV", "Ctrl+KeyX", "Ctrl+KeyZ", "Ctrl+KeyY", "Ctrl+Shift+KeyZ",
  "Meta+KeyA", "Meta+KeyC", "Meta+KeyV", "Meta+KeyX", "Meta+KeyZ", "Meta+Shift+KeyZ",
  "Meta+KeyQ", "Meta+KeyW", "Meta+KeyH", "Meta+KeyM", "Meta+Tab", "Alt+Tab", "Alt+F4", "Ctrl+Alt+Delete",
]);
const RESERVED_PLAIN = new Set(["Tab", "Escape", "Enter", "Backspace", "Delete"]);

function comboFromEvent(event: Pick<KeyboardEvent, "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">): string | null {
  if (MODIFIER_CODES.has(event.code) || !event.code) return null;
  const mods = [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", event.metaKey && "Meta"];
  return [...mods.filter(Boolean), event.code].join("+");
}

function parse(combo: string): { mods: string[]; code: string } {
  const parts = combo.split("+");
  return { mods: parts.slice(0, -1), code: parts[parts.length - 1] };
}

function rejectReason(combo: string, scope: "local" | "global"): string | null {
  const { mods, code } = parse(combo);
  if (RESERVED.has(combo)) return "hotkeyReserved";
  if (!mods.length && RESERVED_PLAIN.has(code)) return "hotkeyReserved";
  if (scope === "global" && !mods.some((m) => m !== "Shift")) return "hotkeyGlobalNeedsModifier";
  return null;
}

const KEY_LABELS: Record<string, string> = {
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
  PageUp: "PgUp", PageDown: "PgDn", Comma: ",", Period: ".", Slash: "/", Backslash: "\\",
  Semicolon: ";", Quote: "'", BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=", Backquote: "`",
};

function keyLabel(code: string): string {
  if (code === "Space") return i18n.t("hotkeySpace");
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return "Num " + code.slice(6);
  return code;
}

function format(combo: string): string {
  if (!combo) return "";
  const { mods, code } = parse(combo);
  const modLabels: Record<string, string> = { Ctrl: isMac ? "⌃" : "Ctrl", Alt: isMac ? "⌥" : "Alt", Shift: isMac ? "⇧" : "Shift", Meta: isMac ? "⌘" : "Win" };
  return [...mods.map((m) => modLabels[m]), keyLabel(code)].join(isMac ? "" : "+");
}

function normalize(saved: DeepPartial<HotkeyConfig> | null | undefined): HotkeyConfig {
  const local: Record<string, string> = {};
  const global: Record<string, string> = {};
  for (const action of ACTIONS) {
    const savedLocal = saved?.local?.[action.id];
    const savedGlobal = saved?.global?.[action.id];
    local[action.id] = typeof savedLocal === "string" ? savedLocal : action.local;
    global[action.id] = typeof savedGlobal === "string" ? savedGlobal : action.global;
  }
  return { local, global, globalEnabled: saved?.globalEnabled === true };
}

function defaults(): HotkeyConfig {
  return normalize(null);
}

export const hotkeys = { ACTIONS, MODIFIERS, comboFromEvent, rejectReason, format, normalize, defaults, isMac };
