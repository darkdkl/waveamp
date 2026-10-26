import { app, BrowserWindow, clipboard, dialog, ipcMain, type WebContents } from "electron";
import { loadConfig, saveConfig } from "./config";
import { clearLogs, openLogFolder, setLoggingEnabled, isLoggingEnabled, writeLog } from "./logging";
import { applyProxyConfig } from "./network";
import {
  fetchCountries,
  fetchStates,
  fetchTags,
  fetchTagsForFilter,
  currentRadioMirror,
  refreshRadioMirrors,
  registerStationClick,
  resolveStreamUrl,
  searchStations,
  showRadioSourcesFile,
} from "./radioApi";
import {
  closeSenderWindow,
  closeSettingsWindow,
  resizeSettingsWindowBy,
  startSettingsWindowResize,
  minimizeSenderWindow,
  revealSenderWindow,
  openSettingsWindow,
  resizeSenderWindow,
  sendToMainWindow,
  sendToSettingsWindow,
  setMainWindowFullScreen,
  setSettingsWindowScale,
} from "./windows";
import {
  closeMinimizesToTray,
  setAppLanguage,
  setCloseMinimizesToTray,
  setTrayIconEnabled,
  showAppMenu,
} from "./menus";
import { applyGlobalHotkeys } from "./shortcuts";
import { readAudioFormat, readTrackTags } from "./tags";
import { systemNaturalScroll } from "./scrollDirection";
import { audioSegment, readAudioData } from "./audioData";
import { cancelAnalysisRead, readSamplesInWorker } from "./analysisReader";
import {
  canPositionWindows,
  dockNameOf,
  isManagedName,
  resizeDock,
  setDockZoom,
  setSeparateWindows,
  startDockDrag,
  startDockResize,
  stopDockDrag,
  stopDockResize,
  toggleDockFull,
  updateDock,
} from "./dock";
import { expandPlaylistPaths } from "./cue";
import { readCoverArt } from "./coverArt";
import { checkForUpdates, openReleasePage, setAutoUpdateEnabled } from "./updates";
import { openLicenseFile } from "./licenses";
import { startNowPlaying, stopNowPlaying } from "./nowPlaying";
import { loadSavedTracks, writeSavedTracks } from "./savedTracks";
import { choosePresetFolder, listPresets, readPreset } from "./presets";
import type {
  AppConfig,
  DockLayout,
  DockUpdate,
  GlobalHotkeyRequest,
  LogLevel,
  ProxyConfig,
  SettingsAction,
  SettingsState,
  StationSearchParams,
} from "../shared/types";

export function registerIpcHandlers(): void {
  ipcMain.on("settings-window-scale", (_event, percent: number) => setSettingsWindowScale(percent));

  ipcMain.on("settings-window-resize-start", () => startSettingsWindowResize());
  ipcMain.on("settings-window-resize", (_event, delta: number) => resizeSettingsWindowBy(Number(delta)));

  ipcMain.on("settings-action-from-window", (_event, action: SettingsAction) => {
    sendToMainWindow("settings-action", action);
  });

  ipcMain.on("settings-request-state", () => {
    sendToMainWindow("settings-state-requested");
  });

  ipcMain.on("settings-state-from-main", (_event, state: SettingsState) => {
    sendToSettingsWindow("settings-state", state);
  });

  ipcMain.handle("set-global-hotkeys", (_event, config: GlobalHotkeyRequest) => applyGlobalHotkeys(config));

  ipcMain.on("show-app-menu", (event) => showAppMenu(event.sender));

  ipcMain.on("open-settings-window", () => openSettingsWindow());

  ipcMain.on("set-tray-icon-enabled", (_event, enabled: boolean) => setTrayIconEnabled(!!enabled));

  ipcMain.on("set-close-minimizes-to-tray", (_event, enabled: boolean) => setCloseMinimizesToTray(!!enabled));

  ipcMain.on("window-ready", (event) => revealSenderWindow(event.sender));

  ipcMain.on("set-full-screen", (_event, enabled: boolean) => setMainWindowFullScreen(!!enabled));

  ipcMain.handle("system-natural-scroll", () => systemNaturalScroll());

  ipcMain.handle("dock-set-separate", (_event, enabled: boolean, layout: DockLayout) => setSeparateWindows(!!enabled, layout));

  ipcMain.on("dock-update", (_event, update: DockUpdate) => updateDock(update));

  ipcMain.on("dock-zoom", (_event, factor: number) => setDockZoom(Number(factor)));

  const dockTarget = (sender: WebContents, name: unknown) => {
    const own = dockNameOf(sender);
    return own === "main" && isManagedName(name) ? name : own;
  };

  ipcMain.on("dock-drag-start", (event, name: unknown) => {
    const target = dockTarget(event.sender, name);
    if (target) startDockDrag(target);
  });

  ipcMain.on("dock-drag-end", () => stopDockDrag());

  ipcMain.handle("dock-can-position", () => canPositionWindows());

  ipcMain.on("dock-resize-start", (event, name: unknown, edge: unknown, width: unknown, height: unknown) => {
    const target = dockTarget(event.sender, name);
    const min = { width: Number(width), height: Number(height) };
    if (!target || (edge !== "left" && edge !== "right") || !(min.width > 0) || !(min.height > 0)) return;
    startDockResize(target, edge, min);
  });

  ipcMain.on("dock-resize", (_event, dx: unknown, dy: unknown) => resizeDock({ x: Number(dx) || 0, y: Number(dy) || 0 }));

  ipcMain.on("dock-resize-end", () => stopDockResize());

  ipcMain.on("dock-toggle-full", (event, name: unknown) => {
    const target = dockTarget(event.sender, name);
    if (target) toggleDockFull(target);
  });

  ipcMain.on("window-minimize", (event) => minimizeSenderWindow(event.sender));

  ipcMain.on("window-close", (event) => closeSenderWindow(event.sender, closeMinimizesToTray()));

  ipcMain.on("settings-window-close", () => closeSettingsWindow());

  ipcMain.on("window-resize", (event, height: number, width: number) => {
    resizeSenderWindow(event.sender, height, width, false);
  });

  ipcMain.on("window-resize-instant", (event, height: number, width: number) => {
    resizeSenderWindow(event.sender, height, width, true);
  });

  ipcMain.handle("config-load", () => loadConfig());

  ipcMain.on("config-save", (_event, config: AppConfig) => {
    saveConfig(config);
    setAppLanguage(config?.settings?.lang === "en" ? "en" : "ru");
  });

  ipcMain.handle("read-track-tags", (_event, filePath: string) =>
    readTrackTags(filePath).catch((err) => {
      writeLog("warn", "tags", `Could not read tags for "${filePath}": ${err.message}`);
      return null;
    })
  );

  ipcMain.handle("read-audio-format", (_event, filePath: string) =>
    readAudioFormat(filePath).catch((err) => {
      writeLog("warn", "tags", `Could not read the audio format of "${filePath}": ${err.message}`);
      return null;
    })
  );

  ipcMain.handle("expand-playlist-paths", (_event, paths: string[]) =>
    expandPlaylistPaths(Array.isArray(paths) ? paths.filter((p) => typeof p === "string") : []).catch((err) => {
      writeLog("warn", "cue", `Could not expand playlist paths: ${err.message}`);
      return paths.map((p) => ({ path: p }));
    })
  );

  ipcMain.handle("read-track-cover", (_event, filePath: string) => readCoverArt(filePath));

  ipcMain.handle("read-audio-data", (_event, filePath: string, alac: boolean, start: unknown, end: unknown) =>
    readAudioData(String(filePath), alac === true, audioSegment(start, end), readSamplesInWorker).catch((err) => {
      writeLog("warn", "chords", `Could not read "${filePath}" for chord analysis: ${err.message}`);
      return { ok: false, error: "failed" } as const;
    })
  );

  ipcMain.on("cancel-audio-data", () => cancelAnalysisRead());

  ipcMain.handle("radio-search", (_event, params: StationSearchParams) => searchStations(params));
  ipcMain.handle("radio-countries", () => fetchCountries());
  ipcMain.handle("radio-states", (_event, countryName: string) => fetchStates(countryName));
  ipcMain.handle("radio-tags", () => fetchTags());
  ipcMain.handle("radio-tags-for-filter", (_event, countryCode: string, state: string) =>
    fetchTagsForFilter(countryCode, state)
  );
  ipcMain.handle("radio-click", (_event, uuid: string) => registerStationClick(uuid));
  ipcMain.handle("radio-resolve-stream", (_event, url: string) => resolveStreamUrl(url));

  ipcMain.on("now-playing-start", (_event, url: string) => startNowPlaying(String(url)));
  ipcMain.on("now-playing-stop", () => stopNowPlaying());

  ipcMain.handle("saved-tracks-load", () => loadSavedTracks());
  ipcMain.on("saved-tracks-save", (_event, tracks: unknown) => writeSavedTracks(tracks));

  ipcMain.handle("presets-list", (_event, folder: string) => listPresets(typeof folder === "string" ? folder : ""));
  ipcMain.handle("presets-read", (_event, index: number) => readPreset(Number(index)));
  ipcMain.handle("presets-choose-folder", (event) => choosePresetFolder(BrowserWindow.fromWebContents(event.sender)));

  ipcMain.on("copy-text", (_event, text: string) => clipboard.writeText(String(text)));

  ipcMain.handle("confirm", async (event, message: string, yes: string, cancel: string) => {
    const options = { type: "question" as const, message, buttons: [yes, cancel], defaultId: 1, cancelId: 1, noLink: true };
    const win = BrowserWindow.fromWebContents(event.sender);
    const { response } = await (win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options));
    return response === 0;
  });

  ipcMain.on("apply-proxy-config", (_event, proxyConfig: ProxyConfig) => {
    applyProxyConfig(proxyConfig).catch((err) => writeLog("error", "proxy", `Failed to apply: ${err.message}`));
  });

  ipcMain.on("set-logging-enabled", (_event, enabled: boolean) => {
    setLoggingEnabled(!!enabled);
    writeLog("info", "app", `Logging ${isLoggingEnabled() ? "enabled" : "disabled"}`);
  });

  ipcMain.on("log", (_event, level: LogLevel, scope: string, message: string) =>
    writeLog(level, scope, message, "renderer")
  );

  ipcMain.handle("open-log-folder", () => openLogFolder());
  ipcMain.handle("radio-mirror-current", () => currentRadioMirror());
  ipcMain.handle("radio-mirrors-refresh", () => refreshRadioMirrors());
  ipcMain.on("radio-sources-show", () => showRadioSourcesFile());

  ipcMain.handle("get-app-version", () => app.getVersion());

  ipcMain.handle("open-license-file", (_event, name: string) => openLicenseFile(name));

  ipcMain.handle("clear-logs", () => clearLogs());

  ipcMain.on("set-auto-update-enabled", (_event, enabled: boolean) => {
    setAutoUpdateEnabled(!!enabled);
    writeLog("info", "updater", `Check-on-launch ${enabled ? "enabled" : "disabled"}`);
  });

  ipcMain.handle("check-for-updates", () => checkForUpdates());

  ipcMain.on("open-release-page", (_event, url: string) => openReleasePage(url));
}
