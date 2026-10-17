import { audio, channelLetter, formatTag, formatText } from "./dom";
import { codecLabel, infoLabel, type AudioFormat, type StreamInfo } from "../../shared/audioFormat";
import type { ChannelLayout } from "../../shared/stereo";
import type { Station } from "../../shared/types";
import type { Track } from "./state";

const SAMPLE_MS = 1000;
const WINDOW_S = 3;
const MIN_WINDOW_S = 2.5;

type Source = { kind: "none" } | { kind: "file"; path: string | null } | { kind: "station"; station: Station };
interface Sample {
  bytes: number;
  time: number;
}

const formats = new Map<string, Promise<AudioFormat | null>>();
let source: Source = { kind: "none" };
let fileFormat: AudioFormat | null = null;
let stream: StreamInfo | null = null;
let layout: ChannelLayout | null = null;
let samples: Sample[] = [];
let measured: number | null = null;

function decodedBytes(): number | null {
  const count = (audio as HTMLMediaElement & { webkitAudioDecodedByteCount?: number }).webkitAudioDecodedByteCount;
  return typeof count === "number" ? count : null;
}

function resetMeasurement(): void {
  samples = [];
  measured = null;
}

function sampleBitrate(): void {
  if (audio.paused || source.kind === "none") return;
  const bytes = decodedBytes();
  if (bytes == null) return;
  samples.push({ bytes, time: audio.currentTime });
  while (samples.length > 1 && samples[samples.length - 1].time - samples[0].time > WINDOW_S) samples.shift();
  const first = samples[0];
  const last = samples[samples.length - 1];
  const span = last.time - first.time;
  if (span < MIN_WINDOW_S || last.bytes <= first.bytes) return;
  const next = Math.round(((last.bytes - first.bytes) * 8) / span / 1000);
  if (next === measured) return;
  measured = next;
  render();
}

function formatItem(): string | null {
  if (source.kind === "file") {
    if (!fileFormat) return null;
    if (fileFormat.lossless) return infoLabel(fileFormat.codec, fileFormat.bitsPerSample);
    if (fileFormat.constantBitrate && fileFormat.bitrate) return infoLabel(fileFormat.codec, fileFormat.bitrate);
    return infoLabel(fileFormat.codec, measured);
  }
  if (source.kind === "station") {
    const codec = stream?.codec ?? codecLabel(source.station.codec);
    const nominal = stream?.bitrate ?? (source.station.bitrate > 0 ? source.station.bitrate : null);
    return infoLabel(codec, nominal ?? measured);
  }
  return null;
}

function render(): void {
  const format = formatItem();
  const letter = layout ? (layout === "mono" ? "M" : "S") : "";
  formatTag.hidden = !format && !letter;
  formatText.textContent = format ?? "";
  channelLetter.textContent = letter;
  channelLetter.classList.toggle("is-mono", layout === "mono");
  formatTag.classList.toggle("is-idle", audio.paused);
}

export function setChannelLayout(next: ChannelLayout | null): void {
  layout = next;
  render();
}

export function setLocalTrack(track: Track): void {
  const path = track.path;
  if (source.kind === "file" && source.path === path) return;
  source = { kind: "file", path };
  fileFormat = null;
  stream = null;
  resetMeasurement();
  render();
  if (!path || !window.electronAPI?.readAudioFormat) return;
  let pending = formats.get(path);
  if (!pending) {
    pending = window.electronAPI.readAudioFormat(path).catch(() => null);
    formats.set(path, pending);
  }
  void pending.then((format) => {
    if (source.kind !== "file" || source.path !== path) return;
    fileFormat = format;
    render();
  });
}

export function setStation(station: Station): void {
  source = { kind: "station", station };
  fileFormat = null;
  stream = null;
  resetMeasurement();
  render();
}

export function setStreamInfo(info: StreamInfo | null | undefined): void {
  if (source.kind !== "station") return;
  stream = info ?? null;
  render();
}

export function clearDisplayInfo(): void {
  source = { kind: "none" };
  fileFormat = null;
  stream = null;
  resetMeasurement();
  render();
}

export function initDisplayInfo(): void {
  for (const type of ["loadstart", "seeking", "play"]) audio.addEventListener(type, resetMeasurement);
  for (const type of ["play", "pause"]) audio.addEventListener(type, render);
  setInterval(sampleBitrate, SAMPLE_MS);
  render();
}
