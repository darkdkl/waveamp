import { DEFAULT_SKIN_ID, type SkinFont } from "../../shared/skin";
import { errorMessage } from "../../shared/errors";
import { applySkinAssets, applySkinTokens, installSkinFont, splitSkinTokens } from "../skin";
import { state } from "./state";
import { logEvent } from "./log";
import { persistConfig } from "./config";
import { pushSettingsState, setAccentColor } from "./settingsBridge";
import { onPlayerDocumentAdded, playerDocuments } from "./documents";

let skinFont: SkinFont | null = null;

function installFont(doc: Document): Promise<void> {
  return installSkinFont(doc, skinFont).catch((err) => {
    logEvent("warn", "skin", `"${state.skinId}": display font: ${errorMessage(err)}`);
  });
}

onPlayerDocumentAdded((doc) => void installFont(doc));

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
  skinFont = skin.assets.fonts.display ?? null;
  applySkinTokens(valid);
  applySkinAssets(skin.assets, !!skinFont);
  await Promise.all(playerDocuments().map(installFont));
  if (useSkinAccent && skin.accent) setAccentColor(skin.accent);
  if (!state.restoring) persistConfig();
  pushSettingsState();
}
