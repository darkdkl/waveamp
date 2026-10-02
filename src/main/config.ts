import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import { writeLog } from "./logging";
import type { AppConfig, StoredConfig } from "../shared/types";
import { errorMessage } from "../shared/errors";

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

export function loadConfig(): StoredConfig | null {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return null;
  }
}

export function saveConfig(config: AppConfig): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error("Failed to save config:", err);
    writeLog("error", "config", `Failed to save config: ${errorMessage(err)}`);
  }
}
