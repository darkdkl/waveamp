import { i18n } from "../i18n";
import {
  audio,
  chordsAnalyzeBtn,
  chordsBtn,
  chordsCapoSelect,
  chordsCloseBtn,
  chordsKey,
  chordsMessage,
  chordsMessageText,
  chordsNext,
  chordsNow,
  chordsPopoutBtn,
  chordsPrev,
  chordsResult,
  chordsSection,
  chordsSimplifyBtn,
} from "./dom";
import { state, type Track } from "./state";
import { persistConfig } from "./config";
import { showSection, syncElectronWindowSize } from "./layout";
import { popOutChords, returnChords } from "./separateWindows";
import { trackPosition } from "./trackTime";
import { renderSwitch } from "../switchControl";
import { chordDiagramSvg } from "./chordDiagram";
import { chordShape } from "../../shared/chordShapes";
import {
  ANALYSIS_SAMPLE_RATE,
  analyzeChordsInSteps,
  MAX_ANALYSIS_SECONDS,
  capoShape,
  chordName,
  eventAt,
  noteName,
  simplifyChord,
  usesFlats,
  type Chord,
  type ChordAnalysis,
} from "../../shared/chords";

const CAPO_MAX = 7;
const SCROLL_MS = 260;
const SCROLL_SHIFT = 18;

type Status = "idle" | "analyzing" | "done" | "tooLong" | "tooLarge" | "failed";

const cache = new Map<string, ChordAnalysis>();
let status: Status = "idle";
let analysis: ChordAnalysis | null = null;
let currentKey: string | null = null;
let shownIndex = -1;
let frame = 0;
let progress: number | null = null;
let decodedFile: { path: string; samples: Float32Array } | null = null;

function localTrack(): Track | null {
  if (state.playbackMode !== "local") return null;
  return state.queue[state.currentIndex] ?? null;
}

function trackKey(track: Track): string | null {
  return track.path ? `${track.path}|${track.start ?? 0}|${track.end ?? ""}` : null;
}

function displayedChord(chord: Chord): Chord {
  return capoShape(state.chordsSimplify ? simplifyChord(chord) : chord, state.chordsCapo);
}

function flats(): boolean {
  return analysis ? usesFlats(analysis.key) : false;
}

function chordMarkup(chord: Chord | null): string {
  if (!chord) return `<span class="chords__name">—</span>`;
  const shown = displayedChord(chord);
  return `${chordDiagramSvg(chordShape(shown))}<span class="chords__name">${chordName(shown, flats())}</span>`;
}

function showMessage(text: string, analyzable: boolean): void {
  chordsResult.hidden = true;
  chordsMessage.hidden = false;
  chordsMessageText.textContent = text;
  chordsAnalyzeBtn.hidden = !analyzable;
  chordsAnalyzeBtn.disabled = status === "analyzing";
}

function nearChordIndex(index: number, step: 1 | -1): number {
  const events = analysis?.events ?? [];
  for (let i = index + step; i >= 0 && i < events.length; i += step) if (events[i].chord) return i;
  return -1;
}

function scrollTape(): void {
  for (const slot of [chordsPrev, chordsNow, chordsNext]) {
    slot.animate([{ transform: `translateX(${SCROLL_SHIFT}px)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: SCROLL_MS, easing: "ease-out" });
  }
}

function visible(): boolean {
  return state.chordsOpen;
}

function updatePosition(force = false): void {
  if (!analysis || status !== "done") return;
  const events = analysis.events;
  const index = eventAt(events, trackPosition());
  if (index === shownIndex && !force) return;
  const forward = !force && shownIndex >= 0 && index > shownIndex;
  shownIndex = index;
  const prev = nearChordIndex(index, -1);
  const next = nearChordIndex(index, 1);
  chordsPrev.innerHTML = prev >= 0 ? chordMarkup(events[prev].chord) : "";
  chordsNow.innerHTML = chordMarkup(events[index]?.chord ?? null);
  chordsNext.innerHTML = next >= 0 ? chordMarkup(events[next].chord) : "";
  if (forward) scrollTape();
}

function render(): void {
  const track = localTrack();
  if (!track) {
    showMessage(i18n.t(state.playbackMode === "radio" ? "chordsRadio" : "chordsNoTrack"), false);
    return;
  }
  if (status === "done" && analysis) {
    chordsMessage.hidden = true;
    chordsResult.hidden = false;
    const tonic = noteName(analysis.key.tonic, usesFlats(analysis.key));
    chordsKey.textContent = `${tonic} ${i18n.t(analysis.key.minor ? "chordsMinor" : "chordsMajor")}`;
    updatePosition(true);
    return;
  }
  if (status === "analyzing") showMessage(progress == null ? i18n.t("chordsAnalyzing") : `${i18n.t("chordsAnalyzing")} ${Math.round(progress * 100)}%`, true);
  else if (status === "tooLong") showMessage(i18n.t("chordsTooLong"), false);
  else if (status === "tooLarge") showMessage(i18n.t("chordsTooLarge"), false);
  else if (status === "failed") showMessage(i18n.t("chordsFailed"), false);
  else showMessage(i18n.t("chordsPrompt"), !!track.path);
}

function tick(): void {
  frame = 0;
  updatePosition();
  scheduleTick();
}

function scheduleTick(): void {
  if (frame || !visible() || status !== "done" || audio.paused) return;
  frame = requestAnimationFrame(tick);
}

export function refreshChords(): void {
  const track = localTrack();
  const key = track ? trackKey(track) : null;
  if (key !== currentKey) {
    currentKey = key;
    analysis = key ? (cache.get(key) ?? null) : null;
    status = analysis ? "done" : "idle";
    shownIndex = -1;
  }
  render();
  scheduleTick();
}

function monoSamples(buffer: AudioBuffer): Float32Array {
  const out = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < out.length; i++) out[i] += data[i] / buffer.numberOfChannels;
  }
  return out;
}

async function decodeFile(track: Track & { path: string }): Promise<Float32Array | Exclude<Status, "idle" | "analyzing" | "done">> {
  if (decodedFile?.path === track.path) return decodedFile.samples;
  const read = await window.electronAPI!.readAudioData(track.path, !!track.alac);
  if (!read.ok) return read.error;
  const { buffer, byteOffset, byteLength } = read.data;
  const bytes = byteOffset === 0 && byteLength === buffer.byteLength ? buffer : buffer.slice(byteOffset, byteOffset + byteLength);
  const decoded = await new OfflineAudioContext(1, 1, ANALYSIS_SAMPLE_RATE).decodeAudioData(bytes as ArrayBuffer);
  if (decoded.duration > MAX_ANALYSIS_SECONDS) return "tooLong";
  decodedFile = { path: track.path, samples: monoSamples(decoded) };
  return decodedFile.samples;
}

async function analyzeCurrent(): Promise<void> {
  const track = localTrack();
  const key = track ? trackKey(track) : null;
  if (!track?.path || !key || status === "analyzing" || !window.electronAPI?.readAudioData) return;
  status = "analyzing";
  progress = null;
  render();
  let result: Status = "failed";
  try {
    const samples = await decodeFile(track as Track & { path: string });
    if (typeof samples === "string") result = samples;
    else {
      const from = Math.round((track.start ?? 0) * ANALYSIS_SAMPLE_RATE);
      const to = track.end != null ? Math.round(track.end * ANALYSIS_SAMPLE_RATE) : samples.length;
      const analysed = await analyzeChordsInSteps(
        samples.subarray(from, to),
        (fraction) => {
          if (currentKey !== key || status !== "analyzing") return;
          progress = fraction;
          render();
        },
        () => new Promise((resolve) => setTimeout(resolve, 0))
      );
      cache.set(key, analysed);
      result = "done";
    }
  } catch {
    result = "failed";
  }
  if (currentKey !== key) return;
  status = result;
  progress = null;
  analysis = cache.get(key) ?? null;
  shownIndex = -1;
  render();
  scheduleTick();
}

function refreshPopoutButton(): void {
  const key = state.chordsFloating ? "chordsPopIn" : "chordsPopOut";
  chordsPopoutBtn.dataset.i18nTitle = key;
  chordsPopoutBtn.dataset.i18nAria = key;
  chordsPopoutBtn.title = i18n.t(key);
  chordsPopoutBtn.setAttribute("aria-label", i18n.t(key));
}

function afterWindowChange(): void {
  refreshPopoutButton();
  syncElectronWindowSize();
}

export function setChordsOpen(open: boolean): void {
  state.chordsOpen = open;
  chordsBtn.classList.toggle("is-active", open);
  chordsBtn.setAttribute("aria-pressed", String(open));
  refreshChords();
  showSection(chordsSection, open);
  if (!open && state.chordsFloating) void returnChords().then(afterWindowChange);
  persistConfig();
}

export function setChordsCapo(capo: number): void {
  state.chordsCapo = Math.max(0, Math.min(CAPO_MAX, Math.round(capo) || 0));
  chordsCapoSelect.value = String(state.chordsCapo);
  updatePosition(true);
  persistConfig();
}

export function setChordsSimplify(simplify: boolean): void {
  state.chordsSimplify = simplify;
  renderSwitch(chordsSimplifyBtn, simplify);
  updatePosition(true);
  persistConfig();
}

export function initChords(): void {
  chordsBtn.addEventListener("click", () => setChordsOpen(!state.chordsOpen));
  chordsCloseBtn.addEventListener("click", () => setChordsOpen(false));
  window.electronAPI?.onDockClose?.((name) => {
    if (name === "chords" && (state.chordsFloating || state.separateActive)) setChordsOpen(false);
  });
  chordsPopoutBtn.addEventListener("click", () => void (state.chordsFloating ? returnChords() : popOutChords()).then(afterWindowChange));
  chordsAnalyzeBtn.addEventListener("click", () => void analyzeCurrent());
  chordsSimplifyBtn.addEventListener("click", () => setChordsSimplify(!state.chordsSimplify));
  chordsCapoSelect.addEventListener("change", () => setChordsCapo(Number(chordsCapoSelect.value)));
  for (const type of ["play", "seeked", "timeupdate"]) audio.addEventListener(type, () => {
    updatePosition();
    scheduleTick();
  });
  refreshChords();
}
