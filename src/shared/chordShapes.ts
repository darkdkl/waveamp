import type { Chord, ChordQuality } from "./chords";

export interface ChordShape {
  frets: number[];
  barre: { fret: number; from: number; to: number } | null;
}

export const STRING_PITCHES = [4, 9, 2, 7, 11, 4];

const X = -1;

const OPEN: Record<ChordQuality, Record<number, number[]>> = {
  maj: { 0: [X, 3, 2, 0, 1, 0], 9: [X, 0, 2, 2, 2, 0], 7: [3, 2, 0, 0, 0, 3], 4: [0, 2, 2, 1, 0, 0], 2: [X, X, 0, 2, 3, 2] },
  min: { 9: [X, 0, 2, 2, 1, 0], 4: [0, 2, 2, 0, 0, 0], 2: [X, X, 0, 2, 3, 1] },
  "7": { 0: [X, 3, 2, 3, 1, 0], 9: [X, 0, 2, 0, 2, 0], 7: [3, 2, 0, 0, 0, 1], 4: [0, 2, 0, 1, 0, 0], 2: [X, X, 0, 2, 1, 2], 11: [X, 2, 1, 2, 0, 2] },
  maj7: { 0: [X, 3, 2, 0, 0, 0], 9: [X, 0, 2, 1, 2, 0], 7: [3, 2, 0, 0, 0, 2], 4: [0, 2, 1, 1, 0, 0], 2: [X, X, 0, 2, 2, 2], 5: [X, X, 3, 2, 1, 0] },
  m7: { 9: [X, 0, 2, 0, 1, 0], 4: [0, 2, 0, 0, 0, 0], 2: [X, X, 0, 2, 1, 1], 11: [X, 2, 0, 2, 0, 2] },
};

const E_SHAPE: Record<ChordQuality, number[]> = {
  maj: [0, 2, 2, 1, 0, 0],
  min: [0, 2, 2, 0, 0, 0],
  "7": [0, 2, 0, 1, 0, 0],
  maj7: [0, X, 1, 1, 0, X],
  m7: [0, 2, 0, 0, 0, 0],
};

const A_SHAPE: Record<ChordQuality, number[]> = {
  maj: [X, 0, 2, 2, 2, 0],
  min: [X, 0, 2, 2, 1, 0],
  "7": [X, 0, 2, 0, 2, 0],
  maj7: [X, 0, 2, 1, 2, 0],
  m7: [X, 0, 2, 0, 1, 0],
};

function barreShape(template: number[], fret: number): ChordShape {
  const frets = template.map((offset) => (offset === X ? X : offset + fret));
  const strings = frets.map((value, i) => (value === fret ? i : -1)).filter((i) => i >= 0);
  return { frets, barre: { fret, from: strings[0], to: strings[strings.length - 1] } };
}

export function chordShape(chord: Chord): ChordShape {
  const open = OPEN[chord.quality][chord.root];
  if (open) return { frets: open, barre: null };
  const eFret = (chord.root - STRING_PITCHES[0] + 12) % 12 || 12;
  const aFret = (chord.root - STRING_PITCHES[1] + 12) % 12 || 12;
  return aFret < eFret ? barreShape(A_SHAPE[chord.quality], aFret) : barreShape(E_SHAPE[chord.quality], eFret);
}

export function shapePitchClasses(shape: ChordShape): number[] {
  return shape.frets.flatMap((fret, string) => (fret === X ? [] : [(STRING_PITCHES[string] + fret) % 12]));
}

export function lowestPitchClass(shape: ChordShape): number | null {
  const string = shape.frets.findIndex((fret) => fret !== X);
  return string < 0 ? null : (STRING_PITCHES[string] + shape.frets[string]) % 12;
}
