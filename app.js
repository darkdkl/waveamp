const audio = document.getElementById("audio");
audio.crossOrigin = "anonymous";
const player = document.getElementById("player");
const fileInput = document.getElementById("fileInput");
const folderInput = document.getElementById("folderInput");

const trackTitle = document.getElementById("trackTitle");
const timeDisplay = document.getElementById("time");
const durTime = document.getElementById("durTime");
const liveTag = document.getElementById("liveTag");
const viz = document.getElementById("viz");
const seek = document.getElementById("seek");
const volume = document.getElementById("volume");

const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const playlistBtn = document.getElementById("playlistBtn");
const playlist = document.getElementById("playlist");
const playlistList = document.getElementById("playlistList");
const playlistListFrame = document.getElementById("playlistListFrame");
const playlistEmpty = document.getElementById("playlistEmpty");
const playlistClearBtn = document.getElementById("playlistClearBtn");
const playlistResizeHandle = document.getElementById("playlistResizeHandle");
const playlistAddWrap = document.getElementById("playlistAddWrap");
const playlistAddBtn = document.getElementById("playlistAddBtn");
const playlistAddMenu = document.getElementById("playlistAddMenu");
const addFilesMenuItem = document.getElementById("addFilesMenuItem");
const addFolderMenuItem = document.getElementById("addFolderMenuItem");

const settingsBtn = document.getElementById("settingsBtn");

const eqBtn = document.getElementById("eqBtn");
const eq = document.getElementById("eq");
const eqToggleBtn = document.getElementById("eqToggleBtn");
const eqResetBtn = document.getElementById("eqResetBtn");
const eqPresetSelect = document.getElementById("eqPresetSelect");
const eqPreamp = document.getElementById("eqPreamp");
const eqBandGroup = document.getElementById("eqBandGroup");

const radioBtn = document.getElementById("radioBtn");
const radio = document.getElementById("radio");
const radioTabSearch = document.getElementById("radioTabSearch");
const radioTabFavorites = document.getElementById("radioTabFavorites");
const radioSearchView = document.getElementById("radioSearchView");
const radioFavoritesView = document.getElementById("radioFavoritesView");
const radioFavCount = document.getElementById("radioFavCount");
const radioCountrySelect = document.getElementById("radioCountrySelect");
const radioStateSelect = document.getElementById("radioStateSelect");
const radioTagSelect = document.getElementById("radioTagSelect");
const radioSearchForm = document.getElementById("radioSearchForm");
const radioSearchInput = document.getElementById("radioSearchInput");
const radioFavoritesList = document.getElementById("radioFavoritesList");
const radioFavoritesFrame = document.getElementById("radioFavoritesFrame");
const radioResultsList = document.getElementById("radioResultsList");
const radioResultsFrame = document.getElementById("radioResultsFrame");
const radioEmpty = document.getElementById("radioEmpty");
const radioFavEmpty = document.getElementById("radioFavEmpty");
const radioResizeHandle = document.getElementById("radioResizeHandle");

let queue = [];
let currentIndex = -1;
let isSeeking = false;
let playlistOpen = false;
let eqOpen = false;
let eqEnabled = true;
let uiScale = 1;
const WINDOW_WIDTH_BASE = 480;

let playbackMode = "local"; // "local" | "radio"
let currentStation = null;
let favoriteStations = [];
let radioResults = [];
let radioOpen = false;
let radioView = "search"; // "search" | "favorites"
let radioCountry = "";
let radioState = "";
let radioTag = "";
let radioFiltersLoaded = false;
let radioReconnectAttempts = 0;
const RADIO_MAX_RECONNECT = 3;
let radioReconnectTimer = null;
// crossOrigin is needed for EQ/viz on radio, but stations without CORS headers
// won't play with it — retry once without it, losing EQ/viz for that station.
let radioCrossOriginFallbackTried = false;

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function trackLabel(name) {
  return name.replace(/\.[^./]+$/, "");
}

function trackDisplayName(track) {
  const { title, artist } = track.tags || {};
  if (title && artist) return `${artist} — ${title}`;
  return title || track.name;
}

const TAG_READ_CONCURRENCY = 4;

async function loadTrackTags(tracks) {
  if (!window.electronAPI?.readTrackTags) return;
  const pending = tracks.filter((track) => track.path);
  async function worker() {
    while (pending.length) {
      const track = pending.shift();
      const tags = await window.electronAPI.readTrackTags(track.path);
      if (!tags) continue;
      track.tags = tags;
      if (track.duration == null) track.duration = tags.duration;
      scheduleTagRender();
    }
  }
  await Promise.all(Array.from({ length: TAG_READ_CONCURRENCY }, worker));
}

let tagRenderQueued = false;

function scheduleTagRender() {
  if (tagRenderQueued) return;
  tagRenderQueued = true;
  requestAnimationFrame(() => {
    tagRenderQueued = false;
    const scrollTop = playlistList.scrollTop;
    renderPlaylist();
    playlistList.scrollTop = scrollTop;
    updateTrackTitleText();
  });
}

let lastObjectUrl = null;

function getTrackSrc(track) {
  if (track.path && window.electronAPI?.getFileUrl) {
    return window.electronAPI.getFileUrl(track.path);
  }
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  lastObjectUrl = URL.createObjectURL(track.file);
  return lastObjectUrl;
}

const EQ_BANDS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
const bandGains = new Array(EQ_BANDS.length).fill(0);
let preampDb = 0;

const EQ_PRESETS = [
  { id: "flat", nameKey: "eqPresetFlat", bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: "classical", nameKey: "eqPresetClassical", bands: [0, 0, 0, 0, 0, 0, -5, -5, -5, -6] },
  { id: "club", nameKey: "eqPresetClub", bands: [0, 0, 2, 3, 3, 3, 2, 0, 0, 0] },
  { id: "dance", nameKey: "eqPresetDance", bands: [6, 4, 1, 0, 0, -4, -5, -5, 0, 0] },
  { id: "full-bass", nameKey: "eqPresetFullBass", bands: [6, 6, 6, 3, 1, -3, -6, -7, -7, -7] },
  { id: "full-bass-treble", nameKey: "eqPresetFullBassTreble", bands: [4, 3, 0, -5, -3, 1, 5, 7, 7, 7] },
  { id: "full-treble", nameKey: "eqPresetFullTreble", bands: [-6, -6, -6, -3, 2, 7, 10, 10, 10, 10] },
  { id: "laptop", nameKey: "eqPresetLaptop", bands: [3, 7, 3, -3, -2, 1, 3, 6, 8, 9] },
  { id: "large-hall", nameKey: "eqPresetLargeHall", bands: [6, 6, 3, 3, 0, -3, -3, -3, 0, 0] },
  { id: "live", nameKey: "eqPresetLive", bands: [-3, 0, 2, 3, 3, 3, 2, 2, 2, 1] },
  { id: "party", nameKey: "eqPresetParty", bands: [4, 4, 0, 0, 0, 0, 0, 0, 4, 4] },
  { id: "pop", nameKey: "eqPresetPop", bands: [-2, 3, 4, 5, 3, -1, -2, -2, -2, -2] },
  { id: "reggae", nameKey: "eqPresetReggae", bands: [0, 0, -1, -4, 0, 4, 4, 0, 0, 0] },
  { id: "rock", nameKey: "eqPresetRock", bands: [5, 3, -4, -5, -3, 2, 5, 7, 7, 7] },
  { id: "ska", nameKey: "eqPresetSka", bands: [-2, -3, -3, -1, 2, 3, 5, 6, 7, 6] },
  { id: "soft", nameKey: "eqPresetSoft", bands: [3, 1, -1, -2, -1, 2, 5, 6, 7, 7] },
  { id: "soft-rock", nameKey: "eqPresetSoftRock", bands: [2, 2, 1, -1, -3, -4, -3, -1, 2, 5] },
  { id: "techno", nameKey: "eqPresetTechno", bands: [5, 3, 0, -4, -3, 0, 5, 6, 6, 5] },
];

const EQ_PRESET_MAX_HEADROOM_DB = 3;

let eqPreset = "flat";
let customEq = { bandGains: new Array(EQ_BANDS.length).fill(0), preampDb: 0 };

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContextClass();
const sourceNode = audioCtx.createMediaElementSource(audio);
const filterNodes = EQ_BANDS.map((freq) => {
  const filter = audioCtx.createBiquadFilter();
  filter.type = "peaking";
  filter.frequency.value = freq;
  filter.Q.value = 1;
  filter.gain.value = 0;
  return filter;
});
const preampNode = audioCtx.createGain();
const analyserNode = audioCtx.createAnalyser();
analyserNode.fftSize = 256;
analyserNode.smoothingTimeConstant = 0;

let audioNode = sourceNode;
filterNodes.forEach((filter) => {
  audioNode.connect(filter);
  audioNode = filter;
});
// Volume sits after the analyser (not audio.volume) so the visualizer ignores it.
const volumeNode = audioCtx.createGain();

audioNode.connect(preampNode);
preampNode.connect(analyserNode);
analyserNode.connect(volumeNode);
volumeNode.connect(audioCtx.destination);

// A splitter's interpretation is fixed to "discrete"; this node upmixes mono so both needles move.
const meterStereoNode = audioCtx.createGain();
meterStereoNode.channelCount = 2;
meterStereoNode.channelCountMode = "explicit";
meterStereoNode.channelInterpretation = "speakers";
const channelSplitter = audioCtx.createChannelSplitter(2);
const meterAnalysers = [audioCtx.createAnalyser(), audioCtx.createAnalyser()];
preampNode.connect(meterStereoNode);
meterStereoNode.connect(channelSplitter);
meterAnalysers.forEach((analyser, channel) => {
  analyser.fftSize = 2048;
  channelSplitter.connect(analyser, channel);
});

function setVolume(percent) {
  volumeNode.gain.setTargetAtTime(percent / 100, audioCtx.currentTime, 0.015);
}

function dbToGain(db) {
  return 10 ** (db / 20);
}

function applyEqState() {
  filterNodes.forEach((filter, i) => {
    filter.gain.value = eqEnabled ? bandGains[i] : 0;
  });
  preampNode.gain.value = eqEnabled ? dbToGain(preampDb) : 1;
}

const VIZ_COLUMNS = 26;
const VIZ_SEGMENTS = 9;
const vizFreqData = new Uint8Array(analyserNode.frequencyBinCount);
const vizSegments = [];

const vizBinMap = Array.from({ length: VIZ_COLUMNS }, (_, i) => {
  const maxBin = vizFreqData.length - 1;
  const t = i / (VIZ_COLUMNS - 1);
  return Math.min(maxBin, Math.round(maxBin ** t));
});

function buildViz() {
  for (let c = 0; c < VIZ_COLUMNS; c++) {
    const col = document.createElement("div");
    col.className = "display__viz-col";
    const segs = [];
    for (let s = 0; s < VIZ_SEGMENTS; s++) {
      const seg = document.createElement("div");
      seg.className = "display__viz-seg";
      col.appendChild(seg);
      segs.push(seg);
    }
    viz.appendChild(col);
    vizSegments.push(segs);
  }
}

const VIZ_MODES = ["spectrum", "meters", "scope"];
let vizMode = "spectrum";

let vizResponse = "smooth";
const SMOOTH_TAU_MS = 65;
const PEAK_RISE_TAU_MS = 5;
const NEEDLE_PEAK_FALL_TAU_MS = 650;
const SPECTRUM_PEAK_FALL_TAU_MS = 300;
const VU_REFERENCE_DBFS = -12;
const VU_SCALE_MARKS = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3];
const VU_MAJOR_MARKS = [-20, -10, -5, 0, 3];

const vizCanvas = document.getElementById("vizCanvas");
const vizCtx = vizCanvas.getContext("2d");
const meterSamples = new Float32Array(meterAnalysers[0].fftSize);
const scopeRight = new Float32Array(meterAnalysers[1].fftSize);
const SCOPE_WINDOW = 512;
const scopeTrace = new Float32Array(SCOPE_WINDOW);
const spectrumLevels = new Float32Array(VIZ_COLUMNS);
const needles = [0, 0];
let lastVizFrame = performance.now();

function setVizMode(mode) {
  vizMode = VIZ_MODES.includes(mode) ? mode : "spectrum";
  viz.hidden = vizMode !== "spectrum";
  vizCanvas.hidden = vizMode === "spectrum";
  persistConfig();
}

[viz, vizCanvas].forEach((el) =>
  el.addEventListener("click", () => {
    setVizMode(VIZ_MODES[(VIZ_MODES.indexOf(vizMode) + 1) % VIZ_MODES.length]);
  })
);

function setVizResponse(value) {
  vizResponse = value === "peak" ? "peak" : "smooth";
  persistConfig();
}

function followLevel(current, target, dt, peakFallTauMs) {
  const tau =
    vizResponse === "peak" ? (target > current ? PEAK_RISE_TAU_MS : peakFallTauMs) : SMOOTH_TAU_MS;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

function needlePosition(dbVu) {
  return Math.min(1.05, 10 ** ((dbVu - 3) / 20));
}

function meterTarget(analyser) {
  analyser.getFloatTimeDomainData(meterSamples);
  if (vizResponse === "peak") {
    let peak = 0;
    for (const sample of meterSamples) peak = Math.max(peak, Math.abs(sample));
    return needlePosition(20 * Math.log10(peak) + 3);
  }
  let sumSquares = 0;
  for (const sample of meterSamples) sumSquares += sample * sample;
  const rms = Math.sqrt(sumSquares / meterSamples.length);
  return needlePosition(20 * Math.log10(rms) - VU_REFERENCE_DBFS);
}

// Custom properties may hold calc()/color-mix() a canvas can't parse — resolve to rgb().
function resolveCssColor(name) {
  vizCanvas.style.color = `var(${name})`;
  return getComputedStyle(vizCanvas).color;
}

let vizColors = null;
let vizColorsReadAt = -Infinity;

function currentVizColors(now) {
  if (!vizColors || now - vizColorsReadAt > 500) {
    vizColors = { fg: resolveCssColor("--lcd-fg"), dim: resolveCssColor("--lcd-fg-dim"), hot: "#e06060" };
    vizColorsReadAt = now;
  }
  return vizColors;
}

function prepareVizCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = vizCanvas.clientWidth;
  const height = vizCanvas.clientHeight;
  if (vizCanvas.width !== Math.round(width * dpr) || vizCanvas.height !== Math.round(height * dpr)) {
    vizCanvas.width = Math.round(width * dpr);
    vizCanvas.height = Math.round(height * dpr);
  }
  vizCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  vizCtx.clearRect(0, 0, width, height);
  return { width, height };
}

function drawMeter(x, width, height, position, label, colors) {
  const halfWidth = width / 2 - 4;
  const drop = height - 9;
  const halfSweep = 2 * Math.atan(drop / halfWidth);
  const radius = halfWidth / Math.sin(halfSweep);
  const cx = x + width / 2;
  const cy = radius + 2;
  const angleAt = (pos) => -Math.PI / 2 + (pos - 0.5) * 2 * halfSweep;

  vizCtx.save();
  vizCtx.beginPath();
  vizCtx.rect(x, 0, width, height);
  vizCtx.clip();

  vizCtx.lineWidth = 1;
  vizCtx.strokeStyle = colors.dim;
  vizCtx.beginPath();
  vizCtx.arc(cx, cy, radius, angleAt(needlePosition(-20)), angleAt(needlePosition(0)));
  vizCtx.stroke();
  vizCtx.strokeStyle = colors.hot;
  vizCtx.beginPath();
  vizCtx.arc(cx, cy, radius, angleAt(needlePosition(0)), angleAt(1));
  vizCtx.stroke();

  for (const db of VU_SCALE_MARKS) {
    const angle = angleAt(needlePosition(db));
    const inner = radius - (VU_MAJOR_MARKS.includes(db) ? 5 : 3);
    vizCtx.strokeStyle = db > 0 ? colors.hot : colors.dim;
    vizCtx.beginPath();
    vizCtx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    vizCtx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    vizCtx.stroke();
  }

  vizCtx.fillStyle = colors.dim;
  vizCtx.font = '7px "DejaVu Sans Mono", monospace';
  vizCtx.fillText(label, x + 2, height - 2);

  const needleAngle = angleAt(Math.min(1.03, position));
  vizCtx.strokeStyle = colors.fg;
  vizCtx.lineWidth = 1.2;
  vizCtx.beginPath();
  vizCtx.moveTo(cx, cy);
  vizCtx.lineTo(cx + Math.cos(needleAngle) * (radius + 2), cy + Math.sin(needleAngle) * (radius + 2));
  vizCtx.stroke();
  vizCtx.restore();
}

function renderMeters(dt, now) {
  meterAnalysers.forEach((analyser, channel) => {
    needles[channel] = followLevel(needles[channel], meterTarget(analyser), dt, NEEDLE_PEAK_FALL_TAU_MS);
  });
  const { width, height } = prepareVizCanvas();
  const colors = currentVizColors(now);
  const gap = 6;
  const meterWidth = (width - gap) / 2;
  drawMeter(0, meterWidth, height, needles[0], "L", colors);
  drawMeter(meterWidth + gap, meterWidth, height, needles[1], "R", colors);
}

function renderScope(dt, now) {
  meterAnalysers[0].getFloatTimeDomainData(meterSamples);
  meterAnalysers[1].getFloatTimeDomainData(scopeRight);
  const mixAt = (i) => (meterSamples[i] + scopeRight[i]) / 2;
  let start = 0;
  for (let i = 1; i < meterSamples.length - SCOPE_WINDOW; i++) {
    if (mixAt(i - 1) < 0 && mixAt(i) >= 0) {
      start = i;
      break;
    }
  }
  const blend = vizResponse === "smooth" ? 1 - Math.exp(-dt / SMOOTH_TAU_MS) : 1;
  for (let i = 0; i < SCOPE_WINDOW; i++) {
    scopeTrace[i] += (mixAt(start + i) - scopeTrace[i]) * blend;
  }

  const { width, height } = prepareVizCanvas();
  vizCtx.strokeStyle = currentVizColors(now).fg;
  vizCtx.lineWidth = 1.2;
  vizCtx.beginPath();
  scopeTrace.forEach((sample, i) => {
    const x = (i / (SCOPE_WINDOW - 1)) * width;
    const y = height / 2 - Math.max(-1, Math.min(1, sample)) * (height / 2 - 1);
    if (i === 0) vizCtx.moveTo(x, y);
    else vizCtx.lineTo(x, y);
  });
  vizCtx.stroke();
}

function renderSpectrum(dt) {
  analyserNode.getByteFrequencyData(vizFreqData);
  for (let c = 0; c < VIZ_COLUMNS; c++) {
    spectrumLevels[c] = followLevel(spectrumLevels[c], vizFreqData[vizBinMap[c]] / 255, dt, SPECTRUM_PEAK_FALL_TAU_MS);
    const lit = Math.round(spectrumLevels[c] * VIZ_SEGMENTS);
    const segs = vizSegments[c];
    for (let s = 0; s < VIZ_SEGMENTS; s++) {
      segs[s].classList.toggle("is-lit", s < lit);
    }
  }
}

function renderViz(now) {
  const dt = Math.min(100, now - lastVizFrame);
  lastVizFrame = now;
  if (vizMode === "meters") renderMeters(dt, now);
  else if (vizMode === "scope") renderScope(dt, now);
  else renderSpectrum(dt);
  requestAnimationFrame(renderViz);
}

function formatBandLabel(freq) {
  return freq >= 1000 ? freq / 1000 + "K" : String(freq);
}

function formatDb(db) {
  return (db > 0 ? "+" : "") + db;
}

function createEqBandControl(label, onChange) {
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

function buildEqPanel() {
  eqPreamp.appendChild(
    createEqBandControl("PRE", (db) => {
      preampDb = db;
      markEqCustom();
      applyEqState();
      persistConfig();
    })
  );

  EQ_BANDS.forEach((freq, i) => {
    eqBandGroup.appendChild(
      createEqBandControl(formatBandLabel(freq), (db) => {
        bandGains[i] = db;
        markEqCustom();
        applyEqState();
        persistConfig();
      })
    );
  });
}

function syncEqControlsFromState() {
  const sliders = eq.querySelectorAll(".eq__slider");
  const values = eq.querySelectorAll(".eq__value");

  if (sliders[0]) sliders[0].value = String(preampDb);
  if (values[0]) values[0].textContent = formatDb(preampDb);

  bandGains.forEach((db, i) => {
    if (sliders[i + 1]) sliders[i + 1].value = String(db);
    if (values[i + 1]) values[i + 1].textContent = formatDb(db);
  });

  eqToggleBtn.textContent = eqEnabled ? window.i18n.t("eqOn") : window.i18n.t("eqOff");
  eqToggleBtn.classList.toggle("is-active", eqEnabled);
}

function resetEq() {
  selectEqPreset("flat");
}

function selectEqPreset(id) {
  const preset = EQ_PRESETS.find((p) => p.id === id);
  const gains = preset ? preset.bands : customEq.bandGains;
  gains.forEach((db, i) => {
    bandGains[i] = db;
  });
  preampDb = preset ? -Math.min(EQ_PRESET_MAX_HEADROOM_DB, Math.max(0, ...preset.bands)) || 0 : customEq.preampDb;
  eqPreset = preset ? preset.id : "custom";
  eqPresetSelect.value = eqPreset;
  syncEqControlsFromState();
  applyEqState();
  persistConfig();
}

function markEqCustom() {
  eqPreset = "custom";
  customEq = { bandGains: [...bandGains], preampDb };
  eqPresetSelect.value = "custom";
}

function buildEqPresetOptions() {
  const options = [{ id: "custom", nameKey: "eqPresetCustom" }, ...EQ_PRESETS].map(({ id, nameKey }) => {
    const option = document.createElement("option");
    option.value = id;
    option.dataset.i18n = nameKey;
    option.textContent = window.i18n.t(nameKey);
    return option;
  });
  eqPresetSelect.append(...options);
  eqPresetSelect.value = eqPreset;
}

eqPresetSelect.addEventListener("change", () => selectEqPreset(eqPresetSelect.value));

function resumeAudioContext() {
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch((err) => logEvent("error", "audio-context", err.message));
  }
}

function playAudio() {
  resumeAudioContext();
  audio.play().catch(() => {});
}

// trackTitle has no data-i18n (applyTranslations would overwrite the track name),
// so its text is always derived here.
function updateTrackTitleText() {
  if (playbackMode === "radio" && currentStation) {
    trackTitle.textContent = currentStation.name;
  } else if (playbackMode === "local" && queue[currentIndex]) {
    trackTitle.textContent = trackDisplayName(queue[currentIndex]);
  } else {
    trackTitle.textContent = window.i18n.t("noTrack");
  }
  updateMediaSessionMetadata();
}

// MediaMetadata artwork rejects file:// URLs, so use a blob: URL.
let appIconArtworkUrl = null;
if ("mediaSession" in navigator) {
  fetch("assets/icon.png")
    .then((r) => r.blob())
    .then((blob) => {
      appIconArtworkUrl = URL.createObjectURL(blob);
      updateMediaSessionMetadata();
    })
    .catch(() => {});
}

function updateMediaSessionMetadata() {
  if (!("mediaSession" in navigator)) return;
  if (playbackMode === "radio" && currentStation) {
    const artSrc = currentStation.favicon || appIconArtworkUrl;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentStation.name,
      artist: [currentStation.country, currentStation.tags].filter(Boolean).join(" · ") || "WaveAMP Radio",
      album: "WaveAMP",
      artwork: artSrc ? [{ src: artSrc, sizes: "any", type: "" }] : [],
    });
  } else if (playbackMode === "local" && queue[currentIndex]) {
    const track = queue[currentIndex];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.tags?.title || track.name,
      artist: track.tags?.artist || "WaveAMP",
      album: track.tags?.album || "",
      artwork: appIconArtworkUrl ? [{ src: appIconArtworkUrl, sizes: "1024x1024", type: "image/png" }] : [],
    });
  } else {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
  }
}

function resetToNoTrackState() {
  if (lastObjectUrl) {
    URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = null;
  }
  playbackMode = "local";
  currentStation = null;
  liveTag.hidden = true;
  durTime.hidden = false;
  durTime.textContent = "00:00";
  seek.disabled = true;
  seek.value = 0;
  updateTrackTitleText();
}

function loadTrack(index, autoplay = true) {
  if (index < 0 || index >= queue.length) return;
  clearTimeout(radioReconnectTimer);
  playbackMode = "local";
  currentStation = null;
  durTime.hidden = false;
  liveTag.hidden = true;
  currentIndex = index;
  const track = queue[index];
  audio.src = getTrackSrc(track);
  updateTrackTitleText();
  seek.disabled = false;
  renderPlaylist();
  renderRadioResults();
  renderRadioFavorites();
  if (autoplay) {
    playAudio();
  }
  persistConfig();
}

function renderPlaylist() {
  playlistList.innerHTML = "";
  playlistEmpty.hidden = queue.length > 0;
  playlistList.hidden = queue.length === 0;

  queue.forEach((track, index) => {
    const item = document.createElement("li");
    item.className = "playlist__item" + (index === currentIndex ? " is-active" : "");

    const idx = document.createElement("span");
    idx.className = "playlist__item-index";
    idx.textContent = String(index + 1);

    const name = document.createElement("span");
    name.className = "playlist__item-name";
    name.textContent = trackDisplayName(track);

    const duration = document.createElement("span");
    duration.className = "playlist__item-duration";
    duration.textContent = track.duration != null ? formatTime(track.duration) : "";

    const remove = document.createElement("button");
    remove.className = "playlist__item-remove";
    remove.type = "button";
    remove.title = window.i18n.t("removeFromPlaylist");
    remove.setAttribute("aria-label", window.i18n.t("removeFromPlaylist"));
    remove.textContent = "✕";
    remove.addEventListener("click", (e) => {
      e.stopPropagation();
      removeTrack(index);
    });

    item.append(idx, name, duration, remove);
    item.addEventListener("click", () => loadTrack(index));
    playlistList.appendChild(item);
  });

  if (playlistOpen) {
    playlist.style.maxHeight = playlist.scrollHeight + "px";
  }
  syncElectronWindowSize();
}

function setPlaylistOpen(open) {
  playlistOpen = open;
  playlist.classList.toggle("is-open", open);
  playlistBtn.classList.toggle("is-active", open);
  playlist.style.maxHeight = open ? playlist.scrollHeight + "px" : "0px";
  if (open && radioOpen) setRadioOpen(false);
  syncElectronWindowSize();
  persistConfig();
}

function setEqOpen(open) {
  eqOpen = open;
  eq.classList.toggle("is-open", open);
  eqBtn.classList.toggle("is-active", open);
  eq.style.maxHeight = open ? eq.scrollHeight + "px" : "0px";
  syncElectronWindowSize();
  persistConfig();
}

function setRadioOpen(open) {
  radioOpen = open;
  radio.classList.toggle("is-open", open);
  radioBtn.classList.toggle("is-active", open);
  radio.style.maxHeight = open ? radio.scrollHeight + "px" : "0px";
  if (open && playlistOpen) setPlaylistOpen(false);
  syncElectronWindowSize();
  if (open && !radioFiltersLoaded) {
    loadRadioFilters();
  }
}

function isFavoriteStation(uuid) {
  return favoriteStations.some((s) => s.stationuuid === uuid);
}

function createStationRow(station) {
  const li = document.createElement("li");
  li.className =
    "radio__item" + (currentStation?.stationuuid === station.stationuuid ? " is-active" : "");

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
  sub.textContent = [station.country, station.tags, station.bitrate ? station.bitrate + "kbps" : ""]
    .filter(Boolean)
    .join(" · ");
  meta.append(name, sub);

  const isFav = isFavoriteStation(station.stationuuid);
  const favBtn = document.createElement("button");
  favBtn.className = "radio__fav-btn" + (isFav ? " is-fav" : "");
  favBtn.type = "button";
  favBtn.textContent = isFav ? "★" : "☆";
  favBtn.title = isFav ? window.i18n.t("removeFavorite") : window.i18n.t("addFavorite");
  favBtn.setAttribute("aria-label", favBtn.title);
  favBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavoriteStation(station);
  });

  li.append(favicon, meta, favBtn);
  li.addEventListener("click", () => tuneStation(station));
  return li;
}

function setRadioView(view) {
  radioView = view;
  radioTabSearch.classList.toggle("is-active", view === "search");
  radioTabSearch.setAttribute("aria-pressed", String(view === "search"));
  radioTabFavorites.classList.toggle("is-active", view === "favorites");
  radioTabFavorites.setAttribute("aria-pressed", String(view === "favorites"));
  radioSearchView.hidden = view !== "search";
  radioFavoritesView.hidden = view !== "favorites";
  if (radioOpen) radio.style.maxHeight = radio.scrollHeight + "px";
  syncElectronWindowSize();
}

function renderRadioResults() {
  radioResultsList.innerHTML = "";
  radioResults.forEach((s) => radioResultsList.appendChild(createStationRow(s)));
  radioResultsList.hidden = radioResults.length === 0;
  if (radioOpen && radioView === "search") radio.style.maxHeight = radio.scrollHeight + "px";
  syncElectronWindowSize();
}

function renderRadioFavorites() {
  radioFavoritesList.innerHTML = "";
  favoriteStations.forEach((s) => radioFavoritesList.appendChild(createStationRow(s)));
  radioFavoritesList.hidden = favoriteStations.length === 0;
  radioFavEmpty.hidden = favoriteStations.length > 0;
  radioFavCount.hidden = favoriteStations.length === 0;
  radioFavCount.textContent = String(favoriteStations.length);
  if (radioOpen && radioView === "favorites") radio.style.maxHeight = radio.scrollHeight + "px";
  syncElectronWindowSize();
}

function toggleFavoriteStation(station) {
  const idx = favoriteStations.findIndex((s) => s.stationuuid === station.stationuuid);
  if (idx >= 0) {
    favoriteStations.splice(idx, 1);
  } else {
    favoriteStations.push(station);
  }
  renderRadioFavorites();
  renderRadioResults();
  persistConfig();
}

function cycleFavorite(direction) {
  if (favoriteStations.length === 0) return;
  const idx = favoriteStations.findIndex((s) => s.stationuuid === currentStation?.stationuuid);
  const nextIdx = idx === -1 ? 0 : (idx + direction + favoriteStations.length) % favoriteStations.length;
  tuneStation(favoriteStations[nextIdx]);
}

function tuneStation(station) {
  clearTimeout(radioReconnectTimer);
  playbackMode = "radio";
  currentStation = station;
  radioReconnectAttempts = 0;
  radioCrossOriginFallbackTried = false;
  audio.crossOrigin = "anonymous";

  updateTrackTitleText();
  seek.disabled = true;
  seek.value = 0;
  timeDisplay.textContent = "--:--";
  durTime.hidden = true;
  liveTag.hidden = false;

  renderRadioResults();
  renderRadioFavorites();

  audio.src = station.url;
  playAudio();

  if (window.electronAPI?.registerStationClick) {
    window.electronAPI.registerStationClick(station.stationuuid).catch(() => {});
  }

  persistConfig();
}

function renderTagOptions(tags) {
  radioTagSelect.innerHTML = `<option value="" data-i18n="tagAny">${window.i18n.t("tagAny")}</option>`;
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

async function refreshRadioTags() {
  if (!window.electronAPI?.loadTagsForFilter) return;
  try {
    const tags = await window.electronAPI.loadTagsForFilter(radioCountry, radioState);
    renderTagOptions(tags);
  } catch (err) {
    console.error("Failed to load radio tags:", err);
    logEvent("error", "radio", `Failed to load tags: ${err.message}`);
  }
}

let radioFiltersLoading = false;

async function loadRadioFilters() {
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
    logEvent("error", "radio", `Failed to load filters: ${err.message}`);
  } finally {
    radioFiltersLoading = false;
  }
}

// Holds the country name, not the ISO code (see fetchStates() in main.js).
let radioStatesToken = 0;

async function loadRadioStates(countryName) {
  const token = ++radioStatesToken;
  radioStateSelect.innerHTML = `<option value="" data-i18n="stateAny">${window.i18n.t("stateAny")}</option>`;
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
    if (radioOpen) {
      radio.style.maxHeight = radio.scrollHeight + "px";
      syncElectronWindowSize();
    }
  } catch (err) {
    console.error("Failed to load radio states:", err);
    logEvent("error", "radio", `Failed to load states for "${countryName}": ${err.message}`);
  }
}

let radioEmptyKey = "enterNameOrFilter";

function setRadioEmptyText(key) {
  radioEmptyKey = key;
  radioEmpty.textContent = window.i18n.t(key);
}

let radioSearchToken = 0;

async function runRadioSearch() {
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
    radioResults = results;
    renderRadioResults();
    radioEmpty.hidden = radioResults.length > 0;
    setRadioEmptyText("nothingFound");
  } catch (err) {
    if (token !== radioSearchToken) return;
    radioResults = [];
    renderRadioResults();
    radioEmpty.hidden = false;
    setRadioEmptyText("loadFailed");
    logEvent("error", "radio", `Search failed: ${err.message}`);
  }
}

function removeTrack(index) {
  const removingCurrent = playbackMode === "local" && index === currentIndex;
  queue.splice(index, 1);

  if (queue.length === 0) {
    currentIndex = -1;
    if (playbackMode === "local") {
      stop();
      audio.removeAttribute("src");
      audio.load();
      resetToNoTrackState();
    }
    renderPlaylist();
    persistConfig();
    return;
  }

  if (removingCurrent) {
    loadTrack(Math.min(index, queue.length - 1));
    return;
  }

  if (playbackMode === "local" && index < currentIndex) {
    currentIndex -= 1;
  }
  renderPlaylist();
  persistConfig();
}

function clearPlaylist() {
  queue = [];
  currentIndex = -1;
  if (playbackMode === "local") {
    stop();
    audio.removeAttribute("src");
    audio.load();
    resetToNoTrackState();
  }
  renderPlaylist();
  persistConfig();
}

function syncElectronWindowSize(instant = false) {
  if (!window.electronAPI) return;
  let target = BASE_PLAYER_HEIGHT;
  if (playlistOpen) target += playlist.scrollHeight;
  if (eqOpen) target += eq.scrollHeight;
  if (radioOpen) target += radio.scrollHeight;
  target *= uiScale;
  const targetWidth = WINDOW_WIDTH_BASE * uiScale;
  if (instant && window.electronAPI.resizeWindowInstant) {
    window.electronAPI.resizeWindowInstant(target, targetWidth);
  } else {
    window.electronAPI.resizeWindow(target, targetWidth);
  }
}

// file.type is empty for some formats on some systems — fall back to the extension.
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|oga|flac|m4a|aac|wma|ape|opus|weba|mid|midi)$/i;

function addFiles(fileList) {
  const files = Array.from(fileList).filter(
    (f) => f.type.startsWith("audio/") || (!f.type && AUDIO_EXT_RE.test(f.name))
  );
  if (files.length === 0) return;
  const wasEmpty = queue.length === 0;
  const tracks = files.map((file) => {
    const path = window.electronAPI?.getFilePath ? window.electronAPI.getFilePath(file) : null;
    if (window.electronAPI?.getFilePath && !path) {
      logEvent("warn", "playlist", `Could not resolve a file path for "${file.name}"`);
    }
    return { name: trackLabel(file.name), file, path };
  });
  queue.push(...tracks);
  renderPlaylist();
  if (wasEmpty) {
    loadTrack(0);
  }
  persistConfig();
  loadTrackTags(tracks);
}

function playPause() {
  if (playbackMode === "local" && queue.length === 0) {
    fileInput.click();
    return;
  }
  if (audio.paused) {
    playAudio();
  } else {
    audio.pause();
  }
}

function stop() {
  audio.pause();
  if (playbackMode === "local") {
    audio.currentTime = 0;
  }
}

function playNext() {
  if (playbackMode === "radio") {
    cycleFavorite(1);
    return;
  }
  if (currentIndex + 1 < queue.length) {
    loadTrack(currentIndex + 1);
  } else {
    stop();
  }
}

function playPrev() {
  if (playbackMode === "radio") {
    cycleFavorite(-1);
    return;
  }
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (currentIndex - 1 >= 0) {
    loadTrack(currentIndex - 1);
  } else {
    audio.currentTime = 0;
  }
}

playBtn.addEventListener("click", playAudio);
pauseBtn.addEventListener("click", () => audio.pause());
stopBtn.addEventListener("click", stop);
prevBtn.addEventListener("click", playPrev);
nextBtn.addEventListener("click", playNext);
function createDropdown(btn, menu, wrap) {
  function setOpen(open) {
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.classList.toggle("is-active", open);
  }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(menu.hidden);
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !wrap.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) setOpen(false);
  });
  return setOpen;
}

const setAddMenuOpen = createDropdown(playlistAddBtn, playlistAddMenu, playlistAddWrap);

settingsBtn.addEventListener("click", () => {
  window.electronAPI?.openSettingsWindow?.();
});

function logEvent(level, scope, message) {
  window.electronAPI?.log?.(level, scope, message);
}

let proxyEnabled = false;
let proxyType = "http";
let proxyHost = "";
let proxyPort = "";
let proxyUsername = "";
let proxyPassword = "";

function getProxyConfig() {
  return {
    enabled: proxyEnabled,
    type: proxyType,
    host: proxyHost,
    port: proxyPort,
    username: proxyUsername,
    password: proxyPassword,
  };
}

function syncProxyConfig() {
  window.electronAPI?.applyProxyConfig?.(getProxyConfig());
  persistConfig();
  // A playing stream may not error on a proxy change — reconnect it now.
  if (playbackMode === "radio" && currentStation) {
    tuneStation(currentStation);
  }
}

function setProxyEnabled(enabled) {
  proxyEnabled = enabled;
  syncProxyConfig();
}

let loggingEnabled = false;

function setLoggingEnabled(enabled) {
  loggingEnabled = enabled;
  window.electronAPI?.setLoggingEnabled?.(enabled);
  persistConfig();
}

let autoUpdateEnabled = true;

function setAutoUpdateEnabled(enabled) {
  autoUpdateEnabled = enabled;
  window.electronAPI?.setAutoUpdateEnabled?.(enabled);
  persistConfig();
}

let trayIconEnabled = false;
let closeMinimizesToTrayEnabled = false;

function setCloseMinimizesToTrayEnabled(enabled) {
  closeMinimizesToTrayEnabled = enabled;
  window.electronAPI?.setCloseMinimizesToTray?.(enabled);
  persistConfig();
}

function setTrayIconEnabled(enabled) {
  trayIconEnabled = enabled;
  if (!enabled && closeMinimizesToTrayEnabled) setCloseMinimizesToTrayEnabled(false);
  window.electronAPI?.setTrayIconEnabled?.(enabled);
  persistConfig();
}

function setLanguage(lang) {
  window.i18n.setLanguage(lang);
  updateTrackTitleText();
  setRadioEmptyText(radioEmptyKey);
  renderPlaylist();
  renderRadioResults();
  renderRadioFavorites();
  persistConfig();
}

const BASE_ZOOM = 0.95;

function setScale(percent) {
  uiScale = (percent / 100) * BASE_ZOOM;
  if (window.electronAPI?.setZoomFactor) {
    window.electronAPI.setZoomFactor(uiScale);
  } else {
    player.style.zoom = String(uiScale);
  }
  syncElectronWindowSize();
  persistConfig();
}

let accentColor = { ...window.accentColor.DEFAULT };

function setAccentColor(color) {
  accentColor = window.accentColor.normalize(color);
  window.accentColor.apply(accentColor);
  persistConfig();
}

window.electronAPI?.onSettingsAction?.((action) => {
  switch (action.type) {
    case "setLanguage":
      setLanguage(action.value);
      break;
    case "setScale":
      setScale(action.value);
      break;
    case "setAccentColor":
      setAccentColor(action.value);
      break;
    case "setVizResponse":
      setVizResponse(action.value);
      break;
    case "setHotkeys":
      setHotkeys(action.value);
      return;
    case "setProxyConfig":
      proxyType = action.value.type === "socks5" ? "socks5" : "http";
      proxyHost = action.value.host || "";
      proxyPort = action.value.port || "";
      proxyUsername = action.value.username || "";
      proxyPassword = action.value.password || "";
      setProxyEnabled(!!action.value.enabled);
      break;
    case "setLoggingEnabled":
      setLoggingEnabled(!!action.value);
      break;
    case "setAutoUpdateEnabled":
      setAutoUpdateEnabled(!!action.value);
      break;
    case "setTrayIconEnabled":
      setTrayIconEnabled(!!action.value);
      break;
    case "setCloseMinimizesToTrayEnabled":
      setCloseMinimizesToTrayEnabled(!!action.value);
      break;
    default:
      return;
  }
  pushSettingsState();
});

window.electronAPI?.onSettingsStateRequested?.(() => pushSettingsState());

function pushSettingsState() {
  window.electronAPI?.pushSettingsState?.({
    lang: window.i18n.getLanguage(),
    scale: Math.round((uiScale / BASE_ZOOM) * 100),
    accentColor,
    vizResponse,
    hotkeys: hotkeyConfig,
    globalHotkeyFailures,
    proxy: getProxyConfig(),
    loggingEnabled,
    autoUpdateEnabled,
    showTrayIcon: trayIconEnabled,
    closeMinimizesToTray: closeMinimizesToTrayEnabled,
  });
}

addFilesMenuItem.addEventListener("click", () => {
  setAddMenuOpen(false);
  fileInput.click();
});

addFolderMenuItem.addEventListener("click", () => {
  setAddMenuOpen(false);
  folderInput.click();
});

playlistClearBtn.addEventListener("click", () => {
  setAddMenuOpen(false);
  clearPlaylist();
});

playlistBtn.addEventListener("click", () => {
  setPlaylistOpen(!playlistOpen);
});

const LIST_MIN_HEIGHT = 60;
const LIST_MAX_HEIGHT = 1920;
const RADIO_CHROME_OFFSET =
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--radio-chrome-offset")) || 72;

function activeRadioFrame() {
  return radioView === "favorites" ? radioFavoritesFrame : radioResultsFrame;
}

function applyListHeight(px) {
  const searchPx = Math.max(LIST_MIN_HEIGHT, px - RADIO_CHROME_OFFSET);
  playlistListFrame.style.height = px + "px";
  radioResultsFrame.style.height = searchPx + "px";
  radioFavoritesFrame.style.height = px + "px";
  if (playlistOpen) playlist.style.maxHeight = playlist.scrollHeight + "px";
  if (radioOpen) radio.style.maxHeight = radio.scrollHeight + "px";
}

let resizingList = false;
let resizeStartY = 0;
let resizeStartHeight = 0;

function startListResize(e, handle, section, startHeight) {
  resizingList = true;
  resizeStartY = e.clientY;
  resizeStartHeight = startHeight;
  handle.classList.add("is-active");
  section.classList.add("is-resizing");
  document.body.style.cursor = "ns-resize";
  e.preventDefault();
}

// Only the plain-web CSS zoom reports post-zoom sizes; Electron's native zoom doesn't.
function cssZoomFactor() {
  return window.electronAPI?.setZoomFactor ? 1 : uiScale;
}

playlistResizeHandle.addEventListener("mousedown", (e) => {
  const playlistHeight = playlistListFrame.getBoundingClientRect().height / cssZoomFactor();
  startListResize(e, playlistResizeHandle, playlist, playlistHeight);
});

radioResizeHandle.addEventListener("mousedown", (e) => {
  const radioHeight = activeRadioFrame().getBoundingClientRect().height / cssZoomFactor();
  const canonicalHeight = radioView === "favorites" ? radioHeight : radioHeight + RADIO_CHROME_OFFSET;
  startListResize(e, radioResizeHandle, radio, canonicalHeight);
});

window.addEventListener("mousemove", (e) => {
  if (!resizingList) return;
  const delta = (e.clientY - resizeStartY) / cssZoomFactor();
  const newHeight = Math.min(
    LIST_MAX_HEIGHT,
    Math.max(LIST_MIN_HEIGHT, resizeStartHeight + delta)
  );
  applyListHeight(newHeight);
  syncElectronWindowSize(true);
});

window.addEventListener("mouseup", () => {
  if (!resizingList) return;
  resizingList = false;
  playlistResizeHandle.classList.remove("is-active");
  radioResizeHandle.classList.remove("is-active");
  playlist.classList.remove("is-resizing");
  radio.classList.remove("is-resizing");
  document.body.style.cursor = "";
});

eqBtn.addEventListener("click", () => {
  setEqOpen(!eqOpen);
});

eqToggleBtn.addEventListener("click", () => {
  eqEnabled = !eqEnabled;
  eqToggleBtn.textContent = eqEnabled ? window.i18n.t("eqOn") : window.i18n.t("eqOff");
  eqToggleBtn.classList.toggle("is-active", eqEnabled);
  applyEqState();
  persistConfig();
});

eqResetBtn.addEventListener("click", resetEq);

radioBtn.addEventListener("click", () => {
  setRadioOpen(!radioOpen);
});

radioTabSearch.addEventListener("click", () => setRadioView("search"));
radioTabFavorites.addEventListener("click", () => setRadioView("favorites"));

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

fileInput.addEventListener("change", (e) => {
  addFiles(e.target.files);
  fileInput.value = "";
});

folderInput.addEventListener("change", (e) => {
  addFiles(e.target.files);
  folderInput.value = "";
});

audio.addEventListener("timeupdate", () => {
  if (isSeeking || playbackMode === "radio") return;
  timeDisplay.textContent = formatTime(audio.currentTime);
  if (audio.duration) {
    seek.value = String(Math.floor((audio.currentTime / audio.duration) * 1000));
  }
});

audio.addEventListener("loadedmetadata", () => {
  if (playbackMode === "radio") return;
  durTime.textContent = formatTime(audio.duration);
  const track = queue[currentIndex];
  if (track && track.duration == null && isFinite(audio.duration)) {
    track.duration = audio.duration;
    scheduleTagRender();
  }
});

audio.addEventListener("ended", playNext);

audio.addEventListener("playing", () => {
  if (playbackMode !== "radio") return;
  radioReconnectAttempts = 0;
  updateTrackTitleText();
});

function registerMediaSessionActionHandlers() {
  navigator.mediaSession.setActionHandler("play", () => playAudio());
  navigator.mediaSession.setActionHandler("pause", () => audio.pause());
  navigator.mediaSession.setActionHandler("stop", () => stop());
  navigator.mediaSession.setActionHandler("previoustrack", () => playPrev());
  navigator.mediaSession.setActionHandler("nexttrack", () => playNext());
}

if ("mediaSession" in navigator) {
  audio.addEventListener("play", () => {
    navigator.mediaSession.playbackState = "playing";
  });
  audio.addEventListener("pause", () => {
    navigator.mediaSession.playbackState = "paused";
  });

  // A failed station can make Chromium drop the OS media-key registration;
  // re-set the handlers on every "playing".
  audio.addEventListener("playing", registerMediaSessionActionHandlers);
  registerMediaSessionActionHandlers();
}

window.electronAPI?.onMediaKey?.((action) => {
  if (action === "playpause") playPause();
  else if (action === "next") playNext();
  else if (action === "previous") playPrev();
  else if (action === "stop") stop();
});

function attemptRadioReconnect() {
  if (!currentStation) return;
  clearTimeout(radioReconnectTimer);
  const errorInfo = audio.error ? `code ${audio.error.code}: ${audio.error.message}` : "unknown error";

  // A missing-CORS failure looks like a network error — retry once without crossOrigin.
  if (!radioCrossOriginFallbackTried) {
    radioCrossOriginFallbackTried = true;
    logEvent("info", "radio", `"${currentStation.name}" failed with CORS (${errorInfo}), retrying without it`);
    audio.removeAttribute("crossorigin");
    audio.src = currentStation.url;
    playAudio();
    return;
  }

  if (radioReconnectAttempts >= RADIO_MAX_RECONNECT) {
    logEvent("error", "radio", `"${currentStation.name}" giving up after ${RADIO_MAX_RECONNECT} attempts (${errorInfo})`);
    trackTitle.textContent = currentStation.name + window.i18n.t("noConnection");
    return;
  }
  radioReconnectAttempts += 1;
  logEvent(
    "warn",
    "radio",
    `"${currentStation.name}" reconnect attempt ${radioReconnectAttempts}/${RADIO_MAX_RECONNECT} (${errorInfo})`
  );
  trackTitle.textContent = currentStation.name + window.i18n.t("reconnecting");
  radioReconnectTimer = setTimeout(() => {
    if (playbackMode === "radio" && currentStation) {
      audio.src = currentStation.url;
      playAudio();
    }
  }, 1500);
}

audio.addEventListener("error", () => {
  if (playbackMode === "radio") {
    attemptRadioReconnect();
  } else if (audio.error) {
    logEvent("error", "audio", `Local playback error (code ${audio.error.code}): ${audio.error.message}`);
  }
});

// Not "stalled": it fires routinely while healthy streams buffer.

seek.addEventListener("input", () => {
  isSeeking = true;
  if (audio.duration) {
    const t = (Number(seek.value) / 1000) * audio.duration;
    timeDisplay.textContent = formatTime(t);
  }
});

seek.addEventListener("change", () => {
  if (audio.duration) {
    audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
  }
  isSeeking = false;
});

volume.addEventListener("input", () => {
  setVolume(Number(volume.value));
  persistConfig();
});
setVolume(Number(volume.value));

["dragenter", "dragover"].forEach((evt) => {
  player.addEventListener(evt, (e) => {
    e.preventDefault();
    player.classList.add("is-dragover");
  });
});

["dragleave", "drop"].forEach((evt) => {
  player.addEventListener(evt, (e) => {
    e.preventDefault();
    if (evt === "dragleave" && e.target !== player) return;
    player.classList.remove("is-dragover");
  });
});

player.addEventListener("drop", (e) => {
  if (e.dataTransfer?.files?.length) {
    addFiles(e.dataTransfer.files);
  }
});

if (window.electronAPI) {
  document.body.classList.add("is-electron");
  const windowControls = document.getElementById("windowControls");
  windowControls.hidden = false;
  document.getElementById("minimizeBtn").addEventListener("click", () => {
    window.electronAPI.minimizeWindow();
  });
  document.getElementById("closeBtn").addEventListener("click", () => {
    window.electronAPI.closeWindow();
  });
}

const CONFIG_VERSION = 1;
let persistTimer = null;

function persistConfig() {
  if (!window.electronAPI?.saveConfig) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    window.electronAPI.saveConfig({
      version: CONFIG_VERSION,
      playlist: {
        tracks: queue
          .filter((track) => track.path)
          .map((track) => ({ name: track.name, path: track.path })),
        currentIndex,
      },
      eq: {
        bandGains: [...bandGains],
        preampDb,
        enabled: eqEnabled,
        preset: eqPreset,
        custom: customEq,
      },
      radio: {
        favorites: favoriteStations,
      },
      settings: {
        lang: window.i18n.getLanguage(),
        scale: Math.round((uiScale / BASE_ZOOM) * 100),
        accentColor,
        vizResponse,
        hotkeys: hotkeyConfig,
        volume: Number(volume.value),
        loggingEnabled,
        proxy: getProxyConfig(),
        autoUpdateEnabled,
        showTrayIcon: trayIconEnabled,
        closeMinimizesToTray: closeMinimizesToTrayEnabled,
      },
      ui: {
        playlistOpen,
        eqOpen,
        radioOpen,
        vizMode,
      },
    });
  }, 300);
}

async function restoreConfig() {
  if (!window.electronAPI?.loadConfig) return;
  const config = await window.electronAPI.loadConfig();
  if (!config) return;

  if (config.settings?.lang === "ru" || config.settings?.lang === "en") {
    setLanguage(config.settings.lang);
  }

  const validScales = [75, 100, 125, 150];
  if (validScales.includes(config.settings?.scale)) {
    setScale(config.settings.scale);
  }

  if (config.settings?.accentColor) {
    setAccentColor(config.settings.accentColor);
  }

  if (config.settings?.vizResponse) {
    setVizResponse(config.settings.vizResponse);
  }

  hotkeyConfig = window.hotkeys.normalize(config.settings?.hotkeys);
  applyGlobalHotkeys();

  if (typeof config.settings?.volume === "number" && config.settings.volume >= 0 && config.settings.volume <= 100) {
    volume.value = String(config.settings.volume);
    setVolume(config.settings.volume);
  }

  if (typeof config.settings?.loggingEnabled === "boolean") {
    setLoggingEnabled(config.settings.loggingEnabled);
  }

  const proxy = config.settings?.proxy;
  if (proxy && typeof proxy === "object") {
    proxyType = proxy.type === "socks5" ? "socks5" : "http";
    proxyHost = proxy.host || "";
    proxyPort = proxy.port || "";
    proxyUsername = proxy.username || "";
    proxyPassword = proxy.password || "";
    setProxyEnabled(!!proxy.enabled);
  }

  if (typeof config.settings?.autoUpdateEnabled === "boolean") {
    setAutoUpdateEnabled(config.settings.autoUpdateEnabled);
  }

  if (typeof config.settings?.showTrayIcon === "boolean") {
    setTrayIconEnabled(config.settings.showTrayIcon);
  }

  if (trayIconEnabled && typeof config.settings?.closeMinimizesToTray === "boolean") {
    setCloseMinimizesToTrayEnabled(config.settings.closeMinimizesToTray);
  }

  if (config.eq) {
    if (Array.isArray(config.eq.bandGains)) {
      config.eq.bandGains.forEach((db, i) => {
        if (i < bandGains.length && typeof db === "number") bandGains[i] = db;
      });
    }
    if (typeof config.eq.preampDb === "number") preampDb = config.eq.preampDb;
    if (typeof config.eq.enabled === "boolean") eqEnabled = config.eq.enabled;
    const custom = config.eq.custom;
    if (Array.isArray(custom?.bandGains) && typeof custom.preampDb === "number") {
      customEq = {
        bandGains: EQ_BANDS.map((_, i) => (typeof custom.bandGains[i] === "number" ? custom.bandGains[i] : 0)),
        preampDb: custom.preampDb,
      };
    } else {
      customEq = { bandGains: [...bandGains], preampDb };
    }
    eqPreset = EQ_PRESETS.some((p) => p.id === config.eq.preset) ? config.eq.preset : "custom";
    eqPresetSelect.value = eqPreset;
    syncEqControlsFromState();
    applyEqState();
  }

  if (Array.isArray(config.radio?.favorites)) {
    favoriteStations = config.radio.favorites.filter((s) => s && s.stationuuid && s.url);
    renderRadioFavorites();
  }

  if (config.playlist?.tracks?.length) {
    queue = config.playlist.tracks
      .filter((t) => t && t.path)
      .map((t) => ({ name: t.name || trackLabel(t.path.split("/").pop()), path: t.path, file: null }));
    renderPlaylist();

    const idx = config.playlist.currentIndex;
    if (typeof idx === "number" && idx >= 0 && idx < queue.length) {
      loadTrack(idx, false);
    }
    loadTrackTags(queue);
  }

  if (config.ui?.vizMode) setVizMode(config.ui.vizMode);
  if (config.ui?.eqOpen) setEqOpen(true);
  if (config.ui?.playlistOpen) setPlaylistOpen(true);
  if (config.ui?.radioOpen) setRadioOpen(true);
}

buildEqPanel();
buildEqPresetOptions();
buildViz();
requestAnimationFrame(renderViz);

const BASE_PLAYER_HEIGHT = player.offsetHeight;

window.i18n.applyTranslations();
setScale(100);
updateTrackTitleText();
setRadioEmptyText(radioEmptyKey);

renderPlaylist();
restoreConfig();

let hotkeyConfig = window.hotkeys.defaults();
let globalHotkeyFailures = [];
let volumeBeforeMute = null;
const SEEK_STEP_SECONDS = 5;
const VOLUME_STEP = 5;
const REPEATABLE_HOTKEYS = new Set(["seekForward", "seekBackward", "volumeUp", "volumeDown"]);

function changeVolumeBy(delta) {
  const value = Math.max(0, Math.min(100, Number(volume.value) + delta));
  volume.value = String(value);
  setVolume(value);
  persistConfig();
}

function runHotkeyAction(action) {
  switch (action) {
    case "playPause":
      playPause();
      break;
    case "play":
      if (audio.paused && audio.src) playAudio();
      break;
    case "pause":
      audio.pause();
      break;
    case "stop":
      stop();
      break;
    case "next":
      playNext();
      break;
    case "previous":
      playPrev();
      break;
    case "seekForward":
    case "seekBackward":
      if (playbackMode === "local" && isFinite(audio.duration)) {
        const delta = action === "seekForward" ? SEEK_STEP_SECONDS : -SEEK_STEP_SECONDS;
        audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + delta));
      }
      break;
    case "volumeUp":
      changeVolumeBy(VOLUME_STEP);
      break;
    case "volumeDown":
      changeVolumeBy(-VOLUME_STEP);
      break;
    case "mute":
      if (Number(volume.value) > 0) {
        volumeBeforeMute = Number(volume.value);
        changeVolumeBy(-volumeBeforeMute);
      } else {
        changeVolumeBy(volumeBeforeMute || 50);
        volumeBeforeMute = null;
      }
      break;
    case "toggleEq":
      setEqOpen(!eqOpen);
      break;
    case "togglePlaylist":
      setPlaylistOpen(!playlistOpen);
      break;
    case "toggleRadio":
      setRadioOpen(!radioOpen);
      break;
    case "openSettings":
      window.electronAPI?.openSettingsWindow?.();
      break;
    case "addFiles":
      fileInput.click();
      break;
    case "addFolder":
      folderInput.click();
      break;
    case "cycleVisualizer":
      setVizMode(VIZ_MODES[(VIZ_MODES.indexOf(vizMode) + 1) % VIZ_MODES.length]);
      break;
  }
}

document.addEventListener("keydown", (e) => {
  const target = e.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  ) {
    return;
  }
  const combo = window.hotkeys.comboFromEvent(e);
  if (!combo) return;
  // Focused buttons handle Space/Enter natively.
  if (target instanceof HTMLButtonElement && (combo === "Space" || combo === "Enter")) return;
  const action = Object.keys(hotkeyConfig.local).find((id) => hotkeyConfig.local[id] === combo);
  if (!action) return;
  e.preventDefault();
  if (e.repeat && !REPEATABLE_HOTKEYS.has(action)) return;
  runHotkeyAction(action);
});

player.addEventListener("mousedown", (e) => {
  if (e.target.closest("button")) e.preventDefault();
});

window.electronAPI?.onHotkey?.((action) => runHotkeyAction(action));

async function applyGlobalHotkeys() {
  if (!window.electronAPI?.setGlobalHotkeys) return;
  globalHotkeyFailures = await window.electronAPI.setGlobalHotkeys({
    enabled: hotkeyConfig.globalEnabled,
    bindings: hotkeyConfig.global,
  });
  pushSettingsState();
}

function setHotkeys(config) {
  hotkeyConfig = window.hotkeys.normalize(config);
  persistConfig();
  applyGlobalHotkeys();
}

window.addEventListener("error", (e) => {
  logEvent("error", "window", `${e.message} (${e.filename}:${e.lineno})`);
});

window.addEventListener("unhandledrejection", (e) => {
  logEvent("error", "promise", String(e.reason));
});
