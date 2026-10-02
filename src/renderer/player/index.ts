import { i18n } from "../i18n";
import { closeBtn, minimizeBtn, player, windowControls } from "./dom";
import { logEvent } from "./log";
import { state } from "./state";
import { buildEqualizer, initEqualizerControls } from "./equalizer";
import { initVisualizerControls, startVisualizer } from "./visualizer";
import { loadMediaSessionArtwork, initMediaSession } from "./mediaSession";
import {
  initAudioErrorHandling,
  initAudioEvents,
  initSeekAndVolume,
  initTransportControls,
  updateTrackTitleText,
} from "./playback";
import { initDragAndDrop, initFileInputs, initPlaylistAddMenu, renderPlaylist } from "./playlist";
import { initListResize, initPanelToggles, measurePlayerHeight, setScale } from "./layout";
import { initRadioSearch, initRadioTabs, refreshRadioEmptyText } from "./radio/panel";
import { initStationForm } from "./radio/stationForm";
import { initRadioStream } from "./radio/stream";
import { initSettingsBridge, initSettingsButton, initSkipUpdateVersion } from "./settingsBridge";
import { initPlayerHotkeys } from "./playerHotkeys";
import { restoreConfig } from "./restore";

initVisualizerControls();
initEqualizerControls();
loadMediaSessionArtwork();
initTransportControls();
initPlaylistAddMenu();
initSettingsButton();
initSettingsBridge();
initPanelToggles();
initListResize();
initRadioTabs();
initStationForm();
initRadioSearch();
initFileInputs();
initAudioEvents();
initRadioStream();
initMediaSession();
initAudioErrorHandling();
initSeekAndVolume();
initDragAndDrop();

const electronAPI = window.electronAPI;
if (electronAPI) {
  document.body.classList.add("is-electron");
  windowControls.hidden = false;
  minimizeBtn.addEventListener("click", () => {
    electronAPI.minimizeWindow();
  });
  closeBtn.addEventListener("click", () => {
    electronAPI.closeWindow();
  });
}

buildEqualizer();
startVisualizer();
measurePlayerHeight();

i18n.applyTranslations();
setScale(100);
updateTrackTitleText();
refreshRadioEmptyText();

renderPlaylist();
restoreConfig().finally(() => {
  state.restoring = false;
  document.body.classList.remove("is-restoring");
  window.electronAPI?.notifyWindowReady?.();
});

initPlayerHotkeys();

player.addEventListener("mousedown", (e) => {
  if ((e.target as HTMLElement).closest("button")) e.preventDefault();
});

initSkipUpdateVersion();

window.addEventListener("error", (e) => {
  logEvent("error", "window", `${e.message} (${e.filename}:${e.lineno})`);
});

window.addEventListener("unhandledrejection", (e) => {
  logEvent("error", "promise", String(e.reason));
});
