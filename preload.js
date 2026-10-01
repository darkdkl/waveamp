const { contextBridge, ipcRenderer, webUtils, webFrame } = require("electron");

// Sandboxed preload has no node:url; the drive-letter colon must stay unencoded.
function pathToFileUrl(filePath) {
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

contextBridge.exposeInMainWorld("electronAPI", {
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  closeWindow: () => ipcRenderer.send("window-close"),
  resizeWindow: (height, width) => ipcRenderer.send("window-resize", height, width),
  resizeWindowInstant: (height, width) => ipcRenderer.send("window-resize-instant", height, width),
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor),
  loadConfig: () => ipcRenderer.invoke("config-load"),
  saveConfig: (config) => ipcRenderer.send("config-save", config),
  readTrackTags: (filePath) => ipcRenderer.invoke("read-track-tags", filePath),
  getFilePath: (file) => {
    try {
      return webUtils.getPathForFile(file) || null;
    } catch {
      return null;
    }
  },
  getFileUrl: (filePath) => pathToFileUrl(filePath),
  searchStations: (params) => ipcRenderer.invoke("radio-search", params),
  loadCountries: () => ipcRenderer.invoke("radio-countries"),
  loadStates: (countryName) => ipcRenderer.invoke("radio-states", countryName),
  loadTags: () => ipcRenderer.invoke("radio-tags"),
  loadTagsForFilter: (countryCode, state) => ipcRenderer.invoke("radio-tags-for-filter", countryCode, state),
  registerStationClick: (uuid) => ipcRenderer.invoke("radio-click", uuid),
  applyProxyConfig: (config) => ipcRenderer.send("apply-proxy-config", config),
  setLoggingEnabled: (enabled) => ipcRenderer.send("set-logging-enabled", enabled),
  log: (level, scope, message) => ipcRenderer.send("log", level, scope, message),
  openLogFolder: () => ipcRenderer.invoke("open-log-folder"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  openLicenseFile: (name) => ipcRenderer.invoke("open-license-file", name),
  clearLogs: () => ipcRenderer.invoke("clear-logs"),
  setAutoUpdateEnabled: (enabled) => ipcRenderer.send("set-auto-update-enabled", enabled),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  onMediaKey: (callback) => ipcRenderer.on("media-key", (event, action) => callback(action)),
  setGlobalHotkeys: (config) => ipcRenderer.invoke("set-global-hotkeys", config),
  onHotkey: (callback) => ipcRenderer.on("hotkey", (event, action) => callback(action)),
  showAppMenu: () => ipcRenderer.send("show-app-menu"),
  openSettingsWindow: () => ipcRenderer.send("open-settings-window"),
  closeSettingsWindow: () => ipcRenderer.send("settings-window-close"),
  setSettingsWindowScale: (percent) => ipcRenderer.send("settings-window-scale", percent),
  setTrayIconEnabled: (enabled) => ipcRenderer.send("set-tray-icon-enabled", enabled),
  setCloseMinimizesToTray: (enabled) => ipcRenderer.send("set-close-minimizes-to-tray", enabled),
  sendSettingsAction: (action) => ipcRenderer.send("settings-action-from-window", action),
  onSettingsAction: (callback) => ipcRenderer.on("settings-action", (event, action) => callback(action)),
  requestSettingsState: () => ipcRenderer.send("settings-request-state"),
  onSettingsStateRequested: (callback) => ipcRenderer.on("settings-state-requested", () => callback()),
  pushSettingsState: (state) => ipcRenderer.send("settings-state-from-main", state),
  onSettingsState: (callback) => ipcRenderer.on("settings-state", (event, state) => callback(state)),
});
