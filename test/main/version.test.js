import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const { isNewerVersion } = createRequire(import.meta.url)("../../src/main/version.js");

describe("isNewerVersion", () => {
  it("detects a newer patch, minor and major", () => {
    expect(isNewerVersion("1.3.1", "1.3.0")).toBe(true);
    expect(isNewerVersion("1.4.0", "1.3.9")).toBe(true);
    expect(isNewerVersion("2.0.0", "1.99.99")).toBe(true);
  });

  it("is false for the same or an older version", () => {
    expect(isNewerVersion("1.3.0", "1.3.0")).toBe(false);
    expect(isNewerVersion("1.2.9", "1.3.0")).toBe(false);
    expect(isNewerVersion("0.21.0", "1.0.0")).toBe(false);
  });

  it("compares parts as numbers, not strings", () => {
    expect(isNewerVersion("1.10.0", "1.9.0")).toBe(true);
    expect(isNewerVersion("1.9.0", "1.10.0")).toBe(false);
  });

  it("treats missing parts as zero", () => {
    expect(isNewerVersion("2.0", "1.9.9")).toBe(true);
    expect(isNewerVersion("1.3", "1.3.0")).toBe(false);
  });
});
