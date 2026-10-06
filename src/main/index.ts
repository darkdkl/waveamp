import { app, BrowserWindow, globalShortcut } from "electron";
import { loadConfig } from "./config";
import { pruneOldLogs, setLoggingEnabled, writeLog } from "./logging";
import { applyProxyConfig, registerProxyLogin } from "./network";
import { createWindow, getMainWindow } from "./windows";
import { initMenuPreferences, setAppMenu, setDockIcon, syncDockMenu, syncTray } from "./menus";
import { registerMediaKeys } from "./shortcuts";
import { checkForUpdatesOnLaunch, setAutoUpdateEnabled } from "./updates";
import { registerIpcHandlers } from "./ipc";
import { handleAlacProtocol, registerAlacScheme } from "./alac/protocol";

registerAlacScheme();
registerProxyLogin();
registerIpcHandlers();

app.whenReady().then(() => {
  const config = loadConfig();
  const settings = config?.settings;
  setLoggingEnabled(!!settings?.loggingEnabled);
  setAutoUpdateEnabled(settings?.autoUpdateEnabled !== false);
  initMenuPreferences(settings?.lang === "en" ? "en" : "ru", !!settings?.showTrayIcon, !!settings?.closeMinimizesToTray);
  pruneOldLogs();
  handleAlacProtocol();
  writeLog("info", "app", `App starting (v${app.getVersion()})`);
  const proxyReady = settings?.proxy
    ? applyProxyConfig(settings.proxy).catch((err) => writeLog("error", "proxy", `Failed to apply: ${err.message}`))
    : Promise.resolve();

  setAppMenu();
  setDockIcon();

  const windowShown = createWindow();
  Promise.all([proxyReady, windowShown]).then(() => checkForUpdatesOnLaunch());
  registerMediaKeys();
  syncTray();
  syncDockMenu();

  app.on("activate", () => {
    const mainWindow = getMainWindow();
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("render-process-gone", (event, webContents, details) => {
  writeLog("error", "app", `Renderer process gone: ${details.reason}`);
});

app.on("window-all-closed", () => {
  writeLog("info", "app", "App quitting");
  if (process.platform !== "darwin") app.quit();
});
