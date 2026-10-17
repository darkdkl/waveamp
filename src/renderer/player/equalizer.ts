import { i18n } from "../i18n";
import { eq, eqBandGroup, eqPreamp, eqPresetSelect, eqResetBtn, eqToggleBtn } from "./dom";
import { state } from "./state";
import { EQ_PRESETS, findEqPreset, presetGains, presetPreampDb } from "./eqPresets";
import { formatDb } from "./format";
import { applyEqState, configureEqFilters } from "./audioGraph";
import { convertGains, EQ_LAYOUTS } from "../../shared/eqCurve";
import type { EqBandCount, EqCustomPreset } from "../../shared/types";
import { renderSwitch } from "../switchControl";
import { persistConfig } from "./config";

function createEqBandControl(label: string, onChange: (db: number) => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "eq__band";

  const valueEl = document.createElement("span");
  valueEl.className = "eq__value";
  valueEl.textContent = formatDb(0);

  const sliderWrap = document.createElement("div");
  sliderWrap.className = "eq__slider-wrap";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "eq__slider";
  slider.min = "-12";
  slider.max = "12";
  slider.step = "1";
  slider.value = "0";
  slider.title = label;
  slider.addEventListener("input", () => {
    const db = Number(slider.value);
    valueEl.textContent = formatDb(db);
    onChange(db);
  });
  sliderWrap.appendChild(slider);

  const labelEl = document.createElement("span");
  labelEl.className = "eq__label";
  labelEl.textContent = label;

  wrap.append(valueEl, sliderWrap, labelEl);
  return wrap;
}

function buildEqPanel(): void {
  eqPreamp.appendChild(
    createEqBandControl("PRE", (db) => {
      state.preampDb = db;
      markEqCustom();
      applyEqState();
      persistConfig();
    })
  );
  buildEqBands();
}

function buildEqBands(): void {
  eqBandGroup.replaceChildren(
    ...EQ_LAYOUTS[state.eqBandCount].labels.map((label, i) =>
      createEqBandControl(label, (db) => {
        state.bandGains[i] = db;
        markEqCustom();
        applyEqState();
        persistConfig();
      })
    )
  );
}

function customFor(count: EqBandCount): EqCustomPreset {
  if (count === 10) return state.customEq;
  if (state.fineCustomEq) return state.fineCustomEq;
  return { bandGains: convertGains(state.customEq.bandGains, 10, 19), preampDb: state.customEq.preampDb };
}

function setCustom(custom: EqCustomPreset): void {
  if (state.eqBandCount === 19) state.fineCustomEq = custom;
  else state.customEq = custom;
}

export function loadEqGains(): void {
  const preset = findEqPreset(state.eqPreset);
  if (preset) {
    state.bandGains = presetGains(preset, state.eqBandCount);
    state.preampDb = presetPreampDb(state.bandGains);
  } else {
    const custom = customFor(state.eqBandCount);
    state.bandGains = [...custom.bandGains];
    state.preampDb = custom.preampDb;
  }
}

export function applyEqBandCount(count: EqBandCount): void {
  if (count === state.eqBandCount) return;
  state.eqBandCount = count;
  configureEqFilters();
  buildEqBands();
  loadEqGains();
  syncEqControlsFromState();
  applyEqState();
}

export function syncEqControlsFromState(): void {
  const sliders = eq.querySelectorAll<HTMLInputElement>(".eq__slider");
  const values = eq.querySelectorAll<HTMLElement>(".eq__value");

  if (sliders[0]) sliders[0].value = String(state.preampDb);
  if (values[0]) values[0].textContent = formatDb(state.preampDb);

  state.bandGains.forEach((db, i) => {
    if (sliders[i + 1]) sliders[i + 1].value = String(db);
    if (values[i + 1]) values[i + 1].textContent = formatDb(db);
  });

  renderEqToggle();
}

export function renderEqToggle(): void {
  const locked = !state.eqEnabled;
  renderSwitch(eqToggleBtn, state.eqEnabled);
  eq.classList.toggle("is-off", locked);
  eq.querySelectorAll<HTMLInputElement>(".eq__slider").forEach((slider) => (slider.disabled = locked));
  eqPresetSelect.disabled = locked;
  eqResetBtn.disabled = locked;
}

function resetEq(): void {
  selectEqPreset("flat");
}

function selectEqPreset(id: string): void {
  state.eqPreset = findEqPreset(id) ? id : "custom";
  loadEqGains();
  eqPresetSelect.value = state.eqPreset;
  syncEqControlsFromState();
  applyEqState();
  persistConfig();
}

function markEqCustom(): void {
  state.eqPreset = "custom";
  setCustom({ bandGains: [...state.bandGains], preampDb: state.preampDb });
  eqPresetSelect.value = "custom";
}

function buildEqPresetOptions(): void {
  const options = [{ id: "custom", nameKey: "eqPresetCustom" }, ...EQ_PRESETS].map(({ id, nameKey }) => {
    const option = document.createElement("option");
    option.value = id;
    option.dataset.i18n = nameKey;
    option.textContent = i18n.t(nameKey);
    return option;
  });
  eqPresetSelect.append(...options);
  eqPresetSelect.value = state.eqPreset;
}

export function initEqualizerControls(): void {
  eqPresetSelect.addEventListener("change", () => selectEqPreset(eqPresetSelect.value));

  eqToggleBtn.addEventListener("click", () => {
    state.eqEnabled = !state.eqEnabled;
    renderEqToggle();
    applyEqState();
    persistConfig();
  });

  eqResetBtn.addEventListener("click", resetEq);
}

export function buildEqualizer(): void {
  buildEqPanel();
  buildEqPresetOptions();
}
