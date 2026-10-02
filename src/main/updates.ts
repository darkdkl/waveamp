import { app, dialog, shell } from "electron";
import { loadConfig } from "./config";
import { writeLog } from "./logging";
import { REQUEST_TIMEOUT_MS, USER_AGENT, netRequestJson } from "./network";
import { getAppLanguage } from "./menus";
import { getMainWindow, sendToMainWindow } from "./windows";
import { isNewerVersion, isReleasePageUrl, parseLatestRelease, type ReleaseInfo } from "./version";
import type { UpdateCheckResult } from "../shared/types";
import { errorMessage } from "../shared/errors";

const LATEST_RELEASE_API = "https://api.github.com/repos/darkdkl/waveamp/releases/latest";

let autoUpdateEnabled = true;

const UPDATE_STRINGS = {
  ru: {
    message: (version: string) => `Доступна новая версия WaveAMP ${version}`,
    detail: (current: string) => `У вас установлена версия ${current}. Скачайте установщик для своей системы на странице релиза.`,
    download: "Скачать",
    later: "Позже",
    skip: "Пропустить эту версию",
  },
  en: {
    message: (version: string) => `WaveAMP ${version} is available`,
    detail: (current: string) => `You have version ${current}. Download the installer for your system from the release page.`,
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
  if (!app.isPackaged) return;
  if (!autoUpdateEnabled) {
    writeLog("info", "updater", "Launch check disabled");
    return;
  }
  try {
    const { version, url } = await fetchLatestRelease();
    writeLog("info", "updater", `Launch check: latest v${version}, installed v${app.getVersion()}`);
    if (!isNewerVersion(version, app.getVersion())) return;
    if (loadConfig()?.settings?.skippedUpdateVersion === version) {
      writeLog("info", "updater", `v${version} was skipped by the user`);
      return;
    }
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
    const parent = process.platform === "darwin" ? null : getMainWindow();
    const { response } = await (parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options));
    writeLog("info", "updater", `Update dialog answered: ${["download", "later", "skip"][response] ?? response}`);
    if (response === 0) openReleasePage(url);
    if (response === 2) sendToMainWindow("skip-update-version", version);
  } catch (err) {
    writeLog("error", "updater", `Launch check failed: ${errorMessage(err)}`);
  }
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    const { version, url } = await fetchLatestRelease();
    return { ok: true, upToDate: !isNewerVersion(version, app.getVersion()), version, url };
  } catch (err) {
    writeLog("error", "updater", `Manual check failed: ${errorMessage(err)}`);
    return { ok: false, message: errorMessage(err) };
  }
}
