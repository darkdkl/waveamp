export type ChordQuality = "maj" | "min" | "7" | "maj7" | "m7";

export interface Chord {
  root: number;
  quality: ChordQuality;
}

export interface ChordEvent {
  start: number;
  end: number;
  chord: Chord | null;
}

export interface MusicalKey {
  tonic: number;
  minor: boolean;
}

export interface ChordAnalysis {
  key: MusicalKey;
  events: ChordEvent[];
}

export const ANALYSIS_SAMPLE_RATE = 11025;
export const MAX_ANALYSIS_SECONDS = 20 * 60;
const FRAME_SIZE = 8192;
const HOP_SIZE = 2048;
const LOWEST_NOTE = 33;
const HIGHEST_NOTE = 84;
const HIGHEST_BIN = 96;
const HIGHEST_BASS_NOTE = 55;
const NOTE_HARMONICS = 8;
const HARMONIC_DECAY = 0.7;
const NNLS_ITERATIONS = 40;
const BASS_WEIGHT = 0.3;
const SILENCE_RMS = 0.004;
const EMISSION_SHARPNESS = 18;
const SWITCH_PROBABILITY = 0.06;
const NO_CHORD_SCORE = 0.55;
const MIN_EVENT_SECONDS = 0.4;

const QUALITIES: ChordQuality[] = ["maj", "min", "7", "maj7", "m7"];
const INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
};
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1, 6]);
const FLAT_MINOR_TONICS = new Set([2, 7, 0, 5, 10, 3]);
const SUFFIX: Record<ChordQuality, string> = { maj: "", min: "m", "7": "7", maj7: "maj7", m7: "m7" };
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export const ALL_CHORDS: Chord[] = QUALITIES.flatMap((quality) => Array.from({ length: 12 }, (_, root) => ({ root, quality })));

export function chordTones(chord: Chord): number[] {
  return INTERVALS[chord.quality].map((interval) => (chord.root + interval) % 12);
}

interface FftTables {
  reversed: Uint32Array;
  cos: Float64Array;
  sin: Float64Array;
}

const fftTables = new Map<number, FftTables>();

function tablesFor(n: number): FftTables {
  let tables = fftTables.get(n);
  if (tables) return tables;
  const bits = Math.log2(n);
  const reversed = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    reversed[i] = r;
  }
  const cos = Float64Array.from({ length: n / 2 }, (_, k) => Math.cos((-2 * Math.PI * k) / n));
  const sin = Float64Array.from({ length: n / 2 }, (_, k) => Math.sin((-2 * Math.PI * k) / n));
  tables = { reversed, cos, sin };
  fftTables.set(n, tables);
  return tables;
}

export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  const { reversed, cos, sin } = tablesFor(n);
  for (let i = 0; i < n; i++) {
    const j = reversed[i];
    if (i < j) {
      const r = re[i];
      re[i] = re[j];
      re[j] = r;
      const m = im[i];
      im[i] = im[j];
      im[j] = m;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const stride = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * stride];
        const wi = sin[k * stride];
        const a = start + k;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

export interface ChromaFrame {
  chroma: Float64Array;
  bass: Float64Array;
}

const NOTES = Array.from({ length: HIGHEST_NOTE - LOWEST_NOTE + 1 }, (_, i) => LOWEST_NOTE + i);
const BINS = HIGHEST_BIN - LOWEST_NOTE + 1;
const NOTE_PROFILES = NOTES.map((note) => {
  const profile = new Float64Array(BINS);
  for (let harmonic = 1; harmonic <= NOTE_HARMONICS; harmonic++) {
    const bin = Math.round(note + 12 * Math.log2(harmonic)) - LOWEST_NOTE;
    if (bin < BINS) profile[bin] += HARMONIC_DECAY ** (harmonic - 1);
  }
  return profile;
});
const PROFILE_GRAM = NOTE_PROFILES.map((a) => NOTE_PROFILES.map((b) => a.reduce((sum, value, i) => sum + value * b[i], 0)));

const semitoneMaps = new Map<number, Int16Array>();

function semitoneMap(sampleRate: number): Int16Array {
  let map = semitoneMaps.get(sampleRate);
  if (map) return map;
  map = new Int16Array(FRAME_SIZE / 2).fill(-1);
  for (let bin = 1; bin < FRAME_SIZE / 2; bin++) {
    const index = Math.round(69 + 12 * Math.log2((bin * sampleRate) / FRAME_SIZE / 440)) - LOWEST_NOTE;
    if (index >= 0 && index < BINS) map[bin] = index;
  }
  semitoneMaps.set(sampleRate, map);
  return map;
}

function semitoneSpectrum(re: Float64Array, im: Float64Array, sampleRate: number): Float64Array {
  const spectrum = new Float64Array(BINS);
  const map = semitoneMap(sampleRate);
  for (let bin = 1; bin < map.length; bin++) {
    const index = map[bin];
    if (index < 0) continue;
    const magnitude = Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
    if (magnitude > spectrum[index]) spectrum[index] = magnitude;
  }
  return spectrum;
}

function noteActivations(spectrum: Float64Array): Float64Array {
  const projected = NOTE_PROFILES.map((profile) => profile.reduce((sum, value, i) => sum + value * spectrum[i], 0));
  const notes = new Float64Array(NOTES.length).fill(1);
  for (let iteration = 0; iteration < NNLS_ITERATIONS; iteration++) {
    for (let a = 0; a < notes.length; a++) {
      let modelled = 0;
      for (let b = 0; b < notes.length; b++) modelled += PROFILE_GRAM[a][b] * notes[b];
      notes[a] *= projected[a] / (modelled + 1e-9);
    }
  }
  return notes;
}

const HANN = Float64Array.from({ length: FRAME_SIZE }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME_SIZE - 1)));

function chromaFrame(samples: Float32Array, offset: number, sampleRate: number, re: Float64Array, im: Float64Array): ChromaFrame | null {
  let energy = 0;
  for (let i = 0; i < FRAME_SIZE; i++) {
    const sample = samples[offset + i];
    energy += sample * sample;
    re[i] = sample * HANN[i];
    im[i] = 0;
  }
  if (Math.sqrt(energy / FRAME_SIZE) < SILENCE_RMS) return null;
  fft(re, im);
  const notes = noteActivations(semitoneSpectrum(re, im, sampleRate));
  const chroma = new Float64Array(12);
  const bass = new Float64Array(12);
  NOTES.forEach((note, i) => {
    chroma[note % 12] += notes[i];
    if (note <= HIGHEST_BASS_NOTE) bass[note % 12] += notes[i] * (1 - (note - LOWEST_NOTE) / (HIGHEST_BASS_NOTE - LOWEST_NOTE + 1));
  });
  const chromaNorm = Math.hypot(...chroma);
  if (!chromaNorm) return null;
  const bassPeak = Math.max(...bass) || 1;
  return { chroma: chroma.map((value) => value / chromaNorm), bass: bass.map((value) => value / bassPeak) };
}

function frameCount(samples: Float32Array): number {
  return samples.length < FRAME_SIZE ? 0 : Math.floor((samples.length - FRAME_SIZE) / HOP_SIZE) + 1;
}

export function chromagram(samples: Float32Array, sampleRate = ANALYSIS_SAMPLE_RATE): (ChromaFrame | null)[] {
  const re = new Float64Array(FRAME_SIZE);
  const im = new Float64Array(FRAME_SIZE);
  return Array.from({ length: frameCount(samples) }, (_, i) => chromaFrame(samples, i * HOP_SIZE, sampleRate, re, im));
}

const TEMPLATES = ALL_CHORDS.map((chord) => {
  const template = new Float64Array(12);
  const tones = chordTones(chord);
  tones.forEach((pitchClass) => (template[pitchClass] = 1 / Math.sqrt(tones.length)));
  return { template, root: chord.root };
});

export function chordScores(frame: ChromaFrame): number[] {
  return TEMPLATES.map(({ template, root }) => {
    let dot = 0;
    for (let i = 0; i < 12; i++) dot += frame.chroma[i] * template[i];
    return (dot + BASS_WEIGHT * frame.bass[root]) / (1 + BASS_WEIGHT);
  });
}

export function smoothChords(frames: (ChromaFrame | null)[]): (Chord | null)[] {
  const states = ALL_CHORDS.length + 1;
  const noChord = ALL_CHORDS.length;
  const stay = Math.log(1 - SWITCH_PROBABILITY);
  const move = Math.log(SWITCH_PROBABILITY / (states - 1));
  const emissions = frames.map((frame) => {
    const row = new Float64Array(states);
    if (!frame) {
      row.fill(-EMISSION_SHARPNESS);
      row[noChord] = 0;
      return row;
    }
    chordScores(frame).forEach((score, i) => (row[i] = EMISSION_SHARPNESS * score));
    row[noChord] = EMISSION_SHARPNESS * NO_CHORD_SCORE;
    return row;
  });
  if (!emissions.length) return [];
  let scores = Float64Array.from(emissions[0]);
  const back: Int32Array[] = [];
  for (let t = 1; t < emissions.length; t++) {
    let best = 0;
    for (let s = 1; s < states; s++) if (scores[s] > scores[best]) best = s;
    const next = new Float64Array(states);
    const from = new Int32Array(states);
    for (let s = 0; s < states; s++) {
      const kept = scores[s] + stay;
      const switched = scores[best] + move;
      if (kept >= switched || best === s) {
        next[s] = kept + emissions[t][s];
        from[s] = s;
      } else {
        next[s] = switched + emissions[t][s];
        from[s] = best;
      }
    }
    back.push(from);
    scores = next;
  }
  let state = 0;
  for (let s = 1; s < states; s++) if (scores[s] > scores[state]) state = s;
  const path = new Int32Array(emissions.length);
  path[emissions.length - 1] = state;
  for (let t = emissions.length - 1; t > 0; t--) {
    state = back[t - 1][state];
    path[t - 1] = state;
  }
  return Array.from(path, (s) => (s === noChord ? null : ALL_CHORDS[s]));
}

export function estimateKey(events: ChordEvent[]): MusicalKey {
  const total = new Float64Array(12);
  for (const event of events) if (event.chord) for (const pitchClass of chordTones(event.chord)) total[pitchClass] += event.end - event.start;
  let best = { tonic: 0, minor: false, score: -Infinity };
  for (const minor of [false, true]) {
    const profile = minor ? MINOR_PROFILE : MAJOR_PROFILE;
    for (let tonic = 0; tonic < 12; tonic++) {
      const shifted = Array.from({ length: 12 }, (_, i) => profile[(i - tonic + 12) % 12]);
      const score = correlation(total, shifted);
      if (score > best.score) best = { tonic, minor, score };
    }
  }
  return { tonic: best.tonic, minor: best.minor };
}

function correlation(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = a.length;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a[i] / n;
    meanB += b[i] / n;
  }
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - meanA) * (b[i] - meanB);
    denA += (a[i] - meanA) ** 2;
    denB += (b[i] - meanB) ** 2;
  }
  return denA && denB ? num / Math.sqrt(denA * denB) : 0;
}

function sameChord(a: Chord | null, b: Chord | null): boolean {
  return a === b || (!!a && !!b && a.root === b.root && a.quality === b.quality);
}

export function toEvents(chords: (Chord | null)[], sampleRate = ANALYSIS_SAMPLE_RATE): ChordEvent[] {
  const frameSeconds = HOP_SIZE / sampleRate;
  const offset = FRAME_SIZE / 2 / sampleRate - frameSeconds / 2;
  const events: ChordEvent[] = [];
  chords.forEach((chord, i) => {
    const start = i === 0 ? 0 : offset + i * frameSeconds;
    const last = events[events.length - 1];
    if (last && sameChord(last.chord, chord)) last.end = start + frameSeconds;
    else events.push({ start, end: start + frameSeconds, chord });
  });
  for (let i = 0; i < events.length; i++) {
    if (events.length < 2 || events[i].end - events[i].start >= MIN_EVENT_SECONDS) continue;
    const target = i > 0 ? i - 1 : i + 1;
    events[target].start = Math.min(events[target].start, events[i].start);
    events[target].end = Math.max(events[target].end, events[i].end);
    events.splice(i, 1);
    i = Math.max(-1, i - 2);
  }
  for (let i = 1; i < events.length; i++) {
    if (sameChord(events[i - 1].chord, events[i].chord)) {
      events[i - 1].end = events[i].end;
      events.splice(i--, 1);
    }
  }
  return events;
}

export function analyzeChords(samples: Float32Array, sampleRate = ANALYSIS_SAMPLE_RATE): ChordAnalysis {
  const events = toEvents(smoothChords(chromagram(samples, sampleRate)), sampleRate);
  return { key: estimateKey(events), events };
}

export async function analyzeChordsInSteps(
  samples: Float32Array,
  onProgress: (fraction: number) => void,
  pause: () => Promise<void>,
  framesPerStep = 48
): Promise<ChordAnalysis> {
  const total = frameCount(samples);
  const re = new Float64Array(FRAME_SIZE);
  const im = new Float64Array(FRAME_SIZE);
  const frames: (ChromaFrame | null)[] = [];
  for (let i = 0; i < total; i++) {
    frames.push(chromaFrame(samples, i * HOP_SIZE, ANALYSIS_SAMPLE_RATE, re, im));
    if ((i + 1) % framesPerStep === 0) {
      onProgress((i + 1) / total);
      await pause();
    }
  }
  const events = toEvents(smoothChords(frames));
  return { key: estimateKey(events), events };
}

export function simplifyChord(chord: Chord): Chord {
  if (chord.quality === "7" || chord.quality === "maj7") return { root: chord.root, quality: "maj" };
  if (chord.quality === "m7") return { root: chord.root, quality: "min" };
  return chord;
}

export function capoShape(chord: Chord, capo: number): Chord {
  return { root: (((chord.root - capo) % 12) + 12) % 12, quality: chord.quality };
}

export function usesFlats(key: MusicalKey): boolean {
  return key.minor ? FLAT_MINOR_TONICS.has(key.tonic) : FLAT_MAJOR_TONICS.has(key.tonic);
}

export function noteName(pitchClass: number, flats: boolean): string {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[((pitchClass % 12) + 12) % 12];
}

export function chordName(chord: Chord, flats: boolean): string {
  return noteName(chord.root, flats) + SUFFIX[chord.quality];
}

export function eventAt(events: ChordEvent[], time: number): number {
  let low = 0;
  let high = events.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (events[mid].end <= time) low = mid + 1;
    else if (events[mid].start > time) high = mid - 1;
    else return mid;
  }
  return Math.min(Math.max(low, 0), events.length - 1);
}
