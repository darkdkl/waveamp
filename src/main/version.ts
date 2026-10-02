export function isNewerVersion(candidate: string, current: string): boolean {
  const a = candidate.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

export const RELEASES_URL = "https://github.com/darkdkl/waveamp/releases/";

export interface ReleaseInfo {
  version: string;
  url: string;
}

export function parseLatestRelease(data: { tag_name?: unknown; html_url?: unknown }): ReleaseInfo {
  const version = String(data.tag_name || "").replace(/^v/, "");
  const url = String(data.html_url || "");
  if (!/^\d+\.\d+\.\d+$/.test(version) || !url.startsWith(RELEASES_URL)) {
    throw new Error("Unexpected release data");
  }
  return { version, url };
}

export function isReleasePageUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith(RELEASES_URL);
}
