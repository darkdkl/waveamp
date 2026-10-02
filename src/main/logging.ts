import { app, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import type { LogLevel } from "../shared/types";

const LOG_DIR = path.join(app.getPath("userData"), "logs");
const LOG_RETENTION_DAYS = 14;
let loggingEnabled = false;

function logFilePath(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return path.join(LOG_DIR, `waveamp-${y}-${m}-${d}.log`);
}

export function setLoggingEnabled(enabled: boolean): void {
  loggingEnabled = enabled;
}

export function isLoggingEnabled(): boolean {
  return loggingEnabled;
}

export function writeLog(level: LogLevel, scope: string, message: string, origin = "main"): void {
  if (!loggingEnabled) return;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const line = `[${new Date().toISOString()}] [${origin}] [${level}] [${scope}] ${message}\n`;
    fs.appendFileSync(logFilePath(), line);
  } catch (err) {
    console.error("Failed to write log:", err);
  }
}

export function pruneOldLogs(): void {
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  try {
    for (const name of fs.readdirSync(LOG_DIR)) {
      const full = path.join(LOG_DIR, name);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
  } catch {
  }
}

export function clearLogs(): void {
  try {
    for (const name of fs.readdirSync(LOG_DIR)) {
      fs.unlinkSync(path.join(LOG_DIR, name));
    }
  } catch {
  }
}

export function openLogFolder(): Promise<string> {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  return shell.openPath(LOG_DIR);
}
