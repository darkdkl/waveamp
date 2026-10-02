import { i18n } from "../../i18n";
import {
  radio,
  radioAddView,
  radioCountrySelect,
  radioEmpty,
  radioFavCount,
  radioFavEmpty,
  radioFavoritesList,
  radioFavoritesView,
  radioResultsList,
  radioSearchForm,
  radioSearchInput,
  radioSearchView,
  radioStateSelect,
  radioTabAdd,
  radioTabFavorites,
  radioTabSearch,
  radioTagSelect,
} from "../dom";
import { state, type RadioView } from "../state";
import { stationHost } from "../format";
import { logEvent } from "../log";
import { persistConfig } from "../config";
import { syncElectronWindowSize } from "../layout";
import { openStationForm } from "./stationForm";
import { tuneStation } from "./stream";
import type { CountedOption, Station } from "../../../shared/types";
import { errorMessage } from "../../../shared/errors";

let radioCountry = "";
let radioState = "";
let radioTag = "";
let radioFiltersLoaded = false;
let radioFiltersLoading = false;
let radioEmptyKey = "enterNameOrFilter";
let radioSearchToken = 0;

export function setRadioView(view: RadioView): void {
  state.radioView = view;
  radioTabSearch.classList.toggle("is-active", view === "search");
  radioTabSearch.setAttribute("aria-pressed", String(view === "search"));
  radioTabFavorites.classList.toggle("is-active", view === "favorites");
  radioTabFavorites.setAttribute("aria-pressed", String(view === "favorites"));
  radioTabAdd.classList.toggle("is-active", view === "add");
  radioTabAdd.setAttribute("aria-pressed", String(view === "add"));
  radioSearchView.hidden = view !== "search";
  radioFavoritesView.hidden = view !== "favorites";
  radioAddView.hidden = view !== "add";
  if (state.radioOpen) radio.style.maxHeight = radio.scrollHeight + "px";
  syncElectronWindowSize();
}

function isFavoriteStation(uuid: string): boolean {
  return state.favoriteStations.some((s) => s.stationuuid === uuid);
}

function createStationRow(station: Station): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "radio__item" + (state.currentStation?.stationuuid === station.stationuuid ? " is-active" : "");

  const favicon = document.createElement("div");
  favicon.className = "radio__favicon";
  const letter = (station.name || "?").trim().charAt(0).toUpperCase() || "?";
  favicon.textContent = letter;
  if (station.favicon) {
    const img = document.createElement("img");
    img.src = station.favicon;
    img.alt = "";
    img.addEventListener("error", () => img.remove());
    favicon.textContent = "";
    favicon.appendChild(img);
  }

  const meta = document.createElement("div");
  meta.className = "radio__meta";
  const name = document.createElement("div");
  name.className = "radio__name";
  name.textContent = station.name;
  const sub = document.createElement("div");
  sub.className = "radio__sub";
  sub.textContent = station.custom
    ? stationHost(station.url)
    : [station.country, station.tags, station.bitrate ? station.bitrate + "kbps" : ""].filter(Boolean).join(" · ");
  meta.append(name, sub);

  const isFav = isFavoriteStation(station.stationuuid);
  const favBtn = document.createElement("button");
  favBtn.className = "radio__fav-btn" + (isFav ? " is-fav" : "");
  favBtn.type = "button";
  favBtn.textContent = isFav ? "★" : "☆";
  favBtn.title = isFav ? i18n.t("removeFavorite") : i18n.t("addFavorite");
  favBtn.setAttribute("aria-label", favBtn.title);
  favBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavoriteStation(station);
  });

  li.append(favicon, meta);
  if (station.custom) {
    const editBtn = document.createElement("button");
    editBtn.className = "radio__fav-btn radio__edit-btn";
    editBtn.type = "button";
    editBtn.textContent = "✎";
    editBtn.title = i18n.t("editStation");
    editBtn.setAttribute("aria-label", editBtn.title);
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openStationForm(station);
    });
    li.append(editBtn);
  }
  li.append(favBtn);
  li.addEventListener("click", () => tuneStation(station));
  return li;
}

export function renderRadioResults(): void {
  radioResultsList.innerHTML = "";
  state.radioResults.forEach((s) => radioResultsList.appendChild(createStationRow(s)));
  radioResultsList.hidden = state.radioResults.length === 0;
  if (state.radioOpen && state.radioView === "search") radio.style.maxHeight = radio.scrollHeight + "px";
  syncElectronWindowSize();
}

export function renderRadioFavorites(): void {
  const favorites = state.favoriteStations;
  radioFavoritesList.innerHTML = "";
  favorites.forEach((s) => radioFavoritesList.appendChild(createStationRow(s)));
  radioFavoritesList.hidden = favorites.length === 0;
  radioFavEmpty.hidden = favorites.length > 0;
  radioFavCount.hidden = favorites.length === 0;
  radioFavCount.textContent = String(favorites.length);
  if (state.radioOpen && state.radioView === "favorites") radio.style.maxHeight = radio.scrollHeight + "px";
  syncElectronWindowSize();
}

function toggleFavoriteStation(station: Station): void {
  const idx = state.favoriteStations.findIndex((s) => s.stationuuid === station.stationuuid);
  if (idx >= 0) {
    state.favoriteStations.splice(idx, 1);
  } else {
    state.favoriteStations.push(station);
  }
  renderRadioFavorites();
  renderRadioResults();
  persistConfig();
}

function renderTagOptions(tags: CountedOption[]): void {
  radioTagSelect.innerHTML = `<option value="" data-i18n="tagAny">${i18n.t("tagAny")}</option>`;
  tags.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.name;
    opt.textContent = t.name;
    radioTagSelect.appendChild(opt);
  });
  const stillValid = radioTag && tags.some((t) => t.name === radioTag);
  radioTagSelect.value = stillValid ? radioTag : "";
  if (!stillValid) radioTag = "";
}

async function refreshRadioTags(): Promise<void> {
  if (!window.electronAPI?.loadTagsForFilter) return;
  try {
    const tags = await window.electronAPI.loadTagsForFilter(radioCountry, radioState);
    renderTagOptions(tags);
  } catch (err) {
    console.error("Failed to load radio tags:", err);
    logEvent("error", "radio", `Failed to load tags: ${errorMessage(err)}`);
  }
}

async function loadRadioFilters(): Promise<void> {
  // Avoid a duplicate concurrent load: radioFiltersLoaded only flips on success.
  if (!window.electronAPI?.loadCountries || radioFiltersLoading) return;
  radioFiltersLoading = true;
  try {
    const [countries, tags] = await Promise.all([
      window.electronAPI.loadCountries(),
      window.electronAPI.loadTags(),
    ]);
    countries.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.code;
      opt.dataset.name = c.name;
      opt.textContent = `${c.name} (${c.count})`;
      radioCountrySelect.appendChild(opt);
    });
    renderTagOptions(tags);
    radioFiltersLoaded = true;
  } catch (err) {
    console.error("Failed to load radio filters:", err);
    logEvent("error", "radio", `Failed to load filters: ${errorMessage(err)}`);
  } finally {
    radioFiltersLoading = false;
  }
}

export function ensureRadioFilters(): void {
  if (!radioFiltersLoaded) loadRadioFilters();
}

// Holds the country name, not the ISO code (see fetchStates() in the main process).
let radioStatesToken = 0;

async function loadRadioStates(countryName: string): Promise<void> {
  const token = ++radioStatesToken;
  radioStateSelect.innerHTML = `<option value="" data-i18n="stateAny">${i18n.t("stateAny")}</option>`;
  radioStateSelect.hidden = true;
  if (!countryName || !window.electronAPI?.loadStates) return;
  try {
    const states = await window.electronAPI.loadStates(countryName);
    if (token !== radioStatesToken) return;
    if (states.length === 0) return;
    states.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.name;
      opt.textContent = `${s.name} (${s.count})`;
      radioStateSelect.appendChild(opt);
    });
    radioStateSelect.hidden = false;
    if (state.radioOpen) {
      radio.style.maxHeight = radio.scrollHeight + "px";
      syncElectronWindowSize();
    }
  } catch (err) {
    console.error("Failed to load radio states:", err);
    logEvent("error", "radio", `Failed to load states for "${countryName}": ${errorMessage(err)}`);
  }
}

function setRadioEmptyText(key: string): void {
  radioEmptyKey = key;
  radioEmpty.textContent = i18n.t(key);
}

export function refreshRadioEmptyText(): void {
  setRadioEmptyText(radioEmptyKey);
}

async function runRadioSearch(): Promise<void> {
  if (!window.electronAPI?.searchStations) return;
  const token = ++radioSearchToken;
  radioEmpty.hidden = false;
  setRadioEmptyText("searching");
  try {
    const results = await window.electronAPI.searchStations({
      name: radioSearchInput.value.trim(),
      country: radioCountry,
      state: radioState,
      tag: radioTag,
      limit: 40,
    });
    if (token !== radioSearchToken) return;
    state.radioResults = results;
    renderRadioResults();
    radioEmpty.hidden = state.radioResults.length > 0;
    setRadioEmptyText("nothingFound");
  } catch (err) {
    if (token !== radioSearchToken) return;
    state.radioResults = [];
    renderRadioResults();
    radioEmpty.hidden = false;
    setRadioEmptyText("loadFailed");
    logEvent("error", "radio", `Search failed: ${errorMessage(err)}`);
  }
}

export function initRadioTabs(): void {
  radioTabSearch.addEventListener("click", () => setRadioView("search"));
  radioTabFavorites.addEventListener("click", () => setRadioView("favorites"));
}

export function initRadioSearch(): void {
  radioCountrySelect.addEventListener("change", async () => {
    radioCountry = radioCountrySelect.value;
    radioState = "";
    const countryName = radioCountrySelect.selectedOptions[0]?.dataset.name || "";
    loadRadioStates(countryName);
    await refreshRadioTags();
    runRadioSearch();
  });

  radioStateSelect.addEventListener("change", async () => {
    radioState = radioStateSelect.value;
    await refreshRadioTags();
    runRadioSearch();
  });

  radioTagSelect.addEventListener("change", () => {
    radioTag = radioTagSelect.value;
    runRadioSearch();
  });

  radioSearchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    runRadioSearch();
  });
}
