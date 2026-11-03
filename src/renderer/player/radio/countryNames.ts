import type { CountryOption } from "../../../shared/types";

export interface CountryEntry {
  code: string;
  name: string;
  label: string;
}

const displayNames = new Map<string, Intl.DisplayNames>();

export function countryName(code: string | undefined, fallback: string, lang: string): string {
  if (!code) return fallback;
  let names = displayNames.get(lang);
  if (!names) {
    names = new Intl.DisplayNames([lang], { type: "region", fallback: "none" });
    displayNames.set(lang, names);
  }
  try {
    return names.of(code.toUpperCase()) ?? fallback;
  } catch {
    return fallback;
  }
}

export function countryEntries(countries: CountryOption[], lang: string): CountryEntry[] {
  const collator = new Intl.Collator(lang);
  return countries
    .map((country) => ({ code: country.code, name: country.name, label: countryName(country.code, country.name, lang) }))
    .sort((a, b) => collator.compare(a.label, b.label));
}
