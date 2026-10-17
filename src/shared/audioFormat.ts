export const INFO_MAX_CHARS = 7;

export interface AudioFormat {
  codec: string | null;
  lossless: boolean;
  bitsPerSample: number | null;
  bitrate: number | null;
  constantBitrate: boolean;
}

export interface StreamInfo {
  codec: string | null;
  bitrate: number | null;
}

const CODECS: [RegExp, string][] = [
  [/he-?aac|aac\+|aacp/i, "AAC+"],
  [/aac|mp4a/i, "AAC"],
  [/layer\s*2|mp2/i, "MP2"],
  [/layer\s*3|mp3|mpeg\b(?!-4)/i, "MP3"],
  [/opus/i, "OPUS"],
  [/vorbis|ogg/i, "OGG"],
  [/flac/i, "FLAC"],
  [/alac|apple lossless/i, "ALAC"],
  [/wma|windows media/i, "WMA"],
  [/aiff/i, "AIFF"],
  [/pcm|wav/i, "WAV"],
];

export function codecLabel(codec: string | null | undefined): string | null {
  if (!codec || !codec.trim()) return null;
  for (const [pattern, label] of CODECS) if (pattern.test(codec)) return label;
  return codec.trim().split(/[\s/]+/)[0].toUpperCase().slice(0, 4);
}

export function infoLabel(codec: string | null, detail: number | null): string | null {
  if (!codec) return null;
  if (detail == null) return codec.slice(0, INFO_MAX_CHARS);
  const spaced = `${codec} ${detail}`;
  if (spaced.length <= INFO_MAX_CHARS) return spaced;
  return `${codec}${detail}`.slice(0, INFO_MAX_CHARS);
}

export function kbps(bitsPerSecond: number | null | undefined): number | null {
  return typeof bitsPerSecond === "number" && Number.isFinite(bitsPerSecond) && bitsPerSecond > 0 ? Math.round(bitsPerSecond / 1000) : null;
}

export function parseIcyBitrate(header: string | string[] | undefined): number | null {
  const value = Array.isArray(header) ? header[0] : header;
  const match = /^\s*(\d{1,4})/.exec(value ?? "");
  const n = match ? Number(match[1]) : 0;
  return n > 0 ? n : null;
}

export function codecFromContentType(header: string | string[] | undefined): string | null {
  const value = (Array.isArray(header) ? header[0] : header)?.split(";")[0].trim().toLowerCase();
  if (!value) return null;
  if (value === "audio/aacp") return "AAC+";
  if (value === "audio/aac" || value === "audio/x-aac" || value === "audio/mp4") return "AAC";
  if (value === "audio/mpeg" || value === "audio/mp3" || value === "audio/x-mpeg") return "MP3";
  if (value === "audio/ogg" || value === "application/ogg" || value === "audio/x-ogg") return "OGG";
  if (value === "audio/opus") return "OPUS";
  if (value === "audio/flac" || value === "audio/x-flac") return "FLAC";
  return null;
}
