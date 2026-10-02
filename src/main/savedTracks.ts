import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import { writeLog } from "./logging";
import { normalizeSavedTracks } from "../shared/savedTracks";
import { errorMessage } from "../shared/errors";
import type { SavedTrack } from "../shared/types";

const SAVED_TRACKS_PATH = path.join(app.getPath("userData"), "saved-tracks.json");
const SAVED_TRACKS_VERSION = 1;

export function loadSavedTracks(): SavedTrack[] {
  try {
    return normalizeSavedTracks(JSON.parse(fs.readFileSync(SAVED_TRACKS_PATH, "utf-8"))?.tracks);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      writeLog("error", "saved-tracks", `Failed to read saved tracks: ${errorMessage(err)}`);
      try {
        fs.copyFileSync(SAVED_TRACKS_PATH, SAVED_TRACKS_PATH + ".bad");
      } catch {}
    }
    return [];
  }
}

export function writeSavedTracks(tracks: unknown): void {
  const tempPath = SAVED_TRACKS_PATH + ".tmp";
  try {
    const data = { version: SAVED_TRACKS_VERSION, tracks: normalizeSavedTracks(tracks) };
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, SAVED_TRACKS_PATH);
  } catch (err) {
    writeLog("error", "saved-tracks", `Failed to save saved tracks: ${errorMessage(err)}`);
  }
}
