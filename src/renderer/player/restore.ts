import { hotkeys } from "../hotkeys";
import { eqPresetSelect, volume } from "./dom";
import { state } from "./state";
import { EQ_BANDS, findEqPreset } from "./eqPresets";
import { safeStreamUrl, trackLabel } from "./format";
import { applyEqState, setVolume } from "./audioGraph";
import { syncEqControlsFromState } from "./equalizer";
import { setVizMode, setVizResponse } from "./visualizer";
import { SCALE_MAX, SCALE_MIN, SCALE_STEP, setEqOpen, setPlaylistOpen, setRadioOpen, setScale } from "./layout";
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
import type { Station } from "../../shared/types";

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

  if (settings?.windowControlsSide === "left" || settings?.windowControlsSide === "right") {
    setWindowControlsSide(settings.windowControlsSide);
  }

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

  if (config.eq) {
    if (Array.isArray(config.eq.bandGains)) {
      config.eq.bandGains.forEach((db, i) => {
        if (i < state.bandGains.length && typeof db === "number") state.bandGains[i] = db;
      });
    }
    if (typeof config.eq.preampDb === "number") state.preampDb = config.eq.preampDb;
    if (typeof config.eq.enabled === "boolean") state.eqEnabled = config.eq.enabled;
    const custom = config.eq.custom;
    const customGains = custom?.bandGains;
    if (Array.isArray(customGains) && typeof custom?.preampDb === "number") {
      state.customEq = {
        bandGains: EQ_BANDS.map((_, i) => (typeof customGains[i] === "number" ? customGains[i] : 0)),
        preampDb: custom.preampDb,
      };
    } else {
      state.customEq = { bandGains: [...state.bandGains], preampDb: state.preampDb };
    }
    const preset = config.eq.preset;
    state.eqPreset = preset && findEqPreset(preset) ? preset : "custom";
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
      .filter((t): t is { name?: string; path: string } => !!t && !!t.path)
      .map((t) => ({ name: t.name || trackLabel(t.path.split("/").pop() ?? ""), path: t.path, file: null }));
    renderPlaylist();

    const idx = config.playlist.currentIndex;
    if (typeof idx === "number" && idx >= 0 && idx < state.queue.length) {
      loadTrack(idx, false);
    }
    loadTrackTags(state.queue);
  }

  if (config.ui?.vizMode) setVizMode(config.ui.vizMode);
  if (config.ui?.eqOpen) setEqOpen(true);
  if (config.ui?.playlistOpen) setPlaylistOpen(true);
  if (config.ui?.radioOpen) setRadioOpen(true);
}
