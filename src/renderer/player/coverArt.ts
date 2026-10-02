import { playerDisplay } from "./dom";
import { state } from "./state";
import { persistConfig } from "./config";
import { updateMediaSessionMetadata } from "./mediaSession";

let artToken = 0;
let artworkBlobUrl: string | null = null;

function safeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "data:" ? url.href : null;
  } catch {
    return null;
  }
}

function imageLoads(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function currentArtSource(): Promise<string | null> {
  if (state.playbackMode === "radio") return safeImageUrl(state.currentStation?.favicon);
  const track = state.queue[state.currentIndex];
  const api = window.electronAPI;
  if (!track?.path || !api?.readTrackCover) return null;
  return safeImageUrl(await api.readTrackCover(track.path).catch(() => null));
}

function toArtworkBlobUrl(url: string | null): string | null {
  const match = url?.match(/^data:([^;,]+);base64,(.*)$/);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: match[1] }));
  } catch {
    return null;
  }
}

export function getLocalArtworkUrl(): string | null {
  return state.playbackMode === "local" ? artworkBlobUrl : null;
}

export function renderCoverArt(): void {
  const show = state.coverArtEnabled && !!state.coverArt;
  playerDisplay.classList.toggle("has-cover", show);
  if (show) playerDisplay.style.setProperty("--cover-art", `url("${state.coverArt}")`);
}

export async function refreshCoverArt(): Promise<void> {
  const token = ++artToken;
  const source = await currentArtSource();
  const url = source && (await imageLoads(source)) ? source : null;
  const blobUrl = toArtworkBlobUrl(url);
  if (token !== artToken) {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    return;
  }
  if (artworkBlobUrl) URL.revokeObjectURL(artworkBlobUrl);
  artworkBlobUrl = blobUrl;
  state.coverArt = url;
  renderCoverArt();
  updateMediaSessionMetadata();
}

export function setCoverArtEnabled(enabled: boolean): void {
  state.coverArtEnabled = enabled;
  renderCoverArt();
  persistConfig();
}
