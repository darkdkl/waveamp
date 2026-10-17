import { fixMojibake } from "./textEncoding";
import { codecLabel, kbps, type AudioFormat } from "../shared/audioFormat";
import type { TrackTags } from "../shared/types";

// music-metadata is ESM-only.
let musicMetadata: typeof import("music-metadata") | null = null;

export async function loadMusicMetadata(): Promise<typeof import("music-metadata")> {
  musicMetadata ??= await import("music-metadata");
  return musicMetadata;
}

export async function readTrackTags(filePath: string): Promise<TrackTags> {
  const { parseFile } = await loadMusicMetadata();
  const { common, format } = await parseFile(filePath, { skipCovers: true });
  return {
    title: fixMojibake(common.title) || null,
    artist: fixMojibake(common.artist || common.albumartist) || null,
    album: fixMojibake(common.album) || null,
    duration: typeof format.duration === "number" && Number.isFinite(format.duration) ? format.duration : null,
  };
}

const LOSSLESS_CODECS = new Set(["FLAC", "ALAC", "WAV", "AIFF"]);

export async function readAudioFormat(filePath: string): Promise<AudioFormat> {
  const { parseFile } = await loadMusicMetadata();
  const { format } = await parseFile(filePath, { skipCovers: true, duration: false });
  const codec = codecLabel(/^aiff/i.test(format.container ?? "") ? "AIFF" : format.codec);
  return {
    codec,
    lossless: !!format.lossless || (!!codec && LOSSLESS_CODECS.has(codec)),
    bitsPerSample: typeof format.bitsPerSample === "number" ? format.bitsPerSample : null,
    bitrate: kbps(format.bitrate),
    constantBitrate: format.codecProfile === "CBR",
  };
}
