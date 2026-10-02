import { app, net, session } from "electron";
import { writeLog } from "./logging";
import type { ProxyConfig } from "../shared/types";

export const USER_AGENT = `WaveAMP/${app.getVersion()} (https://github.com/darkdkl/waveamp)`;
export const REQUEST_TIMEOUT_MS = 8000;

let currentProxyAuth: { username: string; password: string } | null = null;

export async function applyProxyConfig(proxyConfig: Partial<ProxyConfig> | null): Promise<void> {
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

export function registerProxyLogin(): void {
  app.on("login", (event, webContents, details, authInfo, callback) => {
    if (authInfo.isProxy && currentProxyAuth) {
      event.preventDefault();
      callback(currentProxyAuth.username, currentProxyAuth.password);
    }
  });
}

// net.request, not fetch(): only the Chromium network stack honors session.setProxy().
export function netRequestText(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  maxBytes = Infinity
): Promise<string> {
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
        (response as unknown as NodeJS.ReadableStream).resume();
        finish(reject, new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on("data", (chunk) => {
        chunks.push(chunk);
        size += chunk.length;
        if (size > maxBytes) {
          finish(reject, new Error("Response too large"));
          request.abort();
        }
      });
      response.on("end", () => finish(resolve, Buffer.concat(chunks).toString("utf8")));
      response.on("error", (err) => finish(reject, err));
    });
    request.on("error", (err) => finish(reject, err));
    request.end();
  });
}

export async function netRequestJson(url: string, headers: Record<string, string>, timeoutMs: number): Promise<any> {
  return JSON.parse(await netRequestText(url, headers, timeoutMs));
}
