import { i18n } from "../../i18n";
import {
  radioAddCancel,
  radioAddError,
  radioAddFrame,
  radioAddName,
  radioAddSubmit,
  radioAddTitle,
  radioAddUrl,
  radioTabAdd,
} from "../dom";
import { state, type RadioView } from "../state";
import { isHttpUrl } from "../format";
import { persistConfig } from "../config";
import { updateTrackTitleText } from "../playback";
import { renderRadioFavorites, renderRadioResults, setRadioView } from "./panel";
import { tuneStation } from "./stream";
import type { ResolveStreamResult, Station } from "../../../shared/types";

let radioViewBeforeAdd: RadioView = "favorites";
let editingStationId: string | null = null;
let stationFormErrorKey = "";
let stationFormBusy = false;

function setStationFormError(key: string): void {
  stationFormErrorKey = key;
  radioAddError.textContent = key ? i18n.t(key) : "";
}

export function updateStationFormText(): void {
  radioAddTitle.textContent = i18n.t(editingStationId ? "editStation" : "newStation");
  radioAddSubmit.textContent = i18n.t(stationFormBusy ? "checking" : editingStationId ? "save" : "add");
  setStationFormError(stationFormErrorKey);
}

function setStationFormBusy(busy: boolean): void {
  stationFormBusy = busy;
  radioAddSubmit.disabled = busy;
  radioAddName.disabled = busy;
  radioAddUrl.disabled = busy;
  updateStationFormText();
}

export function openStationForm(station: Station | null = null): void {
  if (state.radioView !== "add") radioViewBeforeAdd = state.radioView;
  editingStationId = station ? station.stationuuid : null;
  radioAddName.value = station ? station.name : "";
  radioAddUrl.value = station ? station.sourceUrl || station.url : "";
  setStationFormBusy(false);
  setStationFormError("");
  setRadioView("add");
  radioAddName.focus();
}

function closeStationForm(nextView?: RadioView): void {
  editingStationId = null;
  setStationFormError("");
  setRadioView(nextView || radioViewBeforeAdd);
}

async function submitStationForm(): Promise<void> {
  if (stationFormBusy) return;
  const name = radioAddName.value.trim();
  const sourceUrl = radioAddUrl.value.trim();
  if (!name) {
    setStationFormError("stationNameRequired");
    radioAddName.focus();
    return;
  }
  if (!isHttpUrl(sourceUrl)) {
    setStationFormError("stationUrlInvalid");
    radioAddUrl.focus();
    return;
  }
  const duplicate = state.favoriteStations.some(
    (s) => s.stationuuid !== editingStationId && (s.url === sourceUrl || s.sourceUrl === sourceUrl)
  );
  if (duplicate) {
    setStationFormError("stationUrlDuplicate");
    radioAddUrl.focus();
    return;
  }

  let url = sourceUrl;
  if (window.electronAPI?.resolveStreamUrl) {
    setStationFormError("");
    setStationFormBusy(true);
    const result = await window.electronAPI
      .resolveStreamUrl(sourceUrl)
      .catch((): ResolveStreamResult => ({ ok: false, error: "playlist" }));
    setStationFormBusy(false);
    if (state.radioView !== "add") return;
    if (result.ok === false) {
      setStationFormError(result.error === "invalid" ? "stationUrlInvalid" : "stationPlaylistFailed");
      radioAddUrl.focus();
      return;
    }
    url = result.url;
  }

  const existing = state.favoriteStations.find((s) => s.stationuuid === editingStationId);
  if (existing) {
    const urlChanged = existing.url !== url;
    Object.assign(existing, { name, url, sourceUrl });
    persistConfig();
    closeStationForm("favorites");
    if (state.currentStation?.stationuuid === existing.stationuuid) {
      state.currentStation = existing;
      if (urlChanged) tuneStation(existing);
      else updateTrackTitleText();
    }
    renderRadioFavorites();
    renderRadioResults();
    return;
  }

  const station: Station = {
    stationuuid: "custom-" + crypto.randomUUID(),
    name,
    url,
    sourceUrl,
    favicon: "",
    tags: "",
    country: "",
    countrycode: "",
    state: "",
    bitrate: 0,
    codec: "",
    custom: true,
  };
  state.favoriteStations.push(station);
  renderRadioFavorites();
  persistConfig();
  closeStationForm("favorites");
  tuneStation(station);
}

export function initStationForm(): void {
  radioTabAdd.addEventListener("click", () => {
    if (state.radioView === "add") closeStationForm();
    else openStationForm();
  });
  radioAddFrame.addEventListener("submit", (e) => {
    e.preventDefault();
    submitStationForm();
  });
  radioAddCancel.addEventListener("click", () => closeStationForm());
  radioAddFrame.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeStationForm();
    }
  });
}
