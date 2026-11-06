import { DEFAULT_SKIN_ID } from "../../shared/skin";
import { applySkinTokens, splitSkinTokens } from "../skin";
import { state } from "./state";
import { logEvent } from "./log";
import { persistConfig } from "./config";
import { pushSettingsState, setAccentColor } from "./settingsBridge";

export async function refreshSkins(): Promise<void> {
  state.skins = (await window.electronAPI?.listSkins?.()) ?? [];
  pushSettingsState();
}

export async function setSkin(id: string, useSkinAccent: boolean): Promise<void> {
  const skin = await window.electronAPI?.readSkin?.(id);
  if (!skin) {
    logEvent("warn", "skin", `"${id}" could not be loaded`);
    if (id !== DEFAULT_SKIN_ID) await setSkin(DEFAULT_SKIN_ID, useSkinAccent);
    return;
  }
  const { valid, invalid } = splitSkinTokens(skin.tokens);
  for (const token of invalid) logEvent("warn", "skin", `"${skin.id}": ${token.property} has an invalid value`);
  state.skinId = skin.id;
  state.skinAccent = skin.accent;
  state.skinTokens = valid;
  applySkinTokens(valid);
  if (useSkinAccent && skin.accent) setAccentColor(skin.accent);
  if (!state.restoring) persistConfig();
  pushSettingsState();
}
