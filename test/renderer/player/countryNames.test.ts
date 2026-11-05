import { describe, expect, it } from "vitest";
import { countryEntries } from "../../../src/renderer/player/radio/countryNames";

const countries = [
  { code: "GB", name: "The United Kingdom Of Great Britain And Northern Ireland", count: 500 },
  { code: "VE", name: "Bolivarian Republic Of Venezuela", count: 40 },
  { code: "AT", name: "Austria", count: 300 },
  { code: "ZZZ", name: "Somewhere Else", count: 1 },
];

describe("countryEntries", () => {
  it("shows the common name in the interface language", () => {
    const labels = countryEntries(countries, "ru").map((c) => c.label);
    expect(labels).toContain("Великобритания");
    expect(labels).toContain("Венесуэла");
  });

  it("keeps the catalog name and code for requests", () => {
    const gb = countryEntries(countries, "en").find((c) => c.code === "GB");
    expect(gb).toEqual({ code: "GB", name: "The United Kingdom Of Great Britain And Northern Ireland", label: "United Kingdom" });
  });

  it("falls back to the catalog name for an unknown code", () => {
    expect(countryEntries(countries, "en").find((c) => c.code === "ZZZ")?.label).toBe("Somewhere Else");
  });

  it("sorts by the shown name", () => {
    expect(countryEntries(countries, "ru").map((c) => c.label)).toEqual([
      "Австрия",
      "Великобритания",
      "Венесуэла",
      "Somewhere Else",
    ]);
  });
});
