import { globalShortcut } from "electron";
import { writeLog } from "./logging";
import { sendToMainWindow } from "./windows";
import { comboToAccelerator } from "./accelerator";
import type { GlobalHotkeyRequest, MediaKeyAction } from "../shared/types";

// Media Session (player/mediaSession.ts) already routes media keys on macOS/Windows; this is
// a fallback, and registration is expected to fail on macOS.
export function sendMediaKey(action: MediaKeyAction): void {
  sendToMainWindow("media-key", action);
}

export function registerMediaKeys(): void {
  const bindings: Record<string, MediaKeyAction> = {
    MediaPlayPause: "playpause",
    MediaNextTrack: "next",
    MediaPreviousTrack: "previous",
    MediaStop: "stop",
  };
  for (const [accelerator, action] of Object.entries(bindings)) {
    const ok = globalShortcut.register(accelerator, () => sendMediaKey(action));
    if (!ok) writeLog("info", "media-keys", `${accelerator} not registered (OS already routes it via Media Session)`);
  }
}

let registeredHotkeys: string[] = [];

export function applyGlobalHotkeys({ enabled, bindings }: Partial<GlobalHotkeyRequest> = {}): string[] {
  for (const accelerator of registeredHotkeys) globalShortcut.unregister(accelerator);
  registeredHotkeys = [];
  const failed: string[] = [];
  if (!enabled) return failed;
  for (const [action, combo] of Object.entries(bindings || {})) {
    if (!combo) continue;
    const accelerator = comboToAccelerator(combo);
    let ok = false;
    try {
      ok = !!accelerator && globalShortcut.register(accelerator, () => sendToMainWindow("hotkey", action));
    } catch {
      ok = false;
    }
    if (ok) {
      registeredHotkeys.push(accelerator);
    } else {
      failed.push(action);
      writeLog("warn", "hotkeys", `Could not register ${accelerator || combo} for ${action}`);
    }
  }
  return failed;
}
