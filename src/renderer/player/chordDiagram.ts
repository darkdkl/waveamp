import type { ChordShape } from "../../shared/chordShapes";

const STRING_X = (string: number) => 9 + string * 8;
const FRET_Y = (fret: number) => 12 + fret * 12;
const FRETS_SHOWN = 4;

export function chordDiagramSvg(shape: ChordShape): string {
  const played = shape.frets.filter((fret) => fret > 0);
  const highest = played.length ? Math.max(...played) : 0;
  const base = highest > FRETS_SHOWN ? Math.min(...played) : 1;
  const parts: string[] = [];
  for (let string = 0; string < 6; string++) {
    parts.push(`<line x1="${STRING_X(string)}" y1="${FRET_Y(0)}" x2="${STRING_X(string)}" y2="${FRET_Y(FRETS_SHOWN)}" class="chords__line"/>`);
  }
  for (let fret = 0; fret <= FRETS_SHOWN; fret++) {
    const nut = fret === 0 && base === 1;
    parts.push(`<line x1="${STRING_X(0)}" y1="${FRET_Y(fret)}" x2="${STRING_X(5)}" y2="${FRET_Y(fret)}" class="${nut ? "chords__nut" : "chords__line"}"/>`);
  }
  if (base > 1) parts.push(`<text x="1" y="${FRET_Y(0) + 9}" class="chords__fret">${base}</text>`);
  const row = (fret: number) => (FRET_Y(fret - base) + FRET_Y(fret - base + 1)) / 2;
  if (shape.barre) {
    const { fret, from, to } = shape.barre;
    parts.push(`<rect x="${STRING_X(from) - 3.4}" y="${row(fret) - 3.4}" width="${STRING_X(to) - STRING_X(from) + 6.8}" height="6.8" rx="3.4" class="chords__dot"/>`);
  }
  shape.frets.forEach((fret, string) => {
    const x = STRING_X(string);
    if (fret < 0) parts.push(`<text x="${x}" y="8" class="chords__mute">×</text>`);
    else if (fret === 0) parts.push(`<circle cx="${x}" cy="5.5" r="2.2" class="chords__open"/>`);
    else if (!(shape.barre && fret === shape.barre.fret && string >= shape.barre.from && string <= shape.barre.to)) {
      parts.push(`<circle cx="${x}" cy="${row(fret)}" r="3.4" class="chords__dot"/>`);
    }
  });
  return `<svg class="chords__diagram" viewBox="0 0 58 64" aria-hidden="true">${parts.join("")}</svg>`;
}
