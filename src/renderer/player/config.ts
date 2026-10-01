import { i18n } from "../i18n";
import { volume } from "./dom";
import { state } from "./state";
import { BASE_ZOOM } from "./layout";
import { getProxyConfig } from "./settingsBridge";

const CONFIG_VERSION = 1;
let persistTimer = null;

export function persistConfig(): void {
  if (!window.electronAPI?.saveConfig) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    window.electronAPI.saveConfig({
      version: CONFIG_VERSION,
      playlist: {
        tracks: state.queue
          .filter((track) => track.path)
          .map((track) => ({ name: track.name, path: track.path })),
        currentIndex: state.currentIndex,
      },
      eq: {
        bandGains: [...state.bandGains],
        preampDb: state.preampDb,
        enabled: state.eqEnabled,
        preset: state.eqPreset,
        custom: state.customEq,
      },
      radio: {
        favorites: state.favoriteStations,
      },
      settings: {
        lang: i18n.getLanguage(),
        scale: Math.round((state.uiScale / BASE_ZOOM) * 100),
        accentColor: state.accentColor,
        vizResponse: state.vizResponse,
        hotkeys: state.hotkeyConfig,
        volume: Number(volume.value),
        loggingEnabled: state.loggingEnabled,
        proxy: getProxyConfig(),
        autoUpdateEnabled: state.autoUpdateEnabled,
        skippedUpdateVersion: state.skippedUpdateVersion,
        showTrayIcon: state.trayIconEnabled,
        closeMinimizesToTray: state.closeMinimizesToTrayEnabled,
      },
      ui: {
        playlistOpen: state.playlistOpen,
        eqOpen: state.eqOpen,
        radioOpen: state.radioOpen,
        vizMode: state.vizMode,
      },
    });
  }, 300);
}
