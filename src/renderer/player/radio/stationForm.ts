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
import { state } from "../state";
import { isHttpUrl } from "../format";
import { persistConfig } from "../config";
import { updateTrackTitleText } from "../playback";
import { renderRadioFavorites, renderRadioResults, setRadioView } from "./panel";
import { tuneStation } from "./stream";
import { onEveryDocument } from "../documents";
import type { ResolveStreamResult, Station } from "../../../shared/types";

let editingStationId: string | null = null;
let addDraft = { name: "", url: "" };
let formRequest = 0;
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

function isStationFormOpen(): boolean {
  return !radioAddFrame.hidden;
}

function setStationFormOpen(open: boolean): void {
  radioAddFrame.hidden = !open;
  radioTabAdd.classList.toggle("is-active", open);
  radioTabAdd.setAttribute("aria-pressed", String(open));
}

export function openStationForm(station: Station | null = null): void {
  if (isStationFormOpen() && !editingStationId) addDraft = { name: radioAddName.value, url: radioAddUrl.value };
  formRequest += 1;
  editingStationId = station ? station.stationuuid : null;
  radioAddName.value = station ? station.name : addDraft.name;
  radioAddUrl.value = station ? station.sourceUrl || station.url : addDraft.url;
  setStationFormBusy(false);
  setStationFormError("");
  setStationFormOpen(true);
  radioAddName.ownerDocument.defaultView?.focus();
  radioAddName.focus();
}

function closeStationForm(keepDraft = false): void {
  if (!editingStationId) addDraft = keepDraft ? { name: radioAddName.value, url: radioAddUrl.value } : { name: "", url: "" };
  formRequest += 1;
  editingStationId = null;
  setStationFormError("");
  setStationFormOpen(false);
}

function dismissStationForm(): void {
  if (!stationFormBusy) closeStationForm(true);
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
    const request = formRequest;
    const result = await window.electronAPI
      .resolveStreamUrl(sourceUrl)
      .catch((): ResolveStreamResult => ({ ok: false, error: "playlist" }));
    if (request !== formRequest) return;
    setStationFormBusy(false);
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
    closeStationForm();
    setRadioView("favorites");
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
  closeStationForm();
  setRadioView("favorites");
  tuneStation(station);
}

export function initStationForm(): void {
  radioTabAdd.addEventListener("click", () => {
    if (isStationFormOpen()) dismissStationForm();
    else openStationForm();
  });
  radioAddFrame.addEventListener("submit", (e) => {
    e.preventDefault();
    submitStationForm();
  });
  radioAddCancel.addEventListener("click", () => closeStationForm());
  onEveryDocument("keydown", (e) => {
    if (e.key !== "Escape" || !isStationFormOpen()) return;
    const target = e.target as HTMLElement;
    if (!radioAddFrame.contains(target) && target.closest?.("input, select, textarea")) return;
    e.preventDefault();
    dismissStationForm();
  });
  onEveryDocument("click", (e) => {
    const target = e.target as Node;
    if (!isStationFormOpen() || radioAddFrame.contains(target) || radioTabAdd.contains(target)) return;
    dismissStationForm();
  });
}
