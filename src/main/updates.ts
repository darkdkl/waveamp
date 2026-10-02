import { app, dialog, shell } from "electron";
import { loadConfig } from "./config";
import { writeLog } from "./logging";
import { REQUEST_TIMEOUT_MS, USER_AGENT, netRequestJson } from "./network";
import { getAppLanguage } from "./menus";
import { getMainWindow, sendToMainWindow } from "./windows";
import { isNewerVersion, isReleasePageUrl, parseLatestRelease, type ReleaseInfo } from "./version";
import type { UpdateCheckResult } from "../shared/types";

const LATEST_RELEASE_API = "https://api.github.com/repos/darkdkl/waveamp/releases/latest";

let autoUpdateEnabled = true;

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

export function setAutoUpdateEnabled(enabled: boolean): void {
  autoUpdateEnabled = enabled;
}

async function fetchLatestRelease(): Promise<ReleaseInfo> {
  const data = await netRequestJson(
    LATEST_RELEASE_API,
    { "User-Agent": USER_AGENT, Accept: "application/vnd.github+json" },
    REQUEST_TIMEOUT_MS
  );
  return parseLatestRelease(data);
}

export function openReleasePage(url: unknown): void {
  if (isReleasePageUrl(url)) shell.openExternal(url);
}

export async function checkForUpdatesOnLaunch(): Promise<void> {
  if (!app.isPackaged || !autoUpdateEnabled) return;
  try {
    const { version, url } = await fetchLatestRelease();
    if (!isNewerVersion(version, app.getVersion())) return;
    if (loadConfig()?.settings?.skippedUpdateVersion === version) return;
    writeLog("info", "updater", `Update available: v${version}`);
    const s = UPDATE_STRINGS[getAppLanguage()] || UPDATE_STRINGS.ru;
    const options: Electron.MessageBoxOptions = {
      type: "info",
      buttons: [s.download, s.later, s.skip],
      defaultId: 0,
      cancelId: 1,
      message: s.message(version),
      detail: s.detail(app.getVersion()),
    };
    const mainWindow = getMainWindow();
    const { response } = await (mainWindow ? dialog.showMessageBox(mainWindow, options) : dialog.showMessageBox(options));
    if (response === 0) openReleasePage(url);
    if (response === 2) sendToMainWindow("skip-update-version", version);
  } catch (err) {
    writeLog("error", "updater", `Launch check failed: ${err.message}`);
  }
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    const { version, url } = await fetchLatestRelease();
    return { ok: true, upToDate: !isNewerVersion(version, app.getVersion()), version, url };
  } catch (err) {
    writeLog("error", "updater", `Manual check failed: ${err.message}`);
    return { ok: false, message: err.message };
  }
}
