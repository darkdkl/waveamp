import { describe, expect, it } from "vitest";
import {
  ALL_CHORDS,
  ANALYSIS_SAMPLE_RATE,
  analyzeChords,
  analyzeChordsInSteps,
  capoShape,
  chordName,
  chordScores,
  chordTones,
  chromagram,
  estimateKey,
  eventAt,
  fft,
  simplifyChord,
  usesFlats,
  type Chord,
} from "../../src/shared/chords";
import { chordShape, lowestPitchClass, shapePitchClasses } from "../../src/shared/chordShapes";

const RATE = ANALYSIS_SAMPLE_RATE;
const NOTE = (pitchClass: number, octave: number) => 440 * 2 ** ((pitchClass - 9) / 12 + (octave - 4));

function synth(chords: (Chord | null)[], seconds: number): Float32Array {
  const per = Math.round(seconds * RATE);
  const out = new Float32Array(per * chords.length);
  chords.forEach((chord, index) => {
    if (!chord) return;
    const tones = chordTones(chord);
    const notes = [NOTE(chord.root, 2), ...tones.map((pc) => NOTE(pc, 3)), ...tones.map((pc) => NOTE(pc, 4))];
    for (let i = 0; i < per; i++) {
      const t = i / RATE;
      let value = 0;
      for (const frequency of notes) for (let h = 1; h <= 4; h++) value += Math.sin(2 * Math.PI * frequency * h * t) / (h * h);
      out[index * per + i] = (0.05 * value) / notes.length;
    }
  });
  return out;
}

function strummed(chords: Chord[], barSeconds: number): Float32Array {
  const out = new Float32Array(Math.round(barSeconds * RATE) * chords.length);
  const beat = barSeconds / 4;
  let seed = 7;
  const noise = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  chords.forEach((chord, bar) => {
    const tones = chordTones(chord);
    const notes = [NOTE(chord.root, 2), ...tones.map((pc) => NOTE(pc, 3)), ...tones.slice(0, 3).map((pc) => NOTE(pc, 4))];
    for (let b = 0; b < 4; b++) {
      const start = Math.round((bar * barSeconds + b * beat) * RATE);
      notes.forEach((frequency, k) => {
        const delay = Math.round(0.012 * k * RATE);
        for (let n = 0; n < beat * RATE && start + delay + n < out.length; n++) {
          const t = n / RATE;
          let value = 0;
          for (let h = 1; h <= 5; h++) value += Math.sin(2 * Math.PI * frequency * h * t) / h ** 1.3;
          out[start + delay + n] += value * Math.exp(-3.5 * t) * 0.02;
        }
      });
      for (let n = 0; n < 0.08 * RATE && start + n < out.length; n++) {
        const t = n / RATE;
        out[start + n] += Math.sin(2 * Math.PI * (60 - 200 * t) * t) * Math.exp(-30 * t) * 0.12 + noise() * Math.exp(-60 * t) * 0.03;
      }
    }
  });
  return out;
}

const am: Chord = { root: 9, quality: "min" };
const f: Chord = { root: 5, quality: "maj" };
const c: Chord = { root: 0, quality: "maj" };
const g: Chord = { root: 7, quality: "maj" };

describe("fft", () => {
  it("puts a pure tone into its bin", () => {
    const n = 1024;
    const re = Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 37 * i) / n));
    const im = new Float64Array(n);
    fft(re, im);
    const magnitudes = Array.from({ length: n / 2 }, (_, i) => Math.hypot(re[i], im[i]));
    expect(magnitudes.indexOf(Math.max(...magnitudes))).toBe(37);
  });
});

describe("chord recognition", () => {
  it("recognises single chords of every quality", () => {
    for (const chord of [am, f, c, g, { root: 2, quality: "7" }, { root: 4, quality: "m7" }, { root: 0, quality: "maj7" }] as Chord[]) {
      const frames = chromagram(synth([chord], 1)).filter((frame) => !!frame);
      const scores = chordScores(frames[0]);
      const best = ALL_CHORDS[scores.indexOf(Math.max(...scores))];
      expect(best).toEqual(chord);
    }
  });

  it("follows a progression with the changes in the right places", () => {
    const { events } = analyzeChords(synth([am, f, c, g], 2));
    expect(events.map((event) => event.chord)).toEqual([am, f, c, g]);
    events.slice(1).forEach((event, i) => expect(Math.abs(event.start - (i + 1) * 2)).toBeLessThan(0.45));
  });

  it("recognises strummed chords over drums, sevenths included", () => {
    const song: Chord[] = [
      { root: 0, quality: "maj" },
      { root: 9, quality: "min" },
      { root: 2, quality: "m7" },
      { root: 7, quality: "7" },
      { root: 0, quality: "maj7" },
      { root: 5, quality: "maj7" },
      { root: 10, quality: "maj" },
      { root: 4, quality: "7" },
    ];
    const { events } = analyzeChords(strummed(song, 2));
    expect(song.map((_, bar) => events[eventAt(events, bar * 2 + 1)].chord)).toEqual(song);
  });

  it("gives the same result in steps and reports progress", async () => {
    const samples = synth([am, f, c, g], 2);
    const progress: number[] = [];
    let pauses = 0;
    const stepped = await analyzeChordsInSteps(samples, (fraction) => progress.push(fraction), async () => void pauses++, 10);
    expect(stepped).toEqual(analyzeChords(samples));
    expect(pauses).toBeGreaterThan(1);
    expect(progress.every((value, i) => value > 0 && value <= 1 && (i === 0 || value > progress[i - 1]))).toBe(true);
  });

  it("marks silence as no chord", () => {
    const { events } = analyzeChords(synth([am, null, am], 2));
    expect(events.map((event) => event.chord)).toEqual([am, null, am]);
  });
});

describe("estimateKey", () => {
  it("finds a major and a minor key", () => {
    expect(analyzeChords(synth([c, f, g, c], 1.5)).key).toEqual({ tonic: 0, minor: false });
    const dm: Chord = { root: 2, quality: "min" };
    const e: Chord = { root: 4, quality: "maj" };
    expect(analyzeChords(synth([am, dm, e, am, dm, am], 1.5)).key).toEqual({ tonic: 9, minor: true });
    expect(estimateKey([])).toEqual({ tonic: 0, minor: false });
  });
});

describe("chord names", () => {
  it("spells with flats in flat keys", () => {
    expect(usesFlats({ tonic: 5, minor: false })).toBe(true);
    expect(chordName({ root: 10, quality: "maj" }, true)).toBe("Bb");
    expect(chordName({ root: 10, quality: "maj" }, false)).toBe("A#");
    expect(chordName({ root: 1, quality: "m7" }, false)).toBe("C#m7");
  });

  it("simplifies sevenths and moves shapes under a capo", () => {
    expect(simplifyChord({ root: 7, quality: "7" })).toEqual({ root: 7, quality: "maj" });
    expect(simplifyChord({ root: 9, quality: "m7" })).toEqual({ root: 9, quality: "min" });
    expect(capoShape({ root: 9, quality: "maj" }, 2)).toEqual({ root: 7, quality: "maj" });
    expect(capoShape({ root: 1, quality: "min" }, 3)).toEqual({ root: 10, quality: "min" });
  });
});

describe("event lookup", () => {
  const events = [
    { start: 0, end: 2, chord: am },
    { start: 2, end: 4, chord: f },
    { start: 4, end: 6, chord: c },
  ];

  it("finds the chord at a time", () => {
    expect(eventAt(events, 0)).toBe(0);
    expect(eventAt(events, 2.5)).toBe(1);
    expect(eventAt(events, 9)).toBe(2);
  });
});

describe("chordShape", () => {
  it("plays the right notes with the root in the bass for every chord", () => {
    for (const chord of ALL_CHORDS) {
      const shape = chordShape(chord);
      const tones = chordTones(chord);
      const played = shapePitchClasses(shape);
      expect(played.every((pc) => tones.includes(pc)), JSON.stringify(chord)).toBe(true);
      expect(lowestPitchClass(shape), JSON.stringify(chord)).toBe(chord.root);
      expect(played, JSON.stringify(chord)).toContain(tones[1]);
      if (tones.length === 4) expect(played, JSON.stringify(chord)).toContain(tones[3]);
    }
  });

  it("uses open shapes where they exist and barres elsewhere", () => {
    expect(chordShape(am).barre).toBeNull();
    expect(chordShape(f).barre).toEqual({ fret: 1, from: 0, to: 5 });
    expect(chordShape({ root: 11, quality: "min" }).barre).toEqual({ fret: 2, from: 1, to: 5 });
    expect(chordShape({ root: 6, quality: "maj7" })).toEqual({ frets: [2, -1, 3, 3, 2, -1], barre: null });
  });
});
