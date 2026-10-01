import { contextBridge, ipcRenderer, webUtils, webFrame } from "electron";
import type {
  AppConfig,
  CountedOption,
  CountryOption,
  GlobalHotkeyRequest,
  LogLevel,
  MediaKeyAction,
  ProxyConfig,
  ResolveStreamResult,
  SettingsAction,
  SettingsState,
  Station,
  StationSearchParams,
  StoredConfig,
  TrackTags,
  UpdateCheckResult,
} from "../shared/types";

// Sandboxed preload has no node:url; the drive-letter colon must stay unencoded.
function pathToFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const driveMatch = /^([a-zA-Z]):\//.exec(normalized);
  if (driveMatch) {
    const rest = normalized.slice(driveMatch[0].length);
    const encoded = rest.split("/").map(encodeURIComponent).join("/");
    return `file:///${driveMatch[1]}:/${encoded}`;
  }
  const encoded = normalized.split("/").map(encodeURIComponent).join("/");
  return "file://" + encoded;
}

const api = {
  minimizeWindow: (): void => ipcRenderer.send("window-minimize"),
  closeWindow: (): void => ipcRenderer.send("window-close"),
  resizeWindow: (height: number, width: number): void => ipcRenderer.send("window-resize", height, width),
  resizeWindowInstant: (height: number, width: number): void => ipcRenderer.send("window-resize-instant", height, width),
  setZoomFactor: (factor: number): void => webFrame.setZoomFactor(factor),
  loadConfig: (): Promise<StoredConfig | null> => ipcRenderer.invoke("config-load"),
  saveConfig: (config: AppConfig): void => ipcRenderer.send("config-save", config),
  readTrackTags: (filePath: string): Promise<TrackTags> => ipcRenderer.invoke("read-track-tags", filePath),
  getFilePath: (file: File): string | null => {
    try {
      return webUtils.getPathForFile(file) || null;
    } catch {
      return null;
    }
  },
  getFileUrl: (filePath: string): string => pathToFileUrl(filePath),
  searchStations: (params: StationSearchParams): Promise<Station[]> => ipcRenderer.invoke("radio-search", params),
  loadCountries: (): Promise<CountryOption[]> => ipcRenderer.invoke("radio-countries"),
  loadStates: (countryName: string): Promise<CountedOption[]> => ipcRenderer.invoke("radio-states", countryName),
  loadTags: (): Promise<CountedOption[]> => ipcRenderer.invoke("radio-tags"),
  loadTagsForFilter: (countryCode: string, state: string): Promise<CountedOption[]> => ipcRenderer.invoke("radio-tags-for-filter", countryCode, state),
  registerStationClick: (uuid: string): Promise<string | null> => ipcRenderer.invoke("radio-click", uuid),
  resolveStreamUrl: (url: string): Promise<ResolveStreamResult> => ipcRenderer.invoke("radio-resolve-stream", url),
  applyProxyConfig: (config: ProxyConfig): void => ipcRenderer.send("apply-proxy-config", config),
  setLoggingEnabled: (enabled: boolean): void => ipcRenderer.send("set-logging-enabled", enabled),
  log: (level: LogLevel, scope: string, message: string): void => ipcRenderer.send("log", level, scope, message),
  openLogFolder: (): Promise<string> => ipcRenderer.invoke("open-log-folder"),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),
  openLicenseFile: (name: string): Promise<string> => ipcRenderer.invoke("open-license-file", name),
  clearLogs: (): Promise<void> => ipcRenderer.invoke("clear-logs"),
  setAutoUpdateEnabled: (enabled: boolean): void => ipcRenderer.send("set-auto-update-enabled", enabled),
  checkForUpdates: (): Promise<UpdateCheckResult> => ipcRenderer.invoke("check-for-updates"),
  openReleasePage: (url: string): void => ipcRenderer.send("open-release-page", url),
  onSkipUpdateVersion: (callback: (version: string) => void) => ipcRenderer.on("skip-update-version", (_event, version) => callback(version)),
  onMediaKey: (callback: (action: MediaKeyAction) => void) => ipcRenderer.on("media-key", (_event, action) => callback(action)),
  setGlobalHotkeys: (config: GlobalHotkeyRequest): Promise<string[]> => ipcRenderer.invoke("set-global-hotkeys", config),
  onHotkey: (callback: (action: string) => void) => ipcRenderer.on("hotkey", (_event, action) => callback(action)),
  showAppMenu: (): void => ipcRenderer.send("show-app-menu"),
  openSettingsWindow: (): void => ipcRenderer.send("open-settings-window"),
  closeSettingsWindow: (): void => ipcRenderer.send("settings-window-close"),
  setSettingsWindowScale: (percent: number): void => ipcRenderer.send("settings-window-scale", percent),
  setTrayIconEnabled: (enabled: boolean): void => ipcRenderer.send("set-tray-icon-enabled", enabled),
  setCloseMinimizesToTray: (enabled: boolean): void => ipcRenderer.send("set-close-minimizes-to-tray", enabled),
  sendSettingsAction: (action: SettingsAction): void => ipcRenderer.send("settings-action-from-window", action),
  onSettingsAction: (callback: (action: SettingsAction) => void) => ipcRenderer.on("settings-action", (_event, action) => callback(action)),
  requestSettingsState: (): void => ipcRenderer.send("settings-request-state"),
  onSettingsStateRequested: (callback: () => void) => ipcRenderer.on("settings-state-requested", () => callback()),
  pushSettingsState: (state: SettingsState): void => ipcRenderer.send("settings-state-from-main", state),
  onSettingsState: (callback: (state: SettingsState) => void) => ipcRenderer.on("settings-state", (_event, state) => callback(state)),
};

export type ElectronAPI = typeof api;

contextBridge.exposeInMainWorld("electronAPI", api);
