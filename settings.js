const settingsTabInterface = document.getElementById("settingsTabInterface");
const settingsTabSystem = document.getElementById("settingsTabSystem");
const settingsInterfaceView = document.getElementById("settingsInterfaceView");
const settingsSystemView = document.getElementById("settingsSystemView");
const langSelect = document.getElementById("langSelect");
const scaleSelect = document.getElementById("scaleSelect");
const vizResponseSelect = document.getElementById("vizResponseSelect");
const proxyEnabledBtn = document.getElementById("proxyEnabledBtn");
const proxyTypeSelect = document.getElementById("proxyTypeSelect");
const proxyHostInput = document.getElementById("proxyHostInput");
const proxyPortInput = document.getElementById("proxyPortInput");
const proxyUsernameInput = document.getElementById("proxyUsernameInput");
const proxyPasswordInput = document.getElementById("proxyPasswordInput");
const loggingEnabledBtn = document.getElementById("loggingEnabledBtn");
const openLogFolderBtn = document.getElementById("openLogFolderBtn");
const clearLogBtn = document.getElementById("clearLogBtn");
const autoUpdateEnabledBtn = document.getElementById("autoUpdateEnabledBtn");
const checkUpdatesBtn = document.getElementById("checkUpdatesBtn");
const updateStatusText = document.getElementById("updateStatusText");
const trayEnabledBtn = document.getElementById("trayEnabledBtn");
const closeMinimizesToTrayBtn = document.getElementById("closeMinimizesToTrayBtn");
const accentPresets = document.getElementById("accentPresets");
const accentHueInput = document.getElementById("accentHueInput");
const accentSaturationInput = document.getElementById("accentSaturationInput");
const accentTintInput = document.getElementById("accentTintInput");
const accentResetBtn = document.getElementById("accentResetBtn");

const settingsTabHotkeys = document.getElementById("settingsTabHotkeys");
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
function sendAction(type, value) {
  window.electronAPI?.sendSettingsAction?.({ type, value });
}

let proxyEnabled = false;
let loggingEnabled = false;
let autoUpdateEnabled = true;
let trayIconEnabled = false;
let closeMinimizesToTrayEnabled = false;
let updateStatusKey = "";

function sendProxyConfig() {
  sendAction("setProxyConfig", {
    enabled: proxyEnabled,
    type: proxyTypeSelect.value,
    host: proxyHostInput.value.trim(),
    port: proxyPortInput.value.trim(),
    username: proxyUsernameInput.value,
    password: proxyPasswordInput.value,
  });
}

function setProxyEnabled(enabled) {
  proxyEnabled = enabled;
  proxyEnabledBtn.textContent = enabled ? window.i18n.t("on") : window.i18n.t("off");
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
  loggingEnabledBtn.textContent = enabled ? window.i18n.t("on") : window.i18n.t("off");
  loggingEnabledBtn.classList.toggle("is-active", enabled);
  sendAction("setLoggingEnabled", enabled);
}
loggingEnabledBtn.addEventListener("click", () => setLoggingEnabled(!loggingEnabled));
openLogFolderBtn.addEventListener("click", () => window.electronAPI?.openLogFolder?.());

const appVersionText = document.getElementById("appVersionText");
const appLicenseBtn = document.getElementById("appLicenseBtn");
const thirdPartyLicensesBtn = document.getElementById("thirdPartyLicensesBtn");
window.electronAPI?.getAppVersion?.().then((version) => {
  appVersionText.textContent = `WaveAMP ${version}`;
});
appLicenseBtn.addEventListener("click", () => window.electronAPI?.openLicenseFile?.("LICENSE"));
thirdPartyLicensesBtn.addEventListener("click", () => window.electronAPI?.openLicenseFile?.("THIRD_PARTY_LICENSES.txt"));
clearLogBtn.addEventListener("click", () => window.electronAPI?.clearLogs?.());

function setAutoUpdateEnabled(enabled) {
  autoUpdateEnabled = enabled;
  autoUpdateEnabledBtn.textContent = enabled ? window.i18n.t("on") : window.i18n.t("off");
  autoUpdateEnabledBtn.classList.toggle("is-active", enabled);
  sendAction("setAutoUpdateEnabled", enabled);
}
autoUpdateEnabledBtn.addEventListener("click", () => setAutoUpdateEnabled(!autoUpdateEnabled));

function setCloseMinimizesToTrayEnabled(enabled) {
  closeMinimizesToTrayEnabled = enabled;
  closeMinimizesToTrayBtn.textContent = enabled ? window.i18n.t("on") : window.i18n.t("off");
  closeMinimizesToTrayBtn.classList.toggle("is-active", enabled);
  sendAction("setCloseMinimizesToTrayEnabled", enabled);
}

function setTrayIconEnabled(enabled) {
  trayIconEnabled = enabled;
  trayEnabledBtn.textContent = enabled ? window.i18n.t("on") : window.i18n.t("off");
  trayEnabledBtn.classList.toggle("is-active", enabled);
  closeMinimizesToTrayBtn.disabled = !enabled;
  if (!enabled && closeMinimizesToTrayEnabled) setCloseMinimizesToTrayEnabled(false);
  sendAction("setTrayIconEnabled", enabled);
}
trayEnabledBtn.addEventListener("click", () => setTrayIconEnabled(!trayIconEnabled));
closeMinimizesToTrayBtn.addEventListener("click", () => setCloseMinimizesToTrayEnabled(!closeMinimizesToTrayEnabled));

function setUpdateStatusText(key) {
  updateStatusKey = key;
  updateStatusText.textContent = key ? window.i18n.t(key) : "";
}

checkUpdatesBtn.addEventListener("click", async () => {
  setUpdateStatusText("checkingForUpdates");
  const result = await window.electronAPI?.checkForUpdates?.();
  if (!result?.ok) {
    setUpdateStatusText("updateCheckFailed");
    return;
  }
  setUpdateStatusText(result.upToDate ? "upToDate" : "updateFoundDownloading");
});

let accentColor = { ...window.accentColor.DEFAULT };

const presetButtons = window.accentColor.PRESETS.map((preset) => {
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
  window.accentColor.apply(accentColor);
  accentHueInput.value = String(accentColor.hue);
  accentSaturationInput.value = String(accentColor.saturation);
  accentTintInput.value = String(accentColor.tint);
  window.accentColor.PRESETS.forEach((preset, i) => {
    presetButtons[i].classList.toggle(
      "is-active",
      preset.hue === accentColor.hue &&
        preset.saturation === accentColor.saturation &&
        preset.tint === accentColor.tint
    );
  });
}

function setAccentColor(color) {
  accentColor = window.accentColor.normalize(color);
  showAccentColor();
  sendAction("setAccentColor", accentColor);
}

accentHueInput.addEventListener("input", () => setAccentColor({ ...accentColor, hue: accentHueInput.value }));
accentSaturationInput.addEventListener("input", () =>
  setAccentColor({ ...accentColor, saturation: accentSaturationInput.value })
);
accentTintInput.addEventListener("input", () => setAccentColor({ ...accentColor, tint: accentTintInput.value }));
accentResetBtn.addEventListener("click", () => setAccentColor(window.accentColor.DEFAULT));
showAccentColor();

const hotkeysList = document.getElementById("hotkeysList");
const globalHotkeysBtn = document.getElementById("globalHotkeysBtn");
const hotkeysMessage = document.getElementById("hotkeysMessage");
const hotkeysHint = document.getElementById("hotkeysHint");
const globalHotkeysHint = document.getElementById("globalHotkeysHint");
const hotkeysResetBtn = document.getElementById("hotkeysResetBtn");
const isLinux = /Linux/.test(navigator.platform || navigator.userAgent);

let hotkeyConfig = window.hotkeys.defaults();
let hotkeyFailures = [];
let capturing = null;
let hotkeyMessage = null;

function translate(key, params = {}) {
  return Object.entries(params).reduce((text, [name, value]) => text.replace(`{${name}}`, value), window.i18n.t(key));
}

function setHotkeyMessage(key, params) {
  hotkeyMessage = key ? { key, params } : null;
}

function actionName(id) {
  return window.i18n.t(window.hotkeys.ACTIONS.find((action) => action.id === id).nameKey);
}

function renderHotkeys() {
  const rows = window.hotkeys.ACTIONS.map((action) => {
    const row = document.createElement("div");
    row.className = "hotkeys__row";
    const name = document.createElement("span");
    name.textContent = window.i18n.t(action.nameKey);
    row.appendChild(name);

    for (const scope of ["local", "global"]) {
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
      field.textContent = isCapturing ? window.i18n.t("hotkeyPress") : window.hotkeys.format(combo) || "—";
      field.title = failed ? window.i18n.t("hotkeyFailed") : "";
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

  globalHotkeysBtn.textContent = window.i18n.t(hotkeyConfig.globalEnabled ? "on" : "off");
  globalHotkeysBtn.classList.toggle("is-active", hotkeyConfig.globalEnabled);
  globalHotkeysHint.hidden = !hotkeyConfig.globalEnabled;

  const failedMessage = hotkeyConfig.globalEnabled && hotkeyFailures.length ? { key: "hotkeyFailedMessage" } : null;
  const message = hotkeyMessage || failedMessage;
  hotkeysMessage.textContent = message ? translate(message.key, message.params) : "";
  hotkeysHint.textContent =
    window.i18n.t("hotkeysHint") +
    (isLinux && hotkeyConfig.globalEnabled ? " " + window.i18n.t("hotkeysHintWayland") : "");
}

function sendHotkeys() {
  sendAction("setHotkeys", hotkeyConfig);
}

function assignHotkey(combo) {
  const { action, scope } = capturing;
  capturing = null;
  if (combo) {
    const reason = window.hotkeys.rejectReason(combo, scope);
    if (reason) {
      setHotkeyMessage(reason, { combo: window.hotkeys.format(combo) });
      renderHotkeys();
      return;
    }
    const previous = Object.keys(hotkeyConfig[scope]).find(
      (id) => id !== action && hotkeyConfig[scope][id] === combo
    );
    if (previous) {
      hotkeyConfig[scope][previous] = "";
      setHotkeyMessage("hotkeyMoved", { combo: window.hotkeys.format(combo), action: actionName(previous) });
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
    const combo = window.hotkeys.comboFromEvent(event);
    if (combo) assignHotkey(combo);
  },
  true
);

document.addEventListener(
  "click",
  (event) => {
    if (capturing && !event.target.closest(".hotkeys__key")) {
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
  hotkeyConfig = { ...window.hotkeys.defaults(), globalEnabled: hotkeyConfig.globalEnabled };
  capturing = null;
  setHotkeyMessage("hotkeysResetDone");
  renderHotkeys();
  sendHotkeys();
});

renderHotkeys();

function refreshTextForLanguage() {
  renderHotkeys();
  window.accentColor.PRESETS.forEach((preset, i) => {
    presetButtons[i].title = window.i18n.t(preset.nameKey);
    presetButtons[i].setAttribute("aria-label", window.i18n.t(preset.nameKey));
  });
  proxyEnabledBtn.textContent = proxyEnabled ? window.i18n.t("on") : window.i18n.t("off");
  loggingEnabledBtn.textContent = loggingEnabled ? window.i18n.t("on") : window.i18n.t("off");
  autoUpdateEnabledBtn.textContent = autoUpdateEnabled ? window.i18n.t("on") : window.i18n.t("off");
  trayEnabledBtn.textContent = trayIconEnabled ? window.i18n.t("on") : window.i18n.t("off");
  closeMinimizesToTrayBtn.textContent = closeMinimizesToTrayEnabled ? window.i18n.t("on") : window.i18n.t("off");
  if (updateStatusKey) updateStatusText.textContent = window.i18n.t(updateStatusKey);
}

langSelect.addEventListener("change", () => {
  window.i18n.setLanguage(langSelect.value);
  langSelect.value = window.i18n.getLanguage();
  refreshTextForLanguage();
  sendAction("setLanguage", window.i18n.getLanguage());
});

scaleSelect.addEventListener("change", () => {
  sendAction("setScale", Number(scaleSelect.value));
});

vizResponseSelect.addEventListener("change", () => {
  sendAction("setVizResponse", vizResponseSelect.value);
});

window.electronAPI?.onSettingsState?.((state) => {
  if (!state) return;

  if (state.lang) {
    window.i18n.setLanguage(state.lang);
    langSelect.value = window.i18n.getLanguage();
  }
  if (typeof state.scale === "number") scaleSelect.value = String(state.scale);
  if (state.vizResponse) vizResponseSelect.value = state.vizResponse;
  if (state.hotkeys) {
    hotkeyConfig = window.hotkeys.normalize(state.hotkeys);
    hotkeyFailures = state.globalHotkeyFailures || [];
    if (!capturing) renderHotkeys();
  }
  // Skip echoes of earlier values while a slider is dragged, or the thumb jitters back.
  const draggingAccent = [accentHueInput, accentSaturationInput, accentTintInput].includes(document.activeElement);
  if (state.accentColor && !draggingAccent) {
    accentColor = window.accentColor.normalize(state.accentColor);
    showAccentColor();
  }

  const proxy = state.proxy || {};
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
