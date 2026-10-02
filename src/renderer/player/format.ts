import type { Track } from "./state";

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatClock(date: Date, colonVisible = true): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}${colonVisible ? ":" : " "}${minutes}`;
}

export function trackLabel(name: string): string {
  return name.replace(/\.[^./]+$/, "");
}

export function trackDisplayName(track: Pick<Track, "name" | "tags">): string {
  const { title, artist } = track.tags || {};
  if (title && artist) return `${artist} — ${title}`;
  return title || track.name;
}

// file.type is empty for some formats on some systems — fall back to the extension.
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus|weba)$/i;
const UNSUPPORTED_EXT_RE = /\.(wma|ape|mid|midi|aif|aiff|amr|wv|mpc)$/i;

export function isAddableAudioFile(file: Pick<File, "name" | "type">): boolean {
  return AUDIO_EXT_RE.test(file.name) || (file.type.startsWith("audio/") && !UNSUPPORTED_EXT_RE.test(file.name));
}

export function formatBandLabel(freq: number): string {
  return freq >= 1000 ? freq / 1000 + "K" : String(freq);
}

export function formatDb(db: number): string {
  return (db > 0 ? "+" : "") + db;
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

export function stationHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export function safeStreamUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function safeTrackUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "file:" || url.protocol === "blob:" ? url.href : null;
  } catch {
    return null;
  }
}

export function isHttpUrl(value: string): boolean {
  return safeStreamUrl(value) !== null;
}
