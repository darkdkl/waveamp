import { app, BrowserWindow, screen, type WebContents } from "electron";
import path from "node:path";
import { loadConfig } from "./config";
import { normalizeScalePercent, rescaledSize, scaledSize, type Size } from "./windowSizing";

const WINDOW_WIDTH = 480;
const RESIZE_DURATION_MS = 180;
export const ICON_PATH = path.join(app.getAppPath(), "assets", "icon.png");
const PRELOAD_PATH = path.join(__dirname, "../preload/index.js");

const REVEAL_FALLBACK_MS = 2000;

const SETTINGS_WINDOW_SIZE: Size = { width: 378, height: 468 };
const SETTINGS_WINDOW_MIN_SIZE: Size = { width: 324, height: 324 };

let mainWindow: BrowserWindow | null = null;
// Settings state is owned by the player window (it also writes the playlist/EQ part of
// config.json); this window only relays changes, never writes config.
let settingsWindow: BrowserWindow | null = null;
let settingsScale = 100;

function isAlive(win: BrowserWindow | null): win is BrowserWindow {
  return !!win && !win.isDestroyed();
}

export function getMainWindow(): BrowserWindow | null {
  return isAlive(mainWindow) ? mainWindow : null;
}

export function sendToMainWindow(channel: string, ...args: unknown[]): void {
  if (isAlive(mainWindow)) mainWindow.webContents.send(channel, ...args);
}

export function sendToSettingsWindow(channel: string, ...args: unknown[]): void {
  if (isAlive(settingsWindow)) settingsWindow.webContents.send(channel, ...args);
}

const pendingReveals = new Map<number, () => void>();

function revealWhenReady(win: BrowserWindow): Promise<void> {
  const id = win.webContents.id;
  return new Promise((resolve) => {
    const reveal = () => {
      if (!pendingReveals.has(id)) return;
      pendingReveals.delete(id);
      clearTimeout(timer);
      if (!win.isDestroyed()) win.show();
      resolve();
    };
    const timer = setTimeout(reveal, REVEAL_FALLBACK_MS);
    pendingReveals.set(id, reveal);
    win.on("closed", () => {
      pendingReveals.delete(id);
      clearTimeout(timer);
      resolve();
    });
  });
}

export function revealSenderWindow(sender: WebContents): void {
  pendingReveals.get(sender.id)?.();
}

function loadRenderer(win: BrowserWindow, page: string): void {
  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devServerUrl) win.loadURL(`${devServerUrl}/${page}`);
  else win.loadFile(path.join(__dirname, "../renderer", page));
}

const resizeTimers = new WeakMap<BrowserWindow, ReturnType<typeof setInterval>>();

function cancelResize(win: BrowserWindow): void {
  const existing = resizeTimers.get(win);
  if (existing) {
    clearInterval(existing);
    resizeTimers.delete(win);
  }
}

function animateResize(win: BrowserWindow, targetWidth: number, targetHeight: number): void {
  cancelResize(win);

  const [startWidth, startHeight] = win.getContentSize();
  const widthDelta = targetWidth - startWidth;
  const heightDelta = targetHeight - startHeight;
  if (widthDelta === 0 && heightDelta === 0) return;

  const frameMs = 16;
  const totalSteps = Math.max(1, Math.round(RESIZE_DURATION_MS / frameMs));
  let step = 0;

  const timer = setInterval(() => {
    step += 1;
    if (win.isDestroyed()) {
      clearInterval(timer);
      return;
    }

    const t = Math.min(1, step / totalSteps);
    const eased = 1 - (1 - t) ** 3;
    win.setContentSize(
      Math.round(startWidth + widthDelta * eased),
      Math.round(startHeight + heightDelta * eased),
      false
    );

    if (t >= 1) {
      clearInterval(timer);
      resizeTimers.delete(win);
    }
  }, frameMs);

  resizeTimers.set(win, timer);
}

export function resizeSenderWindow(sender: WebContents, height: number, width: number, instant: boolean): void {
  const win = BrowserWindow.fromWebContents(sender);
  const targetWidth = Number.isFinite(width) ? width : WINDOW_WIDTH;
  if (!win || win.isDestroyed() || !Number.isFinite(height)) return;
  if (instant) {
    cancelResize(win);
    win.setContentSize(Math.round(targetWidth), Math.round(height), false);
  } else if (process.platform === "darwin") {
    cancelResize(win);
    win.setContentSize(Math.round(targetWidth), Math.round(height), true);
  } else {
    animateResize(win, Math.round(targetWidth), Math.round(height));
  }
}

export function minimizeSenderWindow(sender: WebContents): void {
  const win = BrowserWindow.fromWebContents(sender);
  if (win && !win.isDestroyed()) win.minimize();
}

export function closeSenderWindow(sender: WebContents, hideInstead: boolean): void {
  const win = BrowserWindow.fromWebContents(sender);
  if (!win || win.isDestroyed()) return;
  if (hideInstead) {
    if (process.platform === "darwin") win.hide();
    else win.minimize();
  } else {
    win.close();
  }
}

export function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: 198,
    show: false,
    useContentSize: true,
    resizable: false,
    frame: false,
    backgroundColor: "#16181c",
    icon: ICON_PATH,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });

  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
    if (isAlive(settingsWindow)) settingsWindow.close();
  });

  const shown = revealWhenReady(win);
  loadRenderer(win, "index.html");
  return shown;
}

function settingsWindowSize(size: Size, percent: number): Size {
  return scaledSize(size, percent, screen.getPrimaryDisplay().workAreaSize);
}

function createSettingsWindow(): void {
  if (isAlive(settingsWindow)) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  const parent = getMainWindow();
  const bounds = parent ? parent.getBounds() : null;
  settingsScale = normalizeScalePercent(loadConfig()?.settings?.scale);
  const size = settingsWindowSize(SETTINGS_WINDOW_SIZE, settingsScale);
  const minSize = settingsWindowSize(SETTINGS_WINDOW_MIN_SIZE, settingsScale);
  const win = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: minSize.width,
    minHeight: minSize.height,
    x: bounds ? bounds.x + bounds.width + 12 : undefined,
    y: bounds ? bounds.y : undefined,
    title: "WaveAMP — Settings",
    show: false,
    // Not modal: on macOS a modal child becomes a sheet without a close button.
    parent: parent ?? undefined,
    frame: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: "#16181c",
    icon: ICON_PATH,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow = win;

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });

  revealWhenReady(win);
  loadRenderer(win, "settings.html");
  win.on("closed", () => {
    settingsWindow = null;
  });
}

export function openSettingsWindow(): void {
  const main = getMainWindow();
  if (main) {
    main.show();
    main.focus();
  }
  createSettingsWindow();
}

export function closeSettingsWindow(): void {
  if (isAlive(settingsWindow)) settingsWindow.close();
}

export function setSettingsWindowScale(percent: number): void {
  if (!isAlive(settingsWindow) || !(percent > 0) || percent === settingsScale) return;
  const ratio = percent / settingsScale;
  settingsScale = percent;
  const minSize = settingsWindowSize(SETTINGS_WINDOW_MIN_SIZE, percent);
  settingsWindow.setMinimumSize(minSize.width, minSize.height);
  const [width, height] = settingsWindow.getSize();
  const display = screen.getDisplayMatching(settingsWindow.getBounds()).workAreaSize;
  const next = rescaledSize({ width, height }, ratio, display);
  settingsWindow.setSize(next.width, next.height);
}
