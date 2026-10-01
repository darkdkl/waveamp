import { i18n } from "../i18n";
import { accentColor as accentColorTheme } from "../theme";
import { settingsBtn } from "./dom";
import { state } from "./state";
import { persistConfig } from "./config";
import { BASE_ZOOM, setScale } from "./layout";
import { setVizResponse } from "./visualizer";
import { renderPlaylist } from "./playlist";
import { updateTrackTitleText } from "./playback";
import { refreshRadioEmptyText, renderRadioFavorites, renderRadioResults } from "./radio/panel";
import { updateStationFormText } from "./radio/stationForm";
import { tuneStation } from "./radio/stream";
import { setHotkeys } from "./playerHotkeys";
import type { AccentColor, ProxyConfig } from "../../shared/types";

export function getProxyConfig(): ProxyConfig {
  return { ...state.proxy };
}

function syncProxyConfig(): void {
  window.electronAPI?.applyProxyConfig?.(getProxyConfig());
  persistConfig();
  // A playing stream may not error on a proxy change — reconnect it now.
  if (state.playbackMode === "radio" && state.currentStation) {
    tuneStation(state.currentStation);
  }
}

export function setProxySettings(proxy: Partial<ProxyConfig>): void {
  state.proxy.type = proxy.type === "socks5" ? "socks5" : "http";
  state.proxy.host = proxy.host || "";
  state.proxy.port = proxy.port || "";
  state.proxy.username = proxy.username || "";
  state.proxy.password = proxy.password || "";
  state.proxy.enabled = !!proxy.enabled;
  syncProxyConfig();
}

export function setLoggingEnabled(enabled: boolean): void {
  state.loggingEnabled = enabled;
  window.electronAPI?.setLoggingEnabled?.(enabled);
  persistConfig();
}

export function setAutoUpdateEnabled(enabled: boolean): void {
  state.autoUpdateEnabled = enabled;
  window.electronAPI?.setAutoUpdateEnabled?.(enabled);
  persistConfig();
}

export function setCloseMinimizesToTrayEnabled(enabled: boolean): void {
  state.closeMinimizesToTrayEnabled = enabled;
  window.electronAPI?.setCloseMinimizesToTray?.(enabled);
  persistConfig();
}

export function setTrayIconEnabled(enabled: boolean): void {
  state.trayIconEnabled = enabled;
  if (!enabled && state.closeMinimizesToTrayEnabled) setCloseMinimizesToTrayEnabled(false);
  window.electronAPI?.setTrayIconEnabled?.(enabled);
  persistConfig();
}

export function setLanguage(lang: string): void {
  i18n.setLanguage(lang);
  updateTrackTitleText();
  refreshRadioEmptyText();
  renderPlaylist();
  renderRadioResults();
  renderRadioFavorites();
  updateStationFormText();
  persistConfig();
}

export function setAccentColor(color: Partial<AccentColor>): void {
  state.accentColor = accentColorTheme.normalize(color);
  accentColorTheme.apply(state.accentColor);
  persistConfig();
}

export function pushSettingsState(): void {
  window.electronAPI?.pushSettingsState?.({
    lang: i18n.getLanguage(),
    scale: Math.round((state.uiScale / BASE_ZOOM) * 100),
    zoomFactor: state.uiScale,
    accentColor: state.accentColor,
    vizResponse: state.vizResponse,
    hotkeys: state.hotkeyConfig,
    globalHotkeyFailures: state.globalHotkeyFailures,
    proxy: getProxyConfig(),
    loggingEnabled: state.loggingEnabled,
    autoUpdateEnabled: state.autoUpdateEnabled,
    showTrayIcon: state.trayIconEnabled,
    closeMinimizesToTray: state.closeMinimizesToTrayEnabled,
  });
}

export function initSettingsButton(): void {
  settingsBtn.addEventListener("click", () => {
    window.electronAPI?.openSettingsWindow?.();
  });
}

export function initSettingsBridge(): void {
  window.electronAPI?.onSettingsAction?.((action) => {
    switch (action.type) {
      case "setLanguage":
        setLanguage(action.value);
        break;
      case "setScale":
        setScale(action.value);
        break;
      case "setAccentColor":
        setAccentColor(action.value);
        break;
      case "setVizResponse":
        setVizResponse(action.value);
        break;
      case "setHotkeys":
        setHotkeys(action.value);
        return;
      case "setProxyConfig":
        setProxySettings(action.value);
        break;
      case "setLoggingEnabled":
        setLoggingEnabled(!!action.value);
        break;
      case "setAutoUpdateEnabled":
        setAutoUpdateEnabled(!!action.value);
        break;
      case "setTrayIconEnabled":
        setTrayIconEnabled(!!action.value);
        break;
      case "setCloseMinimizesToTrayEnabled":
        setCloseMinimizesToTrayEnabled(!!action.value);
        break;
      default:
        return;
    }
    pushSettingsState();
  });

  window.electronAPI?.onSettingsStateRequested?.(() => pushSettingsState());
}

export function initSkipUpdateVersion(): void {
  window.electronAPI?.onSkipUpdateVersion?.((version) => {
    state.skippedUpdateVersion = version;
    persistConfig();
  });
}
