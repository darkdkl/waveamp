import { app, BrowserWindow, Menu, Tray, nativeImage, type WebContents } from "electron";
import { writeLog } from "./logging";
import { ICON_PATH, getMainWindow, openSettingsWindow } from "./windows";
import { sendMediaKey } from "./shortcuts";
import type { Lang } from "../shared/types";
import { errorMessage } from "../shared/errors";

let tray: Tray | null = null;
let appLang: Lang = "ru";
let showTrayIconEnabled = false;
let closeMinimizesToTrayEnabled = false;

const MENU_STRINGS = {
  ru: { playPause: "Play/Pause", next: "Следующая", previous: "Предыдущая", settings: "Настройки", quit: "Выход" },
  en: { playPause: "Play/Pause", next: "Next", previous: "Previous", settings: "Settings", quit: "Quit" },
};

export function setAppMenu(): void {
  if (process.platform === "darwin") {
    // App menu only, so Cmd+Q and friends keep working.
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  } else {
    Menu.setApplicationMenu(null);
  }
}

function buildAppMenu(): Menu {
  const s = MENU_STRINGS[appLang] || MENU_STRINGS.ru;
  return Menu.buildFromTemplate([
    { label: s.playPause, click: () => sendMediaKey("playpause") },
    { label: s.next, click: () => sendMediaKey("next") },
    { label: s.previous, click: () => sendMediaKey("previous") },
    { type: "separator" },
    { label: s.settings, click: () => openSettingsWindow() },
    { type: "separator" },
    { label: s.quit, click: () => app.quit() },
  ]);
}

export function showAppMenu(sender: WebContents): void {
  const win = BrowserWindow.fromWebContents(sender);
  if (win && !win.isDestroyed()) buildAppMenu().popup({ window: win });
}

// A tray icon may not render on Linux, so only macOS hides; elsewhere minimize.
function toggleMainWindowVisibility(): void {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;
  if (process.platform === "darwin") {
    if (mainWindow.isVisible()) mainWindow.hide();
    else {
      mainWindow.show();
      mainWindow.focus();
    }
  } else if (mainWindow.isMinimized() || !mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.restore();
    mainWindow.focus();
  } else {
    mainWindow.minimize();
  }
}

export function syncTray(): void {
  if (showTrayIconEnabled) {
    if (!tray) {
      const icon = nativeImage.createFromPath(ICON_PATH).resize({ width: 18, height: 18 });
      tray = new Tray(icon);
      tray.setToolTip("WaveAMP");
      tray.on("click", toggleMainWindowVisibility);
    }
    tray.setContextMenu(buildAppMenu());
  } else if (tray) {
    tray.destroy();
    tray = null;
  }
}

export function syncDockMenu(): void {
  if (process.platform === "darwin" && app.dock) {
    app.dock.setMenu(buildAppMenu());
  }
}

export function getAppLanguage(): Lang {
  return appLang;
}

export function initMenuPreferences(lang: Lang, showTrayIcon: boolean, closeMinimizesToTray: boolean): void {
  appLang = lang;
  showTrayIconEnabled = showTrayIcon;
  closeMinimizesToTrayEnabled = closeMinimizesToTray && showTrayIcon;
}

export function setAppLanguage(lang: Lang): void {
  if (lang === appLang) return;
  appLang = lang;
  syncTray();
  syncDockMenu();
}

export function setTrayIconEnabled(enabled: boolean): void {
  showTrayIconEnabled = enabled;
  if (!showTrayIconEnabled) closeMinimizesToTrayEnabled = false;
  syncTray();
  writeLog("info", "tray", `Tray icon ${showTrayIconEnabled ? "enabled" : "disabled"}`);
}

export function setCloseMinimizesToTray(enabled: boolean): void {
  closeMinimizesToTrayEnabled = enabled && showTrayIconEnabled;
}

export function closeMinimizesToTray(): boolean {
  return closeMinimizesToTrayEnabled;
}

export function setDockIcon(): void {
  if (process.platform === "darwin" && app.dock) {
    try {
      app.dock.setIcon(ICON_PATH);
    } catch (err) {
      console.error("Failed to set dock icon:", err);
      writeLog("warn", "app", `Failed to set dock icon: ${errorMessage(err)}`);
    }
  }
}
