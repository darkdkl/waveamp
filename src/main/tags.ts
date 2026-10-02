import { fixMojibake } from "./textEncoding";
import type { TrackTags } from "../shared/types";

// music-metadata is ESM-only.
let musicMetadata = null;

export async function readTrackTags(filePath: string): Promise<TrackTags> {
  musicMetadata ??= await import("music-metadata");
  const { common, format } = await musicMetadata.parseFile(filePath, { skipCovers: true });
  return {
    title: fixMojibake(common.title) || null,
    artist: fixMojibake(common.artist || common.albumartist) || null,
    album: fixMojibake(common.album) || null,
    duration: Number.isFinite(format.duration) ? format.duration : null,
  };
}
