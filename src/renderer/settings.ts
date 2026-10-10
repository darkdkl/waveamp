import { i18n } from "./i18n";
import { hotkeys } from "./hotkeys";
import { accentColor as accentColorTheme } from "./theme";
import { snapStereoStrength, STEREO_STRENGTH_DEFAULT } from "../shared/stereo";
import { normalizeTitleScrollMode, normalizeTitleScrollSpeed, type TitleScrollMode } from "../shared/titleScroll";
import type {
  AccentColor,
  ProxyConfig,
  ProxyType,
  SettingsAction,
  SettingsActionValue,
  VizResponse,
  WindowControlsSide,
} from "../shared/types";

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const settingsTabInterface = byId<HTMLButtonElement>("settingsTabInterface");
const settingsTabSystem = byId<HTMLButtonElement>("settingsTabSystem");
const settingsInterfaceView = byId("settingsInterfaceView");
const settingsSystemView = byId("settingsSystemView");
const langSelect = byId<HTMLSelectElement>("langSelect");
const scaleSelect = byId<HTMLSelectElement>("scaleSelect");
const vizResponseSelect = byId<HTMLSelectElement>("vizResponseSelect");
const windowControlsSelect = byId<HTMLSelectElement>("windowControlsSelect");
const proxyEnabledBtn = byId<HTMLButtonElement>("proxyEnabledBtn");
const proxyTypeSelect = byId<HTMLSelectElement>("proxyTypeSelect");
const proxyHostInput = byId<HTMLInputElement>("proxyHostInput");
const proxyPortInput = byId<HTMLInputElement>("proxyPortInput");
const proxyUsernameInput = byId<HTMLInputElement>("proxyUsernameInput");
const proxyPasswordInput = byId<HTMLInputElement>("proxyPasswordInput");
const loggingEnabledBtn = byId<HTMLButtonElement>("loggingEnabledBtn");
const openLogFolderBtn = byId<HTMLButtonElement>("openLogFolderBtn");
const clearLogBtn = byId<HTMLButtonElement>("clearLogBtn");
const autoUpdateEnabledBtn = byId<HTMLButtonElement>("autoUpdateEnabledBtn");
const checkUpdatesBtn = byId<HTMLButtonElement>("checkUpdatesBtn");
const updateStatusText = byId("updateStatusText");
const trayEnabledBtn = byId<HTMLButtonElement>("trayEnabledBtn");
const coverArtBtn = byId<HTMLButtonElement>("coverArtBtn");
const titleScrollSelect = byId<HTMLSelectElement>("titleScrollSelect");
const titleScrollSpeedRow = byId("titleScrollSpeedRow");
const titleScrollSpeedInput = byId<HTMLInputElement>("titleScrollSpeedInput");
const radioTrackTitleBtn = byId<HTMLButtonElement>("radioTrackTitleBtn");
const playerClockBtn = byId<HTMLButtonElement>("playerClockBtn");
const stereoStrengthInput = byId<HTMLInputElement>("stereoStrengthInput");
const stereoRadioBtn = byId<HTMLButtonElement>("stereoRadioBtn");
const stereoTracksBtn = byId<HTMLButtonElement>("stereoTracksBtn");
const stereoPseudoBtn = byId<HTMLButtonElement>("stereoPseudoBtn");
const presetAutoSwitchBtn = byId<HTMLButtonElement>("presetAutoSwitchBtn");
const presetHardCutsBtn = byId<HTMLButtonElement>("presetHardCutsBtn");
const presetFolderText = byId("presetFolderText");
const presetFolderChooseBtn = byId<HTMLButtonElement>("presetFolderChooseBtn");
const presetFolderResetBtn = byId<HTMLButtonElement>("presetFolderResetBtn");
const closeMinimizesToTrayBtn = byId<HTMLButtonElement>("closeMinimizesToTrayBtn");
const accentPresets = byId("accentPresets");
const accentHueInput = byId<HTMLInputElement>("accentHueInput");
const accentSaturationInput = byId<HTMLInputElement>("accentSaturationInput");
const accentTintInput = byId<HTMLInputElement>("accentTintInput");
const accentResetBtn = byId<HTMLButtonElement>("accentResetBtn");

const settingsTabHotkeys = byId<HTMLButtonElement>("settingsTabHotkeys");
const settingsHotkeysView = byId("settingsHotkeysView");

function setSettingsView(view: "interface" | "system" | "hotkeys") {
  settingsTabInterface.classList.toggle("is-active", view === "interface");
  settingsTabSystem.classList.toggle("is-active", view === "system");
  settingsTabHotkeys.classList.toggle("is-active", view === "hotkeys");
  settingsInterfaceView.hidden = view !== "interface";
  settingsSystemView.hidden = view !== "system";
  settingsHotkeysView.hidden = view !== "hotkeys";
}
settingsTabInterface.addEventListener("click", () => setSettingsView("interface"));
settingsTabSystem.addEventListener("click", () => setSettingsView("system"));
settingsTabHotkeys.addEventListener("click", () => setSettingsView("hotkeys"));

byId("settingsCloseBtn").addEventListener("click", () => window.electronAPI?.closeSettingsWindow?.());

let zoomFactor = 1;
const settingsResizeHandle = byId("settingsResizeHandle");
const settingsGripResize = byId("settingsGripResize");
function startSettingsResize(event: MouseEvent, handle: HTMLElement, cursor: string) {
  event.preventDefault();
  const startY = event.clientY;
  let frame = 0;
  window.electronAPI?.startSettingsWindowResize?.();
  handle.classList.add("is-active");
  document.body.style.cursor = cursor;
  const onMove = (e: MouseEvent) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => window.electronAPI?.resizeSettingsWindowBy?.((e.clientY - startY) * zoomFactor));
  };
  const onUp = () => {
    handle.classList.remove("is-active");
    document.body.style.cursor = "";
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}
settingsResizeHandle.addEventListener("mousedown", (event) => startSettingsResize(event, settingsResizeHandle, "ns-resize"));
settingsGripResize.addEventListener("mousedown", (event) => startSettingsResize(event, settingsGripResize, "nwse-resize"));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") window.electronAPI?.closeSettingsWindow?.();
});

// State is owned by the player window; this window only relays changes and mirrors onSettingsState.
function sendAction<T extends SettingsAction["type"]>(type: T, value: SettingsActionValue<T>) {
  window.electronAPI?.sendSettingsAction?.({ type, value } as SettingsAction);
}

let proxyEnabled = false;
let loggingEnabled = false;
let autoUpdateEnabled = true;
let trayIconEnabled = false;
let coverArtEnabled = true;
let radioTrackTitleEnabled = true;
let stereoRadio = false;
let stereoTracks = false;
let stereoPseudo = true;
let playerClockEnabled = false;
let presetAutoSwitch = true;
let presetHardCuts = false;
let presetFolder = "";
let closeMinimizesToTrayEnabled = false;
let updateStatusKey = "";
let updateVersion = "";
let releaseUrl = "";

function sendProxyConfig() {
  sendAction("setProxyConfig", {
    enabled: proxyEnabled,
    type: proxyTypeSelect.value as ProxyType,
    host: proxyHostInput.value.trim(),
    port: proxyPortInput.value.trim(),
    username: proxyUsernameInput.value,
    password: proxyPasswordInput.value,
  });
}

function setProxyEnabled(enabled: boolean) {
  proxyEnabled = enabled;
  proxyEnabledBtn.textContent = enabled ? i18n.t("on") : i18n.t("off");
  proxyEnabledBtn.classList.toggle("is-active", enabled);
  [proxyTypeSelect, proxyHostInput, proxyPortInput, proxyUsernameInput, proxyPasswordInput].forEach((el) => {
    el.disabled = !enabled;
  });
  sendProxyConfig();
}

proxyEnabledBtn.addEventListener("click", () => setProxyEnabled(!proxyEnabled));
[proxyTypeSelect, proxyHostInput, proxyPortInput, proxyUsernameInput, proxyPasswordInput].forEach((el) => {
  el.addEventListener("change", sendProxyConfig);
});

function setLoggingEnabled(enabled: boolean) {
  loggingEnabled = enabled;
  loggingEnabledBtn.textContent = enabled ? i18n.t("on") : i18n.t("off");
  loggingEnabledBtn.classList.toggle("is-active", enabled);
  sendAction("setLoggingEnabled", enabled);
}
loggingEnabledBtn.addEventListener("click", () => setLoggingEnabled(!loggingEnabled));
openLogFolderBtn.addEventListener("click", () => window.electronAPI?.openLogFolder?.());

const appVersionText = byId("appVersionText");
const appLicenseBtn = byId<HTMLButtonElement>("appLicenseBtn");
const thirdPartyLicensesBtn = byId<HTMLButtonElement>("thirdPartyLicensesBtn");
window.electronAPI?.getAppVersion?.().then((version) => {
  appVersionText.textContent = `WaveAMP ${version}`;
});
appLicenseBtn.addEventListener("click", () => window.electronAPI?.openLicenseFile?.("LICENSE"));
thirdPartyLicensesBtn.addEventListener("click", () => window.electronAPI?.openLicenseFile?.("THIRD_PARTY_LICENSES.txt"));
clearLogBtn.addEventListener("click", () => window.electronAPI?.clearLogs?.());

function setAutoUpdateEnabled(enabled: boolean) {
  autoUpdateEnabled = enabled;
  autoUpdateEnabledBtn.textContent = enabled ? i18n.t("on") : i18n.t("off");
  autoUpdateEnabledBtn.classList.toggle("is-active", enabled);
  sendAction("setAutoUpdateEnabled", enabled);
}
autoUpdateEnabledBtn.addEventListener("click", () => setAutoUpdateEnabled(!autoUpdateEnabled));

function setCloseMinimizesToTrayEnabled(enabled: boolean) {
  closeMinimizesToTrayEnabled = enabled;
  closeMinimizesToTrayBtn.textContent = enabled ? i18n.t("on") : i18n.t("off");
  closeMinimizesToTrayBtn.classList.toggle("is-active", enabled);
  sendAction("setCloseMinimizesToTrayEnabled", enabled);
}

function setTrayIconEnabled(enabled: boolean) {
  trayIconEnabled = enabled;
  trayEnabledBtn.textContent = enabled ? i18n.t("on") : i18n.t("off");
  trayEnabledBtn.classList.toggle("is-active", enabled);
  closeMinimizesToTrayBtn.disabled = !enabled;
  if (!enabled && closeMinimizesToTrayEnabled) setCloseMinimizesToTrayEnabled(false);
  sendAction("setTrayIconEnabled", enabled);
}
trayEnabledBtn.addEventListener("click", () => setTrayIconEnabled(!trayIconEnabled));

function setCoverArtEnabled(enabled: boolean) {
  coverArtEnabled = enabled;
  coverArtBtn.textContent = enabled ? i18n.t("on") : i18n.t("off");
  coverArtBtn.classList.toggle("is-active", enabled);
  sendAction("setCoverArtEnabled", enabled);
}
coverArtBtn.addEventListener("click", () => setCoverArtEnabled(!coverArtEnabled));

function setRadioTrackTitleEnabled(enabled: boolean) {
  radioTrackTitleEnabled = enabled;
  radioTrackTitleBtn.textContent = enabled ? i18n.t("on") : i18n.t("off");
  radioTrackTitleBtn.classList.toggle("is-active", enabled);
  sendAction("setRadioTrackTitleEnabled", enabled);
}
radioTrackTitleBtn.addEventListener("click", () => setRadioTrackTitleEnabled(!radioTrackTitleEnabled));

function setPlayerClockEnabled(enabled: boolean) {
  playerClockEnabled = enabled;
  playerClockBtn.textContent = enabled ? i18n.t("on") : i18n.t("off");
  playerClockBtn.classList.toggle("is-active", enabled);
  sendAction("setPlayerClockEnabled", enabled);
}
playerClockBtn.addEventListener("click", () => setPlayerClockEnabled(!playerClockEnabled));

function renderToggle(button: HTMLButtonElement, enabled: boolean) {
  button.textContent = enabled ? i18n.t("on") : i18n.t("off");
  button.classList.toggle("is-active", enabled);
}

stereoRadioBtn.addEventListener("click", () => {
  stereoRadio = !stereoRadio;
  renderToggle(stereoRadioBtn, stereoRadio);
  sendAction("setStereoRadio", stereoRadio);
});
stereoTracksBtn.addEventListener("click", () => {
  stereoTracks = !stereoTracks;
  renderToggle(stereoTracksBtn, stereoTracks);
  sendAction("setStereoTracks", stereoTracks);
});
stereoPseudoBtn.addEventListener("click", () => {
  stereoPseudo = !stereoPseudo;
  renderToggle(stereoPseudoBtn, stereoPseudo);
  sendAction("setStereoPseudo", stereoPseudo);
});
function renderTitleScroll(mode: TitleScrollMode) {
  titleScrollSelect.value = mode;
  titleScrollSpeedInput.disabled = mode === "off";
  titleScrollSpeedRow.classList.toggle("is-disabled", mode === "off");
}

titleScrollSelect.addEventListener("change", () => {
  const mode = normalizeTitleScrollMode(titleScrollSelect.value);
  renderTitleScroll(mode);
  sendAction("setTitleScroll", mode);
});
titleScrollSpeedInput.addEventListener("input", () => sendAction("setTitleScrollSpeed", Number(titleScrollSpeedInput.value)));

stereoStrengthInput.addEventListener("input", () => {
  const strength = snapStereoStrength(Number(stereoStrengthInput.value));
  stereoStrengthInput.value = String(strength);
  sendAction("setStereoStrength", strength);
});

function renderPresetSettings() {
  presetAutoSwitchBtn.textContent = presetAutoSwitch ? i18n.t("on") : i18n.t("off");
  presetAutoSwitchBtn.classList.toggle("is-active", presetAutoSwitch);
  presetHardCutsBtn.textContent = presetHardCuts ? i18n.t("on") : i18n.t("off");
  presetHardCutsBtn.classList.toggle("is-active", presetHardCuts);
  presetFolderText.textContent = presetFolder || i18n.t("presetFolderBuiltinOnly");
  presetFolderText.title = presetFolder;
  presetFolderResetBtn.disabled = !presetFolder;
}

presetAutoSwitchBtn.addEventListener("click", () => {
  presetAutoSwitch = !presetAutoSwitch;
  renderPresetSettings();
  sendAction("setPresetAutoSwitch", presetAutoSwitch);
});
presetHardCutsBtn.addEventListener("click", () => {
  presetHardCuts = !presetHardCuts;
  renderPresetSettings();
  sendAction("setPresetHardCuts", presetHardCuts);
});
presetFolderChooseBtn.addEventListener("click", async () => {
  const folder = await window.electronAPI?.choosePresetFolder?.();
  if (!folder) return;
  presetFolder = folder;
  renderPresetSettings();
  sendAction("setPresetFolder", presetFolder);
});
presetFolderResetBtn.addEventListener("click", () => {
  presetFolder = "";
  renderPresetSettings();
  sendAction("setPresetFolder", presetFolder);
});
closeMinimizesToTrayBtn.addEventListener("click", () => setCloseMinimizesToTrayEnabled(!closeMinimizesToTrayEnabled));

const openReleaseBtn = byId<HTMLButtonElement>("openReleaseBtn");

function updateStatusMessage() {
  return updateStatusKey ? i18n.t(updateStatusKey).replace("{version}", updateVersion) : "";
}

function setUpdateStatusText(key: string) {
  updateStatusKey = key;
  updateStatusText.textContent = updateStatusMessage();
  openReleaseBtn.hidden = key !== "updateAvailable";
}

openReleaseBtn.addEventListener("click", () => window.electronAPI?.openReleasePage?.(releaseUrl));

checkUpdatesBtn.addEventListener("click", async () => {
  setUpdateStatusText("checkingForUpdates");
  const result = await window.electronAPI?.checkForUpdates?.();
  if (!result?.ok) {
    setUpdateStatusText("updateCheckFailed");
    return;
  }
  updateVersion = result.version;
  releaseUrl = result.url;
  setUpdateStatusText(result.upToDate ? "upToDate" : "updateAvailable");
});

let accentColor = { ...accentColorTheme.DEFAULT };

const presetButtons = accentColorTheme.PRESETS.map((preset) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "settings-panel__swatch";
  const accent = `hsl(${preset.hue} ${preset.saturation}% 74%)`;
  btn.style.background = preset.tint
    ? `linear-gradient(135deg, ${accent} 50%, hsl(${preset.hue} 40% 24%) 50%)`
    : accent;
  btn.addEventListener("click", () => setAccentColor(preset));
  accentPresets.appendChild(btn);
  return btn;
});

function showAccentColor() {
  accentColorTheme.apply(accentColor);
  accentHueInput.value = String(accentColor.hue);
  accentSaturationInput.value = String(accentColor.saturation);
  accentTintInput.value = String(accentColor.tint);
  accentColorTheme.PRESETS.forEach((preset, i) => {
    presetButtons[i].classList.toggle(
      "is-active",
      preset.hue === accentColor.hue &&
        preset.saturation === accentColor.saturation &&
        preset.tint === accentColor.tint
    );
  });
}

function setAccentColor(color: Partial<AccentColor>) {
  accentColor = accentColorTheme.normalize(color);
  showAccentColor();
  sendAction("setAccentColor", accentColor);
}

accentHueInput.addEventListener("input", () => setAccentColor({ ...accentColor, hue: Number(accentHueInput.value) }));
accentSaturationInput.addEventListener("input", () =>
  setAccentColor({ ...accentColor, saturation: Number(accentSaturationInput.value) })
);
accentTintInput.addEventListener("input", () => setAccentColor({ ...accentColor, tint: Number(accentTintInput.value) }));
accentResetBtn.addEventListener("click", () => setAccentColor(accentColorTheme.DEFAULT));
showAccentColor();

const hotkeysList = byId("hotkeysList");
const globalHotkeysBtn = byId<HTMLButtonElement>("globalHotkeysBtn");
const hotkeysMessage = byId("hotkeysMessage");
const hotkeysHint = byId("hotkeysHint");
const globalHotkeysHint = byId("globalHotkeysHint");
const hotkeysResetBtn = byId<HTMLButtonElement>("hotkeysResetBtn");
const isLinux = /Linux/.test(navigator.platform || navigator.userAgent);

let hotkeyConfig = hotkeys.defaults();
let hotkeyFailures: string[] = [];
let capturing: { action: string; scope: "local" | "global" } | null = null;
let hotkeyMessage: { key: string; params?: Record<string, string | number> } | null = null;

function translate(key: string, params: Record<string, string | number> = {}) {
  return Object.entries(params).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), i18n.t(key));
}

function setHotkeyMessage(key: string | null, params?: Record<string, string | number>) {
  hotkeyMessage = key ? { key, params } : null;
}

function actionName(id: string) {
  return i18n.t(hotkeys.ACTIONS.find((action) => action.id === id)?.nameKey ?? id);
}

function renderHotkeys() {
  const rows = hotkeys.ACTIONS.map((action) => {
    const row = document.createElement("div");
    row.className = "hotkeys__row";
    const name = document.createElement("span");
    name.textContent = i18n.t(action.nameKey);
    row.appendChild(name);

    for (const scope of ["local", "global"] as const) {
      const combo = hotkeyConfig[scope][action.id];
      const isCapturing = capturing?.action === action.id && capturing.scope === scope;
      const failed = scope === "global" && hotkeyConfig.globalEnabled && hotkeyFailures.includes(action.id);
      const field = document.createElement("button");
      field.type = "button";
      field.className = "hotkeys__key";
      field.classList.toggle("is-capturing", isCapturing);
      field.classList.toggle("is-empty", !combo && !isCapturing);
      field.classList.toggle("is-failed", failed && !isCapturing);
      field.disabled = scope === "global" && !hotkeyConfig.globalEnabled;
      field.textContent = isCapturing ? i18n.t("hotkeyPress") : hotkeys.format(combo) || "—";
      field.title = failed ? i18n.t("hotkeyFailed") : "";
      field.addEventListener("click", () => {
        capturing = { action: action.id, scope };
        setHotkeyMessage(null);
        renderHotkeys();
      });
      row.appendChild(field);
    }
    return row;
  });
  hotkeysList.replaceChildren(...rows);

  globalHotkeysBtn.textContent = i18n.t(hotkeyConfig.globalEnabled ? "on" : "off");
  globalHotkeysBtn.classList.toggle("is-active", hotkeyConfig.globalEnabled);
  globalHotkeysHint.hidden = !hotkeyConfig.globalEnabled;

  const failedMessage: typeof hotkeyMessage = hotkeyConfig.globalEnabled && hotkeyFailures.length ? { key: "hotkeyFailedMessage" } : null;
  const message = hotkeyMessage || failedMessage;
  hotkeysMessage.textContent = message ? translate(message.key, message.params) : "";
  hotkeysHint.textContent =
    i18n.t("hotkeysHint") +
    (isLinux && hotkeyConfig.globalEnabled ? " " + i18n.t("hotkeysHintWayland") : "");
}

function sendHotkeys() {
  sendAction("setHotkeys", hotkeyConfig);
}

function assignHotkey(combo: string) {
  if (!capturing) return;
  const { action, scope } = capturing;
  capturing = null;
  if (combo) {
    const reason = hotkeys.rejectReason(combo, scope);
    if (reason) {
      setHotkeyMessage(reason, { combo: hotkeys.format(combo) });
      renderHotkeys();
      return;
    }
    const previous = Object.keys(hotkeyConfig[scope]).find(
      (id) => id !== action && hotkeyConfig[scope][id] === combo
    );
    if (previous) {
      hotkeyConfig[scope][previous] = "";
      setHotkeyMessage("hotkeyMoved", { combo: hotkeys.format(combo), action: actionName(previous) });
    }
  }
  hotkeyConfig[scope][action] = combo;
  renderHotkeys();
  sendHotkeys();
}

// Capture phase: a combo being assigned must not reach the Escape-to-close handler.
document.addEventListener(
  "keydown",
  (event) => {
    if (!capturing) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const plain = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
    if (plain && event.code === "Escape") {
      capturing = null;
      renderHotkeys();
      return;
    }
    if (plain && (event.code === "Backspace" || event.code === "Delete")) {
      assignHotkey("");
      return;
    }
    const combo = hotkeys.comboFromEvent(event);
    if (combo) assignHotkey(combo);
  },
  true
);

document.addEventListener(
  "click",
  (event) => {
    if (capturing && !(event.target as HTMLElement).closest(".hotkeys__key")) {
      capturing = null;
      renderHotkeys();
    }
  },
  true
);

globalHotkeysBtn.addEventListener("click", () => {
  hotkeyConfig.globalEnabled = !hotkeyConfig.globalEnabled;
  setHotkeyMessage(null);
  renderHotkeys();
  sendHotkeys();
});

hotkeysResetBtn.addEventListener("click", () => {
  hotkeyConfig = { ...hotkeys.defaults(), globalEnabled: hotkeyConfig.globalEnabled };
  capturing = null;
  setHotkeyMessage("hotkeysResetDone");
  renderHotkeys();
  sendHotkeys();
});

renderHotkeys();

function refreshTextForLanguage() {
  renderHotkeys();
  accentColorTheme.PRESETS.forEach((preset, i) => {
    presetButtons[i].title = i18n.t(preset.nameKey);
    presetButtons[i].setAttribute("aria-label", i18n.t(preset.nameKey));
  });
  proxyEnabledBtn.textContent = proxyEnabled ? i18n.t("on") : i18n.t("off");
  loggingEnabledBtn.textContent = loggingEnabled ? i18n.t("on") : i18n.t("off");
  autoUpdateEnabledBtn.textContent = autoUpdateEnabled ? i18n.t("on") : i18n.t("off");
  trayEnabledBtn.textContent = trayIconEnabled ? i18n.t("on") : i18n.t("off");
  coverArtBtn.textContent = coverArtEnabled ? i18n.t("on") : i18n.t("off");
  radioTrackTitleBtn.textContent = radioTrackTitleEnabled ? i18n.t("on") : i18n.t("off");
  playerClockBtn.textContent = playerClockEnabled ? i18n.t("on") : i18n.t("off");
  renderToggle(stereoRadioBtn, stereoRadio);
  renderToggle(stereoTracksBtn, stereoTracks);
  renderToggle(stereoPseudoBtn, stereoPseudo);
  renderPresetSettings();
  closeMinimizesToTrayBtn.textContent = closeMinimizesToTrayEnabled ? i18n.t("on") : i18n.t("off");
  if (updateStatusKey) updateStatusText.textContent = updateStatusMessage();
}

langSelect.addEventListener("change", () => {
  i18n.setLanguage(langSelect.value);
  langSelect.value = i18n.getLanguage();
  refreshTextForLanguage();
  sendAction("setLanguage", i18n.getLanguage());
});

scaleSelect.addEventListener("change", () => {
  sendAction("setScale", Number(scaleSelect.value));
});

windowControlsSelect.addEventListener("change", () => {
  sendAction("setWindowControlsSide", windowControlsSelect.value as WindowControlsSide);
});

vizResponseSelect.addEventListener("change", () => {
  sendAction("setVizResponse", vizResponseSelect.value as VizResponse);
});

let windowReadySent = false;

window.electronAPI?.onSettingsState?.((state) => {
  if (!state) return;

  if (state.lang) {
    i18n.setLanguage(state.lang);
    langSelect.value = i18n.getLanguage();
  }
  if (typeof state.scale === "number") scaleSelect.value = String(state.scale);
  if (typeof state.zoomFactor === "number") {
    zoomFactor = state.zoomFactor;
    window.electronAPI?.setZoomFactor?.(state.zoomFactor);
  }
  if (typeof state.scale === "number") window.electronAPI?.setSettingsWindowScale?.(state.scale);
  if (state.vizResponse) vizResponseSelect.value = state.vizResponse;
  renderTitleScroll(normalizeTitleScrollMode(state.titleScroll));
  if (document.activeElement !== titleScrollSpeedInput) {
    titleScrollSpeedInput.value = String(normalizeTitleScrollSpeed(state.titleScrollSpeed));
  }
  if (state.windowControlsSide) {
    windowControlsSelect.value = state.windowControlsSide;
    document.body.classList.toggle("window-controls-right", state.windowControlsSide === "right");
  }
  if (state.hotkeys) {
    hotkeyConfig = hotkeys.normalize(state.hotkeys);
    hotkeyFailures = state.globalHotkeyFailures || [];
    if (!capturing) renderHotkeys();
  }
  // Skip echoes of earlier values while a slider is dragged, or the thumb jitters back.
  const draggingAccent = [accentHueInput, accentSaturationInput, accentTintInput].includes(document.activeElement as HTMLInputElement);
  if (state.accentColor && !draggingAccent) {
    accentColor = accentColorTheme.normalize(state.accentColor);
    showAccentColor();
  }

  const proxy: Partial<ProxyConfig> = state.proxy || {};
  proxyEnabled = !!proxy.enabled;
  proxyTypeSelect.value = proxy.type === "socks5" ? "socks5" : "http";
  proxyHostInput.value = proxy.host || "";
  proxyPortInput.value = proxy.port || "";
  proxyUsernameInput.value = proxy.username || "";
  proxyPasswordInput.value = proxy.password || "";
  [proxyTypeSelect, proxyHostInput, proxyPortInput, proxyUsernameInput, proxyPasswordInput].forEach((el) => {
    el.disabled = !proxyEnabled;
  });

  loggingEnabled = !!state.loggingEnabled;
  autoUpdateEnabled = state.autoUpdateEnabled !== false;
  trayIconEnabled = !!state.showTrayIcon;
  coverArtEnabled = state.coverArtEnabled !== false;
  radioTrackTitleEnabled = state.radioTrackTitleEnabled !== false;
  stereoRadio = !!state.stereoRadio;
  stereoTracks = !!state.stereoTracks;
  stereoPseudo = state.stereoPseudo !== false;
  stereoStrengthInput.value = String(typeof state.stereoStrength === "number" ? state.stereoStrength : STEREO_STRENGTH_DEFAULT);
  playerClockEnabled = !!state.playerClockEnabled;
  presetAutoSwitch = state.presetAutoSwitch !== false;
  presetHardCuts = !!state.presetHardCuts;
  presetFolder = typeof state.presetFolder === "string" ? state.presetFolder : "";
  closeMinimizesToTrayEnabled = !!state.closeMinimizesToTray && trayIconEnabled;
  closeMinimizesToTrayBtn.disabled = !trayIconEnabled;

  proxyEnabledBtn.classList.toggle("is-active", proxyEnabled);
  loggingEnabledBtn.classList.toggle("is-active", loggingEnabled);
  autoUpdateEnabledBtn.classList.toggle("is-active", autoUpdateEnabled);
  trayEnabledBtn.classList.toggle("is-active", trayIconEnabled);
  coverArtBtn.classList.toggle("is-active", coverArtEnabled);
  radioTrackTitleBtn.classList.toggle("is-active", radioTrackTitleEnabled);
  playerClockBtn.classList.toggle("is-active", playerClockEnabled);
  closeMinimizesToTrayBtn.classList.toggle("is-active", closeMinimizesToTrayEnabled);

  refreshTextForLanguage();
  if (!windowReadySent) {
    windowReadySent = true;
    window.electronAPI?.notifyWindowReady?.();
  }
});

window.electronAPI?.requestSettingsState?.();
