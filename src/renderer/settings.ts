import { i18n } from "./i18n";
import { hotkeys } from "./hotkeys";
import { accentColor as accentColorTheme } from "./theme";
import type { ProxyConfig, ProxyType, SettingsAction, SettingsActionValue, VizResponse } from "../shared/types";

const settingsTabInterface = document.getElementById("settingsTabInterface") as HTMLButtonElement;
const settingsTabSystem = document.getElementById("settingsTabSystem") as HTMLButtonElement;
const settingsInterfaceView = document.getElementById("settingsInterfaceView");
const settingsSystemView = document.getElementById("settingsSystemView");
const langSelect = document.getElementById("langSelect") as HTMLSelectElement;
const scaleSelect = document.getElementById("scaleSelect") as HTMLSelectElement;
const vizResponseSelect = document.getElementById("vizResponseSelect") as HTMLSelectElement;
const proxyEnabledBtn = document.getElementById("proxyEnabledBtn") as HTMLButtonElement;
const proxyTypeSelect = document.getElementById("proxyTypeSelect") as HTMLSelectElement;
const proxyHostInput = document.getElementById("proxyHostInput") as HTMLInputElement;
const proxyPortInput = document.getElementById("proxyPortInput") as HTMLInputElement;
const proxyUsernameInput = document.getElementById("proxyUsernameInput") as HTMLInputElement;
const proxyPasswordInput = document.getElementById("proxyPasswordInput") as HTMLInputElement;
const loggingEnabledBtn = document.getElementById("loggingEnabledBtn") as HTMLButtonElement;
const openLogFolderBtn = document.getElementById("openLogFolderBtn") as HTMLButtonElement;
const clearLogBtn = document.getElementById("clearLogBtn") as HTMLButtonElement;
const autoUpdateEnabledBtn = document.getElementById("autoUpdateEnabledBtn") as HTMLButtonElement;
const checkUpdatesBtn = document.getElementById("checkUpdatesBtn") as HTMLButtonElement;
const updateStatusText = document.getElementById("updateStatusText");
const trayEnabledBtn = document.getElementById("trayEnabledBtn") as HTMLButtonElement;
const closeMinimizesToTrayBtn = document.getElementById("closeMinimizesToTrayBtn") as HTMLButtonElement;
const accentPresets = document.getElementById("accentPresets");
const accentHueInput = document.getElementById("accentHueInput") as HTMLInputElement;
const accentSaturationInput = document.getElementById("accentSaturationInput") as HTMLInputElement;
const accentTintInput = document.getElementById("accentTintInput") as HTMLInputElement;
const accentResetBtn = document.getElementById("accentResetBtn") as HTMLButtonElement;

const settingsTabHotkeys = document.getElementById("settingsTabHotkeys") as HTMLButtonElement;
const settingsHotkeysView = document.getElementById("settingsHotkeysView");

function setSettingsView(view) {
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

document.getElementById("settingsCloseBtn").addEventListener("click", () => window.electronAPI?.closeSettingsWindow?.());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") window.electronAPI?.closeSettingsWindow?.();
});

// State is owned by app.js; this window only relays changes and mirrors onSettingsState.
function sendAction<T extends SettingsAction["type"]>(type: T, value: SettingsActionValue<T>) {
  window.electronAPI?.sendSettingsAction?.({ type, value } as SettingsAction);
}

let proxyEnabled = false;
let loggingEnabled = false;
let autoUpdateEnabled = true;
let trayIconEnabled = false;
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

function setProxyEnabled(enabled) {
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

function setLoggingEnabled(enabled) {
  loggingEnabled = enabled;
  loggingEnabledBtn.textContent = enabled ? i18n.t("on") : i18n.t("off");
  loggingEnabledBtn.classList.toggle("is-active", enabled);
  sendAction("setLoggingEnabled", enabled);
}
loggingEnabledBtn.addEventListener("click", () => setLoggingEnabled(!loggingEnabled));
openLogFolderBtn.addEventListener("click", () => window.electronAPI?.openLogFolder?.());

const appVersionText = document.getElementById("appVersionText");
const appLicenseBtn = document.getElementById("appLicenseBtn") as HTMLButtonElement;
const thirdPartyLicensesBtn = document.getElementById("thirdPartyLicensesBtn") as HTMLButtonElement;
window.electronAPI?.getAppVersion?.().then((version) => {
  appVersionText.textContent = `WaveAMP ${version}`;
});
appLicenseBtn.addEventListener("click", () => window.electronAPI?.openLicenseFile?.("LICENSE"));
thirdPartyLicensesBtn.addEventListener("click", () => window.electronAPI?.openLicenseFile?.("THIRD_PARTY_LICENSES.txt"));
clearLogBtn.addEventListener("click", () => window.electronAPI?.clearLogs?.());

function setAutoUpdateEnabled(enabled) {
  autoUpdateEnabled = enabled;
  autoUpdateEnabledBtn.textContent = enabled ? i18n.t("on") : i18n.t("off");
  autoUpdateEnabledBtn.classList.toggle("is-active", enabled);
  sendAction("setAutoUpdateEnabled", enabled);
}
autoUpdateEnabledBtn.addEventListener("click", () => setAutoUpdateEnabled(!autoUpdateEnabled));

function setCloseMinimizesToTrayEnabled(enabled) {
  closeMinimizesToTrayEnabled = enabled;
  closeMinimizesToTrayBtn.textContent = enabled ? i18n.t("on") : i18n.t("off");
  closeMinimizesToTrayBtn.classList.toggle("is-active", enabled);
  sendAction("setCloseMinimizesToTrayEnabled", enabled);
}

function setTrayIconEnabled(enabled) {
  trayIconEnabled = enabled;
  trayEnabledBtn.textContent = enabled ? i18n.t("on") : i18n.t("off");
  trayEnabledBtn.classList.toggle("is-active", enabled);
  closeMinimizesToTrayBtn.disabled = !enabled;
  if (!enabled && closeMinimizesToTrayEnabled) setCloseMinimizesToTrayEnabled(false);
  sendAction("setTrayIconEnabled", enabled);
}
trayEnabledBtn.addEventListener("click", () => setTrayIconEnabled(!trayIconEnabled));
closeMinimizesToTrayBtn.addEventListener("click", () => setCloseMinimizesToTrayEnabled(!closeMinimizesToTrayEnabled));

const openReleaseBtn = document.getElementById("openReleaseBtn") as HTMLButtonElement;

function updateStatusMessage() {
  return updateStatusKey ? i18n.t(updateStatusKey).replace("{version}", updateVersion) : "";
}

function setUpdateStatusText(key) {
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

function setAccentColor(color) {
  accentColor = accentColorTheme.normalize(color);
  showAccentColor();
  sendAction("setAccentColor", accentColor);
}

accentHueInput.addEventListener("input", () => setAccentColor({ ...accentColor, hue: accentHueInput.value }));
accentSaturationInput.addEventListener("input", () =>
  setAccentColor({ ...accentColor, saturation: accentSaturationInput.value })
);
accentTintInput.addEventListener("input", () => setAccentColor({ ...accentColor, tint: accentTintInput.value }));
accentResetBtn.addEventListener("click", () => setAccentColor(accentColorTheme.DEFAULT));
showAccentColor();

const hotkeysList = document.getElementById("hotkeysList");
const globalHotkeysBtn = document.getElementById("globalHotkeysBtn") as HTMLButtonElement;
const hotkeysMessage = document.getElementById("hotkeysMessage");
const hotkeysHint = document.getElementById("hotkeysHint");
const globalHotkeysHint = document.getElementById("globalHotkeysHint");
const hotkeysResetBtn = document.getElementById("hotkeysResetBtn") as HTMLButtonElement;
const isLinux = /Linux/.test(navigator.platform || navigator.userAgent);

let hotkeyConfig = hotkeys.defaults();
let hotkeyFailures = [];
let capturing: { action: string; scope: "local" | "global" } | null = null;
let hotkeyMessage: { key: string; params?: Record<string, string | number> } | null = null;

function translate(key: string, params: Record<string, string | number> = {}) {
  return Object.entries(params).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), i18n.t(key));
}

function setHotkeyMessage(key: string | null, params?: Record<string, string | number>) {
  hotkeyMessage = key ? { key, params } : null;
}

function actionName(id) {
  return i18n.t(hotkeys.ACTIONS.find((action) => action.id === id).nameKey);
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

function assignHotkey(combo) {
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

vizResponseSelect.addEventListener("change", () => {
  sendAction("setVizResponse", vizResponseSelect.value as VizResponse);
});

window.electronAPI?.onSettingsState?.((state) => {
  if (!state) return;

  if (state.lang) {
    i18n.setLanguage(state.lang);
    langSelect.value = i18n.getLanguage();
  }
  if (typeof state.scale === "number") scaleSelect.value = String(state.scale);
  if (typeof state.zoomFactor === "number") window.electronAPI?.setZoomFactor?.(state.zoomFactor);
  if (typeof state.scale === "number") window.electronAPI?.setSettingsWindowScale?.(state.scale);
  if (state.vizResponse) vizResponseSelect.value = state.vizResponse;
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
  closeMinimizesToTrayEnabled = !!state.closeMinimizesToTray && trayIconEnabled;
  closeMinimizesToTrayBtn.disabled = !trayIconEnabled;

  proxyEnabledBtn.classList.toggle("is-active", proxyEnabled);
  loggingEnabledBtn.classList.toggle("is-active", loggingEnabled);
  autoUpdateEnabledBtn.classList.toggle("is-active", autoUpdateEnabled);
  trayEnabledBtn.classList.toggle("is-active", trayIconEnabled);
  closeMinimizesToTrayBtn.classList.toggle("is-active", closeMinimizesToTrayEnabled);

  refreshTextForLanguage();
});

window.electronAPI?.requestSettingsState?.();
