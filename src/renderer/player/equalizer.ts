import { i18n } from "../i18n";
import { eq, eqBandGroup, eqPreamp, eqPresetSelect, eqResetBtn, eqToggleBtn } from "./dom";
import { state } from "./state";
import { EQ_BANDS, EQ_PRESETS, findEqPreset, presetPreampDb } from "./eqPresets";
import { formatBandLabel, formatDb } from "./format";
import { applyEqState } from "./audioGraph";
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

  EQ_BANDS.forEach((freq, i) => {
    eqBandGroup.appendChild(
      createEqBandControl(formatBandLabel(freq), (db) => {
        state.bandGains[i] = db;
        markEqCustom();
        applyEqState();
        persistConfig();
      })
    );
  });
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
  eqToggleBtn.textContent = state.eqEnabled ? i18n.t("eqOn") : i18n.t("eqOff");
  eqToggleBtn.classList.toggle("is-active", state.eqEnabled);
}

function resetEq(): void {
  selectEqPreset("flat");
}

function selectEqPreset(id: string): void {
  const preset = findEqPreset(id);
  const gains = preset ? preset.bands : state.customEq.bandGains;
  gains.forEach((db, i) => {
    state.bandGains[i] = db;
  });
  state.preampDb = preset ? presetPreampDb(preset.bands) : state.customEq.preampDb;
  state.eqPreset = preset ? preset.id : "custom";
  eqPresetSelect.value = state.eqPreset;
  syncEqControlsFromState();
  applyEqState();
  persistConfig();
}

function markEqCustom(): void {
  state.eqPreset = "custom";
  state.customEq = { bandGains: [...state.bandGains], preampDb: state.preampDb };
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
