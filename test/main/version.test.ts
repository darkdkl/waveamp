import { describe, expect, it } from "vitest";
import { RELEASES_URL, isNewerVersion, isReleasePageUrl, parseLatestRelease } from "../../src/main/version";

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

describe("parseLatestRelease", () => {
  it("strips the v prefix and keeps the release page URL", () => {
    expect(parseLatestRelease({ tag_name: "v1.3.2", html_url: RELEASES_URL + "tag/v1.3.2" })).toEqual({
      version: "1.3.2",
      url: RELEASES_URL + "tag/v1.3.2",
    });
  });

  it("rejects unexpected versions and foreign URLs", () => {
    expect(() => parseLatestRelease({ tag_name: "v1.3", html_url: RELEASES_URL + "tag/v1.3" })).toThrow();
    expect(() => parseLatestRelease({ tag_name: "nightly", html_url: RELEASES_URL })).toThrow();
    expect(() => parseLatestRelease({ tag_name: "v1.3.2", html_url: "https://evil.example/waveamp" })).toThrow();
    expect(() => parseLatestRelease({})).toThrow();
  });
});

describe("isReleasePageUrl", () => {
  it("only allows the project's release pages", () => {
    expect(isReleasePageUrl(RELEASES_URL + "tag/v1.3.2")).toBe(true);
    expect(isReleasePageUrl("https://github.com/someone/else/releases/")).toBe(false);
    expect(isReleasePageUrl("javascript:alert(1)")).toBe(false);
    expect(isReleasePageUrl(42)).toBe(false);
  });
});
