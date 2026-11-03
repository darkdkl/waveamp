import { i18n } from "../../i18n";
import {
  radio,
  radioAddView,
  radioCountrySelect,
  radioEmpty,
  radioFavCount,
  radioFilterBtn,
  radioFilterLabel,
  radioFilterMenu,
  radioFilterReset,
  radioFilterWrap,
  radioFavEmpty,
  radioFavoritesList,
  radioFavoritesView,
  radioResultsFrame,
  radioResultsList,
  radioSearchForm,
  radioSearchInput,
  radioSearchView,
  radioStateRow,
  radioStateSelect,
  radioTabAdd,
  radioTabFavorites,
  radioSavedView,
  radioTabSaved,
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
import type { CountedOption, CountryOption, Station, StationSearchResult } from "../../../shared/types";
import { countryEntries, countryName } from "./countryNames";
import { createDropdown } from "../dropdown";
import { errorMessage } from "../../../shared/errors";

let radioCountry = "";
let radioState = "";
let radioTag = "";
let radioFiltersLoaded = false;
let radioFiltersLoading = false;
let radioEmptyKey = "enterNameOrFilter";
let radioSearchToken = 0;
let radioSearchTimer: ReturnType<typeof setTimeout> | undefined;
let setFilterMenuOpen: (open: boolean) => void = () => {};

const RADIO_SEARCH_DELAY_MS = 400;

function isRadioSearchOpen(): boolean {
  return !radioSearchForm.hidden;
}

function renderSearchTab(): void {
  const active = state.radioView === "search" && isRadioSearchOpen();
  radioTabSearch.classList.toggle("is-active", active);
  radioTabSearch.setAttribute("aria-pressed", String(active));
}

function setRadioSearchOpen(open: boolean): void {
  radioSearchForm.hidden = !open;
  radio.classList.toggle("is-searching", open);
  renderSearchTab();
  if (open) return;
  clearTimeout(radioSearchTimer);
  radioSearchInput.value = "";
  setFilterMenuOpen(false);
}

export function openRadioSearch(): void {
  if (state.radioView !== "search") setRadioView("search");
  setRadioSearchOpen(true);
  radioSearchInput.ownerDocument.defaultView?.focus();
  radioSearchInput.focus();
}

export function setRadioView(view: RadioView): void {
  if (view !== "search" && isRadioSearchOpen()) setRadioSearchOpen(false);
  state.radioView = view;
  renderSearchTab();
  radioTabFavorites.classList.toggle("is-active", view === "favorites");
  radioTabFavorites.setAttribute("aria-pressed", String(view === "favorites"));
  radioTabAdd.classList.toggle("is-active", view === "add");
  radioTabAdd.setAttribute("aria-pressed", String(view === "add"));
  radioTabSaved.classList.toggle("is-active", view === "saved");
  radioTabSaved.setAttribute("aria-pressed", String(view === "saved"));
  radioSearchView.hidden = view !== "search";
  radioSavedView.hidden = view !== "saved";
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
    img.addEventListener("error", () => {
      img.remove();
      favicon.textContent = letter;
    });
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
    : [
        countryName(station.countrycode, station.country, i18n.getLanguage()),
        station.tags,
        station.bitrate ? station.bitrate + "kbps" : "",
      ]
        .filter(Boolean)
        .join(" · ");
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

let radioCountries: CountryOption[] = [];

function syncSelectTitle(select: HTMLSelectElement): void {
  select.title = select.selectedOptions[0]?.textContent ?? "";
}

function resetOptions(select: HTMLSelectElement, anyKey: string): void {
  select.querySelectorAll("option").forEach((option) => option.remove());
  const any = document.createElement("option");
  any.value = "";
  any.dataset.i18n = anyKey;
  any.textContent = i18n.t(anyKey);
  select.append(any);
}

function renderFilterButton(): void {
  const label = [radioCountry, radioTag].filter(Boolean).join(" · ");
  radioFilterLabel.textContent = label;
  radioFilterLabel.hidden = !label;
  radioFilterBtn.classList.toggle("is-current", !!(radioCountry || radioState || radioTag));
  const chosen = [
    radioCountry ? radioCountrySelect.selectedOptions[0]?.textContent : "",
    radioState,
    radioTag,
  ].filter(Boolean);
  const title = chosen.length ? `${i18n.t("radioFilters")}: ${chosen.join(" · ")}` : i18n.t("radioFilters");
  radioFilterBtn.title = title;
  radioFilterBtn.setAttribute("aria-label", title);
}

function renderCountryOptions(): void {
  resetOptions(radioCountrySelect, "countryAny");
  for (const country of countryEntries(radioCountries, i18n.getLanguage())) {
    const opt = document.createElement("option");
    opt.value = country.code;
    opt.dataset.name = country.name;
    opt.textContent = country.label;
    radioCountrySelect.appendChild(opt);
  }
  radioCountrySelect.value = radioCountry;
  syncSelectTitle(radioCountrySelect);
  renderFilterButton();
}

export function refreshRadioFilterText(): void {
  if (radioCountries.length) renderCountryOptions();
  else renderFilterButton();
}

function renderTagOptions(tags: CountedOption[]): void {
  resetOptions(radioTagSelect, "tagAny");
  tags.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.name;
    opt.textContent = t.name;
    radioTagSelect.appendChild(opt);
  });
  const stillValid = radioTag && tags.some((t) => t.name === radioTag);
  radioTagSelect.value = stillValid ? radioTag : "";
  if (!stillValid) radioTag = "";
  syncSelectTitle(radioTagSelect);
  renderFilterButton();
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
    radioCountries = countries;
    renderCountryOptions();
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
  resetOptions(radioStateSelect, "stateAny");
  radioStateRow.hidden = true;
  syncSelectTitle(radioStateSelect);
  if (!countryName || !window.electronAPI?.loadStates) return;
  try {
    const states = await window.electronAPI.loadStates(countryName);
    if (token !== radioStatesToken) return;
    if (states.length === 0) return;
    states.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.name;
      opt.textContent = s.name;
      radioStateSelect.appendChild(opt);
    });
    radioStateRow.hidden = false;
  } catch (err) {
    console.error("Failed to load radio states:", err);
    logEvent("error", "radio", `Failed to load states for "${countryName}": ${errorMessage(err)}`);
  }
}

function setRadioEmptyText(key: string): void {
  radioEmptyKey = key;
  if (key !== "catalogUnavailable") {
    radioEmpty.textContent = i18n.t(key);
    return;
  }
  const title = document.createElement("span");
  title.className = "radio__empty-title";
  title.textContent = i18n.t("catalogUnavailable");
  const hint = document.createElement("span");
  hint.textContent = i18n.t("catalogUnavailableHint");
  radioEmpty.replaceChildren(title, hint);
}

export function refreshRadioEmptyText(): void {
  setRadioEmptyText(radioEmptyKey);
}

async function runRadioSearch(): Promise<void> {
  if (!window.electronAPI?.searchStations) return;
  if (!radioSearchInput.value.trim() && !radioCountry && !radioState && !radioTag) {
    radioSearchToken += 1;
    state.radioResults = [];
    renderRadioResults();
    radioEmpty.hidden = false;
    setRadioEmptyText("enterNameOrFilter");
    return;
  }
  const token = ++radioSearchToken;
  radioEmpty.hidden = false;
  setRadioEmptyText("searching");
  const result = await window.electronAPI
    .searchStations({
      name: radioSearchInput.value.trim(),
      country: radioCountry,
      state: radioState,
      tag: radioTag,
      limit: 40,
    })
    .catch((err: unknown): StationSearchResult => {
      logEvent("error", "radio", `Search failed: ${errorMessage(err)}`);
      return { ok: false, error: "failed" };
    });
  if (token !== radioSearchToken) return;
  state.radioResults = result.ok ? result.stations : [];
  renderRadioResults();
  radioEmpty.hidden = state.radioResults.length > 0;
  if (result.ok) setRadioEmptyText("nothingFound");
  else setRadioEmptyText(result.error === "unavailable" ? "catalogUnavailable" : "loadFailed");
}

export function initRadioTabs(): void {
  radioTabSearch.addEventListener("click", () => {
    if (state.radioView === "search" && isRadioSearchOpen()) setRadioSearchOpen(false);
    else openRadioSearch();
  });
  radioTabFavorites.addEventListener("click", () => setRadioView("favorites"));
  radioTabSaved.addEventListener("click", () => setRadioView("saved"));
}

const PICKER_GAP_PX = 2;

function fitPickerToResults(select: HTMLSelectElement): void {
  const height = radioResultsFrame.getBoundingClientRect().bottom - select.getBoundingClientRect().bottom - PICKER_GAP_PX;
  select.style.setProperty("--picker-max-height", `${Math.max(0, Math.floor(height))}px`);
}

export function initRadioSearch(): void {
  for (const select of [radioCountrySelect, radioStateSelect, radioTagSelect]) {
    select.addEventListener("pointerdown", () => fitPickerToResults(select));
    select.addEventListener("keydown", () => fitPickerToResults(select));
  }

  radioCountrySelect.addEventListener("change", async () => {
    radioCountry = radioCountrySelect.value;
    syncSelectTitle(radioCountrySelect);
    renderFilterButton();
    radioState = "";
    const countryName = radioCountrySelect.selectedOptions[0]?.dataset.name || "";
    loadRadioStates(countryName);
    await refreshRadioTags();
    runRadioSearch();
  });

  radioStateSelect.addEventListener("change", async () => {
    radioState = radioStateSelect.value;
    syncSelectTitle(radioStateSelect);
    renderFilterButton();
    await refreshRadioTags();
    runRadioSearch();
  });

  radioTagSelect.addEventListener("change", () => {
    radioTag = radioTagSelect.value;
    syncSelectTitle(radioTagSelect);
    renderFilterButton();
    runRadioSearch();
  });

  radioSearchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(radioSearchTimer);
    runRadioSearch();
  });

  radioSearchInput.addEventListener("input", () => {
    clearTimeout(radioSearchTimer);
    radioSearchTimer = setTimeout(runRadioSearch, RADIO_SEARCH_DELAY_MS);
  });

  radioSearchInput.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !radioFilterMenu.hidden) return;
    e.preventDefault();
    setRadioSearchOpen(false);
  });

  setFilterMenuOpen = createDropdown(radioFilterBtn, radioFilterMenu, radioFilterWrap);

  radioFilterReset.addEventListener("click", () => {
    radioTag = "";
    radioTagSelect.value = "";
    radioCountrySelect.value = "";
    radioCountrySelect.dispatchEvent(new Event("change"));
  });
}
