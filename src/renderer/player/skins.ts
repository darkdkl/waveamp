import { DEFAULT_SKIN_ID, type LoadedSkin } from "../../shared/skin";
import { errorMessage } from "../../shared/errors";
import { applySkinAssets, applySkinTokens, installSkinFont } from "../skin";
import { state } from "./state";
import { logEvent } from "./log";
import { persistConfig } from "./config";
import { pushSettingsState, setAccentColor } from "./settingsBridge";
import { onPlayerDocumentAdded, playerDocuments } from "./documents";

let skinFont: Uint8Array<ArrayBuffer> | null = null;
let queue: Promise<void> = Promise.resolve();

function installFont(doc: Document): Promise<void> {
  return installSkinFont(doc, skinFont).catch((err) => {
    logEvent("warn", "skin", `"${state.skinId}": display font: ${errorMessage(err)}`);
  });
}

onPlayerDocumentAdded((doc) => void installFont(doc));

function inOrder(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch((err) => logEvent("warn", "skin", errorMessage(err)));
  return queue;
}

export async function refreshSkins(): Promise<void> {
  try {
    state.skins = (await window.electronAPI?.listSkins?.()) ?? [];
  } catch (err) {
    logEvent("warn", "skin", `Cannot list skins: ${errorMessage(err)}`);
  }
  pushSettingsState();
}

async function readSkin(id: string): Promise<LoadedSkin | null> {
  try {
    const skin = await window.electronAPI?.readSkin?.(id);
    if (skin) return skin;
  } catch (err) {
    logEvent("warn", "skin", `"${id}": ${errorMessage(err)}`);
  }
  logEvent("warn", "skin", `"${id}" could not be loaded`);
  return null;
}

async function applySkin(id: string, useSkinAccent: boolean): Promise<void> {
  const skin = (await readSkin(id)) ?? (id !== DEFAULT_SKIN_ID ? await readSkin(DEFAULT_SKIN_ID) : null);
  if (!skin) return;
  for (const key of skin.skipped) logEvent("warn", "skin", `"${skin.id}": ${key} has an invalid value`);
  state.skinId = skin.id;
  state.skinAccent = skin.accent;
  state.skinTokens = skin.tokens;
  skinFont = skin.assets.fonts.display ?? null;
  applySkinTokens(skin.tokens);
  applySkinAssets(skin.assets, playerDocuments());
  if (useSkinAccent && skin.accent) setAccentColor(skin.accent);
  if (!state.restoring) persistConfig();
  pushSettingsState();
  await Promise.all(playerDocuments().map(installFont));
}

export function setSkin(id: string, useSkinAccent: boolean): Promise<void> {
  return inOrder(() => applySkin(id, useSkinAccent));
}

function reloadSkins(changed: string[] | null): void {
  void refreshSkins();
  void inOrder(async () => {
    if (state.skinId !== DEFAULT_SKIN_ID && (!changed || changed.includes(state.skinId))) await applySkin(state.skinId, false);
  });
}

export function initSkins(): void {
  window.electronAPI?.onSkinsChanged?.((changed) => reloadSkins(changed));
}
