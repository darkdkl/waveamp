function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е");
}

export function searchWords(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

export function matchesWords(text: string, words: string[]): boolean {
  const normalized = normalize(text);
  return words.every((word) => normalized.includes(word));
}

export function stepIndex(current: number, count: number, step: 1 | -1): number {
  if (count === 0) return -1;
  return (current + step + count) % count;
}
