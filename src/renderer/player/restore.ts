import { hotkeys } from "../hotkeys";
import { eqPresetSelect, volume } from "./dom";
import { state } from "./state";
import { findEqPreset } from "./eqPresets";
import { EQ_LAYOUTS, normalizeBandCount } from "../../shared/eqCurve";
import { safeStreamUrl, trackFromEntry } from "./format";
import { applyEqState, setVolume } from "./audioGraph";
import { applyEqBandCount, loadEqGains, syncEqControlsFromState } from "./equalizer";
import { setVizMode, setVizResponse } from "./visualizer";
import { SCALE_MAX, SCALE_MIN, SCALE_STEP, setEqOpen, setPlaylistOpen, setRadioOpen, setScale } from "./layout";
import { applySeparateWindows } from "./separateWindows";
import { setChordsCapo, setChordsOpen, setChordsSimplify } from "./chords";
import { loadTrack } from "./playback";
import { loadTrackTags, renderPlaylist } from "./playlist";
import { renderRadioFavorites } from "./radio/panel";
import { setRadioTrackTitleEnabled } from "./radio/nowPlaying";
import { setStereoPseudo, setStereoRadio, setStereoStrength, setStereoTracks } from "./stereo";
import { setPlayerClockEnabled } from "./clock";
import { setPresetAutoSwitch, setPresetFolder, setPresetHardCuts } from "./presets/mode";
import { loadSavedTracks } from "./radio/savedTracks";
import { applyGlobalHotkeys } from "./playerHotkeys";
import { setCoverArtEnabled } from "./coverArt";
import { setTitleScroll, setTitleScrollSpeed } from "./titleScroll";
import {
  setAccentColor,
  setAutoUpdateEnabled,
  setCloseMinimizesToTrayEnabled,
  setLanguage,
  setLoggingEnabled,
  setProxySettings,
  setTrayIconEnabled,
  setWindowControlsSide,
} from "./settingsBridge";
import type { EqBandCount, EqCustomPreset, PlaylistEntry, Station, TrackTags } from "../../shared/types";

function restoredTags(tags: Partial<TrackTags> | undefined): TrackTags | undefined {
  if (!tags || typeof tags !== "object") return undefined;
  const text = (value: unknown) => (typeof value === "string" && value ? value : null);
  return {
    title: text(tags.title),
    artist: text(tags.artist),
    album: text(tags.album),
    duration: typeof tags.duration === "number" ? tags.duration : null,
  };
}

function restoredEntry(t: PlaylistEntry & { name?: string }): PlaylistEntry & { name?: string } {
  const start = typeof t.start === "number" && t.start >= 0 ? t.start : undefined;
  if (start === undefined) return { name: t.name, path: t.path };
  const end = typeof t.end === "number" && t.end > start ? t.end : null;
  return { name: t.name, path: t.path, start, end, tags: restoredTags(t.tags) };
}

function restoredGains(raw: unknown, count: EqBandCount): number[] | null {
  if (!Array.isArray(raw) || raw.length !== EQ_LAYOUTS[count].frequencies.length) return null;
  return raw.map((db) => (typeof db === "number" ? db : 0));
}

function restoredCustom(raw: Partial<EqCustomPreset> | null | undefined, count: EqBandCount): EqCustomPreset | null {
  if (!raw || typeof raw.preampDb !== "number" || !Array.isArray(raw.bandGains)) return null;
  const gains = raw.bandGains;
  return { bandGains: EQ_LAYOUTS[count].frequencies.map((_, i) => (typeof gains[i] === "number" ? gains[i] : 0)), preampDb: raw.preampDb };
}

export async function restoreConfig(): Promise<void> {
  if (!window.electronAPI?.loadConfig) return;
  const savedTracksLoaded = loadSavedTracks();
  const config = await window.electronAPI.loadConfig();
  await savedTracksLoaded;
  if (!config) return;
  const settings = config.settings;

  if (settings?.lang === "ru" || settings?.lang === "en") {
    setLanguage(settings.lang);
  }

  if (typeof settings?.scale === "number") {
    const scale = Math.round(settings.scale / SCALE_STEP) * SCALE_STEP;
    setScale(Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale)));
  }

  if (settings?.accentColor) {
    setAccentColor(settings.accentColor);
  }

  if (settings?.vizResponse) {
    setVizResponse(settings.vizResponse);
  }

  if (typeof settings?.coverArtEnabled === "boolean") {
    setCoverArtEnabled(settings.coverArtEnabled);
  }

  if (settings?.titleScroll !== undefined) setTitleScroll(settings.titleScroll);
  if (settings?.titleScrollSpeed !== undefined) setTitleScrollSpeed(settings.titleScrollSpeed);

  if (settings?.windowControlsSide === "left" || settings?.windowControlsSide === "right") {
    setWindowControlsSide(settings.windowControlsSide);
  }
  if (typeof settings?.separateWindows === "boolean") state.separateWindows = settings.separateWindows;
  if (settings?.eqWheel === "standard" || settings?.eqWheel === "natural") state.eqWheel = settings.eqWheel;
  if (config.ui?.dock && typeof config.ui.dock === "object") state.dockLayout = config.ui.dock;

  if (typeof settings?.presetAutoSwitch === "boolean") setPresetAutoSwitch(settings.presetAutoSwitch);
  if (typeof settings?.presetHardCuts === "boolean") setPresetHardCuts(settings.presetHardCuts);
  if (typeof settings?.presetFolder === "string") setPresetFolder(settings.presetFolder);

  if (typeof settings?.playerClockEnabled === "boolean") {
    setPlayerClockEnabled(settings.playerClockEnabled);
  }

  if (typeof settings?.stereoRadio === "boolean") setStereoRadio(settings.stereoRadio);
  if (typeof settings?.stereoTracks === "boolean") setStereoTracks(settings.stereoTracks);
  if (typeof settings?.stereoStrength === "number") setStereoStrength(settings.stereoStrength);
  if (typeof settings?.stereoPseudo === "boolean") setStereoPseudo(settings.stereoPseudo);

  if (typeof settings?.radioTrackTitleEnabled === "boolean") {
    setRadioTrackTitleEnabled(settings.radioTrackTitleEnabled);
  }

  state.hotkeyConfig = hotkeys.normalize(settings?.hotkeys);
  applyGlobalHotkeys();

  if (typeof settings?.volume === "number" && settings.volume >= 0 && settings.volume <= 100) {
    volume.value = String(settings.volume);
    setVolume(settings.volume);
  }

  if (typeof settings?.loggingEnabled === "boolean") {
    setLoggingEnabled(settings.loggingEnabled);
  }

  const proxy = settings?.proxy;
  if (proxy && typeof proxy === "object") {
    setProxySettings(proxy);
  }

  if (typeof settings?.skippedUpdateVersion === "string") {
    state.skippedUpdateVersion = settings.skippedUpdateVersion;
  }

  if (typeof settings?.autoUpdateEnabled === "boolean") {
    setAutoUpdateEnabled(settings.autoUpdateEnabled);
  }

  if (typeof settings?.showTrayIcon === "boolean") {
    setTrayIconEnabled(settings.showTrayIcon);
  }

  if (state.trayIconEnabled && typeof settings?.closeMinimizesToTray === "boolean") {
    setCloseMinimizesToTrayEnabled(settings.closeMinimizesToTray);
  }

  applyEqBandCount(normalizeBandCount(settings?.eqBands));
  if (config.eq) {
    const count = state.eqBandCount;
    const saved = restoredGains(config.eq.bandGains, count);
    const preampDb = typeof config.eq.preampDb === "number" ? config.eq.preampDb : 0;
    if (typeof config.eq.enabled === "boolean") state.eqEnabled = config.eq.enabled;
    state.customEq = restoredCustom(config.eq.custom, 10) ?? { bandGains: restoredGains(config.eq.bandGains, 10) ?? new Array(10).fill(0), preampDb };
    state.fineCustomEq = restoredCustom(config.eq.fineCustom, 19);
    const preset = config.eq.preset;
    state.eqPreset = preset && findEqPreset(preset) ? preset : "custom";
    if (state.eqPreset === "custom" && saved) {
      state.bandGains = saved;
      state.preampDb = preampDb;
    } else {
      loadEqGains();
    }
    eqPresetSelect.value = state.eqPreset;
    syncEqControlsFromState();
    applyEqState();
  }

  if (Array.isArray(config.radio?.favorites)) {
    state.favoriteStations = config.radio.favorites.filter(
      (s): s is Station => !!s && !!s.stationuuid && !!s.url && safeStreamUrl(s.url) !== null
    );
    renderRadioFavorites();
  }

  if (config.playlist?.tracks?.length) {
    state.queue = config.playlist.tracks
      .filter((t): t is PlaylistEntry & { name?: string } => !!t && typeof t.path === "string" && !!t.path)
      .map((t) => ({ ...trackFromEntry(restoredEntry(t)), file: null }));
    renderPlaylist();

    const idx = config.playlist.currentIndex;
    if (typeof idx === "number" && idx >= 0 && idx < state.queue.length) {
      loadTrack(idx, false);
    }
    loadTrackTags(state.queue);
  }

  if (config.ui?.vizMode) setVizMode(config.ui.vizMode);
  if (typeof config.ui?.chordsCapo === "number") setChordsCapo(config.ui.chordsCapo);
  if (typeof config.ui?.chordsSimplify === "boolean") setChordsSimplify(config.ui.chordsSimplify);
  const chordsSize = config.ui?.chordsWindowSize;
  if (chordsSize && chordsSize.width > 0 && chordsSize.height > 0) state.chordsDockedSize = { width: chordsSize.width, height: chordsSize.height };
  if (state.separateWindows) await applySeparateWindows();
  if (config.ui?.chordsOpen) setChordsOpen(true);
  if (config.ui?.eqOpen) setEqOpen(true);
  if (config.ui?.playlistOpen) setPlaylistOpen(true);
  if (config.ui?.radioOpen) setRadioOpen(true);
}
