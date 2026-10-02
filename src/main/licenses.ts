import { app, shell } from "electron";
import path from "node:path";
import { writeLog } from "./logging";

// Shipped next to app.asar, not inside it: an external editor can't open files in the archive.
const LICENSE_FILES = new Set(["LICENSE", "THIRD_PARTY_LICENSES.txt"]);

export async function openLicenseFile(name: string): Promise<string> {
  if (!LICENSE_FILES.has(name)) return "unknown file";
  const file = path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), name);
  const error = await shell.openPath(file);
  if (error) writeLog("error", "app", `Could not open ${file}: ${error}`);
  return error;
}
