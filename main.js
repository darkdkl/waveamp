const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, net, session, shell, dialog, globalShortcut, screen } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const WINDOW_WIDTH = 480;
const RESIZE_DURATION_MS = 180;
const ICON_PATH = path.join(__dirname, "assets", "icon.png");
const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error("Failed to save config:", err);
    writeLog("error", "config", `Failed to save config: ${err.message}`);
  }
}

const LOG_DIR = path.join(app.getPath("userData"), "logs");
const LOG_RETENTION_DAYS = 14;
let loggingEnabled = false;

function logFilePath(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return path.join(LOG_DIR, `waveamp-${y}-${m}-${d}.log`);
}

function writeLog(level, scope, message, origin = "main") {
  if (!loggingEnabled) return;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const line = `[${new Date().toISOString()}] [${origin}] [${level}] [${scope}] ${message}\n`;
    fs.appendFileSync(logFilePath(), line);
  } catch (err) {
    console.error("Failed to write log:", err);
  }
}

function pruneOldLogs() {
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  try {
    for (const name of fs.readdirSync(LOG_DIR)) {
      const full = path.join(LOG_DIR, name);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
  } catch {
  }
}

function clearLogs() {
  try {
    for (const name of fs.readdirSync(LOG_DIR)) {
      fs.unlinkSync(path.join(LOG_DIR, name));
    }
  } catch {
  }
}

let currentProxyAuth = null;

async function applyProxyConfig(proxyConfig) {
  if (!proxyConfig?.enabled || !proxyConfig.host || !proxyConfig.port) {
    await session.defaultSession.setProxy({ proxyRules: "direct://" });
    // setProxy() keeps reusing pooled connections; drop them so the change applies now.
    await session.defaultSession.closeAllConnections();
    currentProxyAuth = null;
    return;
  }
  const hostPort = `${proxyConfig.host}:${proxyConfig.port}`;
  const proxyRules =
    proxyConfig.type === "socks5" ? `socks5://${hostPort}` : `http=${hostPort};https=${hostPort}`;
  await session.defaultSession.setProxy({ proxyRules, proxyBypassRules: "<local>" });
  await session.defaultSession.closeAllConnections();
  currentProxyAuth = proxyConfig.username ? { username: proxyConfig.username, password: proxyConfig.password || "" } : null;
  writeLog("info", "proxy", `Applied ${proxyConfig.type} proxy ${hostPort}`);
}

app.on("login", (event, webContents, details, authInfo, callback) => {
  if (authInfo.isProxy && currentProxyAuth) {
    event.preventDefault();
    callback(currentProxyAuth.username, currentProxyAuth.password);
  }
});

const RADIO_API_MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://de2.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
];
const RADIO_USER_AGENT = `WaveAMP/${app.getVersion()} (https://github.com/darkdkl/waveamp)`;
const RADIO_API_TIMEOUT_MS = 8000;

// net.request, not fetch(): only the Chromium network stack honors session.setProxy().
function netRequestJson(url, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: "GET" });
    Object.entries(headers).forEach(([key, value]) => request.setHeader(key, value));

    let settled = false;
    // abort() emits "abort", not "error" — reject explicitly or a hung mirror never settles.
    const timer = setTimeout(() => {
      finish(reject, new Error(`Timed out after ${timeoutMs} ms`));
      request.abort();
    }, timeoutMs);
    function finish(fn, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    }

    request.on("login", (authInfo, callback) => {
      if (currentProxyAuth) callback(currentProxyAuth.username, currentProxyAuth.password);
      else callback();
    });

    request.on("response", (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        finish(reject, new Error(`HTTP ${response.statusCode}`));
        return;
      }
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          finish(resolve, JSON.parse(body));
        } catch (err) {
          finish(reject, err);
        }
      });
      response.on("error", (err) => finish(reject, err));
    });
    request.on("error", (err) => finish(reject, err));
    request.end();
  });
}

async function radioApiFetch(pathAndQuery) {
  let lastErr;
  for (const base of RADIO_API_MIRRORS) {
    try {
      return await netRequestJson(base + pathAndQuery, { "User-Agent": RADIO_USER_AGENT }, RADIO_API_TIMEOUT_MS);
    } catch (err) {
      lastErr = err;
      writeLog("warn", "radio-api", `Mirror ${base} failed for ${pathAndQuery}: ${err.message}`);
    }
  }
  writeLog("error", "radio-api", `All mirrors failed for ${pathAndQuery}: ${lastErr?.message}`);
  throw lastErr;
}

function stationSummary(s) {
  return {
    stationuuid: s.stationuuid,
    name: s.name,
    url: s.url_resolved || s.url,
    favicon: s.favicon || "",
    tags: s.tags || "",
    country: s.country || "",
    countrycode: s.countrycode || "",
    state: s.state || "",
    bitrate: s.bitrate || 0,
    codec: s.codec || "",
  };
}

// The API's tag filter is case-sensitive (pop ≠ Pop), so filter by tag locally.
const TAG_MATCH_SAMPLE_SIZE = 250;

async function searchStations(params = {}) {
  const limit = params.limit || 40;
  const q = new URLSearchParams();
  if (params.name) q.set("name", params.name);
  if (params.country) q.set("countrycode", params.country);
  if (params.state) q.set("state", params.state);
  q.set("limit", String(params.tag ? TAG_MATCH_SAMPLE_SIZE : limit));
  q.set("hidebroken", "true");
  q.set("order", "votes");
  q.set("reverse", "true");
  const data = await radioApiFetch(`/json/stations/search?${q.toString()}`);
  const stations = data.map(stationSummary);
  if (!params.tag) return stations;

  const wantedTag = params.tag.toLowerCase();
  return stations
    .filter((s) =>
      s.tags
        .split(",")
        .some((tag) => tag.trim().toLowerCase() === wantedTag)
    )
    .slice(0, limit);
}

// Native <select> popups can't be height-limited, so cap the number of options.
const COUNTRY_LIMIT = 40;
const STATE_LIMIT = 30;
const TAG_LIMIT = 30;
const TAG_SAMPLE_SIZE = 500;

async function fetchCountries() {
  const data = await radioApiFetch("/json/countries");
  return data
    .filter((c) => c.iso_3166_1 && c.stationcount > 0)
    .map((c) => ({ code: c.iso_3166_1, name: c.name, count: c.stationcount }))
    .sort((a, b) => b.count - a.count)
    .slice(0, COUNTRY_LIMIT);
}

// Despite its path, this endpoint takes the country name, not the ISO code.
async function fetchStates(countryName) {
  const data = await radioApiFetch(`/json/states/${encodeURIComponent(countryName)}/`);
  return data
    .filter((s) => s.name && s.stationcount > 0)
    .map((s) => ({ name: s.name, count: s.stationcount }))
    .sort((a, b) => b.count - a.count)
    .slice(0, STATE_LIMIT);
}

async function fetchTags() {
  const data = await radioApiFetch(`/json/tags?order=stationcount&reverse=true&limit=${TAG_LIMIT}`);
  return data.filter((t) => t.name).map((t) => ({ name: t.name, count: t.stationcount }));
}

async function fetchTagsForFilter(countryCode, state) {
  if (!countryCode && !state) return fetchTags();
  const q = new URLSearchParams();
  if (countryCode) q.set("countrycode", countryCode);
  if (state) q.set("state", state);
  q.set("hidebroken", "true");
  q.set("order", "votes");
  q.set("reverse", "true");
  q.set("limit", String(TAG_SAMPLE_SIZE));
  const data = await radioApiFetch(`/json/stations/search?${q.toString()}`);
  const counts = new Map();
  for (const s of data) {
    for (const tag of (s.tags || "").split(",")) {
      const name = tag.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TAG_LIMIT);
}

async function registerStationClick(uuid) {
  try {
    const data = await radioApiFetch(`/json/url/${encodeURIComponent(uuid)}`);
    return data.url || null;
  } catch {
    return null;
  }
}

const resizeTimers = new WeakMap();

function cancelResize(win) {
  const existing = resizeTimers.get(win);
  if (existing) {
    clearInterval(existing);
    resizeTimers.delete(win);
  }
}

function animateResize(win, targetWidth, targetHeight) {
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

function setAppMenu() {
  if (process.platform === "darwin") {
    // App menu only, so Cmd+Q and friends keep working.
    const template = [
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

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: 198,
    useContentSize: true,
    resizable: false,
    frame: false,
    backgroundColor: "#16181c",
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close();
  });

  win.loadFile("index.html");
}

// Settings state is owned by app.js (it also writes the playlist/EQ part of
// config.json); this window only relays changes, never writes config.
let settingsWindow = null;

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  const hasParent = mainWindow && !mainWindow.isDestroyed();
  const bounds = hasParent ? mainWindow.getBounds() : null;
  settingsScale = savedScalePercent();
  const size = settingsWindowSize(SETTINGS_WINDOW_SIZE, settingsScale);
  const minSize = settingsWindowSize(SETTINGS_WINDOW_MIN_SIZE, settingsScale);
  settingsWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: minSize.width,
    minHeight: minSize.height,
    x: bounds ? bounds.x + bounds.width + 12 : undefined,
    y: bounds ? bounds.y : undefined,
    title: "WaveAMP — Settings",
    // Not modal: on macOS a modal child becomes a sheet without a close button.
    parent: hasParent ? mainWindow : undefined,
    frame: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: "#16181c",
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  settingsWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== settingsWindow.webContents.getURL()) event.preventDefault();
  });

  settingsWindow.loadFile("settings.html");
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

const SETTINGS_WINDOW_SIZE = { width: 378, height: 468 };
const SETTINGS_WINDOW_MIN_SIZE = { width: 324, height: 324 };
let settingsScale = 100;

function savedScalePercent() {
  const scale = loadConfig()?.settings?.scale;
  return typeof scale === "number" ? Math.min(150, Math.max(70, Math.round(scale / 10) * 10)) : 100;
}

function settingsWindowSize({ width, height }, percent) {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  return {
    width: Math.min(Math.round((width * percent) / 100), workArea.width),
    height: Math.min(Math.round((height * percent) / 100), workArea.height),
  };
}

ipcMain.on("settings-window-scale", (event, percent) => {
  if (!settingsWindow || settingsWindow.isDestroyed() || !(percent > 0) || percent === settingsScale) return;
  const ratio = percent / settingsScale;
  settingsScale = percent;
  const minSize = settingsWindowSize(SETTINGS_WINDOW_MIN_SIZE, percent);
  settingsWindow.setMinimumSize(minSize.width, minSize.height);
  const [width, height] = settingsWindow.getSize();
  const display = screen.getDisplayMatching(settingsWindow.getBounds()).workAreaSize;
  settingsWindow.setSize(
    Math.min(Math.round(width * ratio), display.width),
    Math.min(Math.round(height * ratio), display.height)
  );
});

function openSettingsWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
  createSettingsWindow();
}

ipcMain.on("settings-action-from-window", (event, action) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("settings-action", action);
});

ipcMain.on("settings-request-state", () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("settings-state-requested");
});

ipcMain.on("settings-state-from-main", (event, state) => {
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send("settings-state", state);
});

// Media Session (app.js) already routes media keys on macOS/Windows; this is
// a fallback, and registration is expected to fail on macOS.
function sendMediaKey(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("media-key", action);
  }
}

function registerMediaKeys() {
  const bindings = {
    MediaPlayPause: "playpause",
    MediaNextTrack: "next",
    MediaPreviousTrack: "previous",
    MediaStop: "stop",
  };
  for (const [accelerator, action] of Object.entries(bindings)) {
    const ok = globalShortcut.register(accelerator, () => sendMediaKey(action));
    if (!ok) writeLog("info", "media-keys", `${accelerator} not registered (OS already routes it via Media Session)`);
  }
}

let registeredHotkeys = [];

const ACCELERATOR_KEYS = {
  ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
  Comma: ",", Period: ".", Slash: "/", Backslash: "\\", Semicolon: ";", Quote: "'",
  BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=", Backquote: "`",
};

function comboToAccelerator(combo) {
  const parts = combo.split("+");
  const code = parts.pop();
  const mods = parts.map((mod) =>
    ({ Ctrl: "Control", Alt: "Alt", Shift: "Shift", Meta: process.platform === "darwin" ? "Command" : "Super" })[mod]
  );
  let key = ACCELERATOR_KEYS[code];
  if (!key && /^Key[A-Z]$/.test(code)) key = code.slice(3);
  if (!key && /^Digit\d$/.test(code)) key = code.slice(5);
  if (!key && /^Numpad\d$/.test(code)) key = "num" + code.slice(6);
  if (!key && /^(F\d{1,2}|Space|Home|End|PageUp|PageDown|Insert|Delete|Tab|Enter|Escape|Backspace)$/.test(code)) key = code;
  return key && !mods.includes(undefined) ? [...mods, key].join("+") : null;
}

function applyGlobalHotkeys({ enabled, bindings } = {}) {
  for (const accelerator of registeredHotkeys) globalShortcut.unregister(accelerator);
  registeredHotkeys = [];
  const failed = [];
  if (!enabled) return failed;
  for (const [action, combo] of Object.entries(bindings || {})) {
    if (!combo) continue;
    const accelerator = comboToAccelerator(combo);
    let ok = false;
    try {
      ok = !!accelerator && globalShortcut.register(accelerator, () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("hotkey", action);
      });
    } catch {
      ok = false;
    }
    if (ok) {
      registeredHotkeys.push(accelerator);
    } else {
      failed.push(action);
      writeLog("warn", "hotkeys", `Could not register ${accelerator || combo} for ${action}`);
    }
  }
  return failed;
}

ipcMain.handle("set-global-hotkeys", (event, config) => applyGlobalHotkeys(config));

let tray = null;
let mainLang = "ru";
let showTrayIconEnabled = false;
let closeMinimizesToTrayEnabled = false;

const MENU_STRINGS = {
  ru: { playPause: "Play/Pause", next: "Следующая", previous: "Предыдущая", settings: "Настройки", quit: "Выход" },
  en: { playPause: "Play/Pause", next: "Next", previous: "Previous", settings: "Settings", quit: "Quit" },
};

function buildAppMenu() {
  const s = MENU_STRINGS[mainLang] || MENU_STRINGS.ru;
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

// A tray icon may not render on Linux, so only macOS hides; elsewhere minimize.
function toggleMainWindowVisibility() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
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

function syncTray() {
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

function syncDockMenu() {
  if (process.platform === "darwin" && app.dock) {
    app.dock.setMenu(buildAppMenu());
  }
}

ipcMain.on("show-app-menu", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) buildAppMenu().popup({ window: win });
});

ipcMain.on("open-settings-window", () => openSettingsWindow());

ipcMain.on("set-tray-icon-enabled", (event, enabled) => {
  showTrayIconEnabled = !!enabled;
  if (!showTrayIconEnabled) closeMinimizesToTrayEnabled = false;
  syncTray();
  writeLog("info", "tray", `Tray icon ${showTrayIconEnabled ? "enabled" : "disabled"}`);
});

ipcMain.on("set-close-minimizes-to-tray", (event, enabled) => {
  closeMinimizesToTrayEnabled = !!enabled && showTrayIconEnabled;
});

ipcMain.on("window-minimize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.minimize();
});

ipcMain.on("window-close", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  if (closeMinimizesToTrayEnabled) {
    if (process.platform === "darwin") win.hide();
    else win.minimize();
  } else {
    win.close();
  }
});

ipcMain.on("settings-window-close", () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close();
});

ipcMain.on("window-resize", (event, height, width) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const targetWidth = Number.isFinite(width) ? width : WINDOW_WIDTH;
  if (win && !win.isDestroyed() && Number.isFinite(height)) {
    animateResize(win, Math.round(targetWidth), Math.round(height));
  }
});

ipcMain.on("window-resize-instant", (event, height, width) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const targetWidth = Number.isFinite(width) ? width : WINDOW_WIDTH;
  if (win && !win.isDestroyed() && Number.isFinite(height)) {
    cancelResize(win);
    win.setContentSize(Math.round(targetWidth), Math.round(height), false);
  }
});

ipcMain.handle("config-load", () => loadConfig());

ipcMain.on("config-save", (event, config) => {
  saveConfig(config);
  const lang = config?.settings?.lang === "en" ? "en" : "ru";
  if (lang !== mainLang) {
    mainLang = lang;
    syncTray();
    syncDockMenu();
  }
});

// Tags decoded as latin1 may really be UTF-8 ("FÃ¼r") or old Russian cp1251 ("Êèíî").
// Valid UTF-8 wins; cp1251 only when high-byte characters outnumber ASCII letters.
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const cp1251Decoder = new TextDecoder("windows-1251");
function fixMojibake(text) {
  if (!text || /[^\x00-\xff]/.test(text)) return text;
  const high = (text.match(/[\x80-\xff]/g) || []).length;
  if (high === 0) return text;
  const bytes = Buffer.from(text, "latin1");
  try {
    return utf8Decoder.decode(bytes);
  } catch {
    const asciiLetters = (text.match(/[a-z]/gi) || []).length;
    return high < asciiLetters ? text : cp1251Decoder.decode(bytes);
  }
}

// music-metadata is ESM-only.
let musicMetadata = null;
async function readTrackTags(filePath) {
  musicMetadata ??= await import("music-metadata");
  const { common, format } = await musicMetadata.parseFile(filePath, { skipCovers: true });
  return {
    title: fixMojibake(common.title) || null,
    artist: fixMojibake(common.artist || common.albumartist) || null,
    album: fixMojibake(common.album) || null,
    duration: Number.isFinite(format.duration) ? format.duration : null,
  };
}

ipcMain.handle("read-track-tags", (event, filePath) =>
  readTrackTags(filePath).catch((err) => {
    writeLog("warn", "tags", `Could not read tags for "${filePath}": ${err.message}`);
    return null;
  })
);

ipcMain.handle("radio-search", (event, params) => searchStations(params));
ipcMain.handle("radio-countries", () => fetchCountries());
ipcMain.handle("radio-states", (event, countryName) => fetchStates(countryName));
ipcMain.handle("radio-tags", () => fetchTags());
ipcMain.handle("radio-tags-for-filter", (event, countryCode, state) => fetchTagsForFilter(countryCode, state));
ipcMain.handle("radio-click", (event, uuid) => registerStationClick(uuid));

ipcMain.on("apply-proxy-config", (event, proxyConfig) => {
  applyProxyConfig(proxyConfig).catch((err) => writeLog("error", "proxy", `Failed to apply: ${err.message}`));
});

ipcMain.on("set-logging-enabled", (event, enabled) => {
  loggingEnabled = !!enabled;
  writeLog("info", "app", `Logging ${loggingEnabled ? "enabled" : "disabled"}`);
});

ipcMain.on("log", (event, level, scope, message) => writeLog(level, scope, message, "renderer"));

ipcMain.handle("open-log-folder", () => {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  return shell.openPath(LOG_DIR);
});

ipcMain.handle("get-app-version", () => app.getVersion());

// Shipped next to app.asar, not inside it: an external editor can't open files in the archive.
const LICENSE_FILES = new Set(["LICENSE", "THIRD_PARTY_LICENSES.txt"]);

ipcMain.handle("open-license-file", async (event, name) => {
  if (!LICENSE_FILES.has(name)) return "unknown file";
  const file = path.join(app.isPackaged ? process.resourcesPath : __dirname, name);
  const error = await shell.openPath(file);
  if (error) writeLog("error", "app", `Could not open ${file}: ${error}`);
  return error;
});

ipcMain.handle("clear-logs", () => clearLogs());

let autoUpdateEnabled = true;

const RELEASES_URL = "https://github.com/darkdkl/waveamp/releases/";
const LATEST_RELEASE_API = "https://api.github.com/repos/darkdkl/waveamp/releases/latest";

const UPDATE_STRINGS = {
  ru: {
    message: (version) => `Доступна новая версия WaveAMP ${version}`,
    detail: (current) => `У вас установлена версия ${current}. Скачайте установщик для своей системы на странице релиза.`,
    download: "Скачать",
    later: "Позже",
    skip: "Пропустить эту версию",
  },
  en: {
    message: (version) => `WaveAMP ${version} is available`,
    detail: (current) => `You have version ${current}. Download the installer for your system from the release page.`,
    download: "Download",
    later: "Later",
    skip: "Skip this version",
  },
};

function isNewerVersion(candidate, current) {
  const a = candidate.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

async function fetchLatestRelease() {
  const data = await netRequestJson(
    LATEST_RELEASE_API,
    { "User-Agent": RADIO_USER_AGENT, Accept: "application/vnd.github+json" },
    RADIO_API_TIMEOUT_MS
  );
  const version = String(data.tag_name || "").replace(/^v/, "");
  const url = String(data.html_url || "");
  if (!/^\d+\.\d+\.\d+$/.test(version) || !url.startsWith(RELEASES_URL)) {
    throw new Error("Unexpected release data");
  }
  return { version, url };
}

function openReleasePage(url) {
  if (typeof url === "string" && url.startsWith(RELEASES_URL)) shell.openExternal(url);
}

async function checkForUpdatesOnLaunch() {
  if (!app.isPackaged || !autoUpdateEnabled) return;
  try {
    const { version, url } = await fetchLatestRelease();
    if (!isNewerVersion(version, app.getVersion())) return;
    if (loadConfig()?.settings?.skippedUpdateVersion === version) return;
    writeLog("info", "updater", `Update available: v${version}`);
    const s = UPDATE_STRINGS[mainLang] || UPDATE_STRINGS.ru;
    const options = {
      type: "info",
      buttons: [s.download, s.later, s.skip],
      defaultId: 0,
      cancelId: 1,
      message: s.message(version),
      detail: s.detail(app.getVersion()),
    };
    const hasWindow = mainWindow && !mainWindow.isDestroyed();
    const { response } = await (hasWindow ? dialog.showMessageBox(mainWindow, options) : dialog.showMessageBox(options));
    if (response === 0) openReleasePage(url);
    if (response === 2 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("skip-update-version", version);
    }
  } catch (err) {
    writeLog("error", "updater", `Launch check failed: ${err.message}`);
  }
}

ipcMain.on("set-auto-update-enabled", (event, enabled) => {
  autoUpdateEnabled = !!enabled;
  writeLog("info", "updater", `Check-on-launch ${autoUpdateEnabled ? "enabled" : "disabled"}`);
});

ipcMain.handle("check-for-updates", async () => {
  try {
    const { version, url } = await fetchLatestRelease();
    return { ok: true, upToDate: !isNewerVersion(version, app.getVersion()), version, url };
  } catch (err) {
    writeLog("error", "updater", `Manual check failed: ${err.message}`);
    return { ok: false, message: err.message };
  }
});

ipcMain.on("open-release-page", (event, url) => openReleasePage(url));

app.whenReady().then(() => {
  const config = loadConfig();
  loggingEnabled = !!config?.settings?.loggingEnabled;
  autoUpdateEnabled = config?.settings?.autoUpdateEnabled !== false;
  mainLang = config?.settings?.lang === "en" ? "en" : "ru";
  showTrayIconEnabled = !!config?.settings?.showTrayIcon;
  closeMinimizesToTrayEnabled = !!config?.settings?.closeMinimizesToTray && showTrayIconEnabled;
  pruneOldLogs();
  writeLog("info", "app", `App starting (v${app.getVersion()})`);
  if (config?.settings?.proxy) {
    applyProxyConfig(config.settings.proxy).catch((err) => writeLog("error", "proxy", `Failed to apply: ${err.message}`));
  }

  setAppMenu();

  if (process.platform === "darwin" && app.dock) {
    try {
      app.dock.setIcon(ICON_PATH);
    } catch (err) {
      console.error("Failed to set dock icon:", err);
      writeLog("warn", "app", `Failed to set dock icon: ${err.message}`);
    }
  }

  createWindow();
  checkForUpdatesOnLaunch();
  registerMediaKeys();
  syncTray();
  syncDockMenu();

  app.on("activate", () => {
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
