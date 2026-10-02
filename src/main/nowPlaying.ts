import { net } from "electron";
import { answerProxyLogin, REQUEST_TIMEOUT_MS, USER_AGENT } from "./network";
import { IcyMetadataReader, icyPollDelay, isBlockingStatus, parseMetaInt, parseStreamTitle } from "./icyMetadata";
import { isHttpUrl } from "./streamUrl";
import { writeLog } from "./logging";
import { getMainWindow, sendToMainWindow } from "./windows";
import { errorMessage } from "../shared/errors";
import type { NowPlayingUpdate } from "../shared/types";

const ICY_MAX_METADATA_BLOCKS = 3;

class NoIcyMetadataError extends Error {}

class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

const urlsNotPolled = new Set<string>();
let pollUrl: string | null = null;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let pollToken = 0;

function fetchIcyTitle(url: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: "GET" });
    request.setHeader("Icy-MetaData", "1");
    request.setHeader("User-Agent", USER_AGENT);

    let settled = false;
    const timer = setTimeout(() => finish(() => reject(new Error(`Timed out after ${REQUEST_TIMEOUT_MS} ms`))), REQUEST_TIMEOUT_MS);
    function finish(settle: () => void): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      request.abort();
      settle();
    }

    request.on("login", (_authInfo, callback) => answerProxyLogin(callback));
    request.on("response", (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        finish(() => reject(new HttpStatusError(response.statusCode)));
        return;
      }
      const metaint = parseMetaInt(response.headers["icy-metaint"]);
      if (!metaint) {
        finish(() => reject(new NoIcyMetadataError()));
        return;
      }
      const reader = new IcyMetadataReader(metaint);
      let blocks = 0;
      response.on("data", (chunk: Buffer) => {
        const block = reader.push(chunk);
        if (!block) return;
        const title = parseStreamTitle(block);
        blocks += 1;
        if (title || blocks >= ICY_MAX_METADATA_BLOCKS) finish(() => resolve(title));
      });
      response.on("end", () => finish(() => resolve(null)));
      response.on("error", (err) => finish(() => reject(err)));
    });
    request.on("error", (err) => finish(() => reject(err)));
    request.end();
  });
}

function sendUpdate(update: NowPlayingUpdate): void {
  sendToMainWindow("now-playing", update);
}

function stopPollingStation(url: string, reason: string): void {
  urlsNotPolled.add(url);
  writeLog("info", "now-playing", `${url}: ${reason}, not polling it again`);
  sendUpdate({ url, title: null });
}

async function poll(url: string, token: number, failures: number): Promise<void> {
  try {
    const title = await fetchIcyTitle(url);
    if (token !== pollToken) return;
    sendUpdate({ url, title });
    failures = 0;
  } catch (err) {
    if (token !== pollToken) return;
    if (err instanceof NoIcyMetadataError) {
      stopPollingStation(url, "no track metadata");
      return;
    }
    if (err instanceof HttpStatusError && isBlockingStatus(err.status)) {
      stopPollingStation(url, `server refused metadata requests (HTTP ${err.status})`);
      return;
    }
    failures += 1;
    writeLog("warn", "now-playing", `Metadata poll failed for ${url}: ${errorMessage(err)}`);
  }
  if (getMainWindow()) pollTimer = setTimeout(() => poll(url, token, failures), icyPollDelay(failures));
}

export function stopNowPlaying(): void {
  clearTimeout(pollTimer);
  pollToken += 1;
  pollUrl = null;
}

export function startNowPlaying(url: string): void {
  if (url === pollUrl) return;
  stopNowPlaying();
  if (!isHttpUrl(url)) return;
  if (urlsNotPolled.has(url)) {
    sendUpdate({ url, title: null });
    return;
  }
  pollUrl = url;
  poll(url, pollToken, 0);
}
