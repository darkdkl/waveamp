import { describe, expect, it } from "vitest";
import { codecFromContentType, codecLabel, infoLabel, kbps, parseIcyBitrate } from "../../src/shared/audioFormat";

describe("codecLabel", () => {
  it("turns tag codec names into short labels", () => {
    expect(codecLabel("MPEG 1 Layer 3")).toBe("MP3");
    expect(codecLabel("MPEG 2 Layer 2")).toBe("MP2");
    expect(codecLabel("MPEG-4/AAC")).toBe("AAC");
    expect(codecLabel("MPEG-4/AAC+")).toBe("AAC+");
    expect(codecLabel("HE-AAC")).toBe("AAC+");
    expect(codecLabel("Vorbis I")).toBe("OGG");
    expect(codecLabel("Opus")).toBe("OPUS");
    expect(codecLabel("FLAC")).toBe("FLAC");
    expect(codecLabel("ALAC")).toBe("ALAC");
    expect(codecLabel("PCM")).toBe("WAV");
    expect(codecLabel("AIFF")).toBe("AIFF");
  });

  it("keeps unknown codecs short and ignores empty ones", () => {
    expect(codecLabel("Musepack SV8")).toBe("MUSE");
    expect(codecLabel("")).toBeNull();
    expect(codecLabel(null)).toBeNull();
  });
});

describe("infoLabel", () => {
  it("joins the codec and the number with a space when it fits", () => {
    expect(infoLabel("MP3", 320)).toBe("MP3 320");
    expect(infoLabel("FLAC", 16)).toBe("FLAC 16");
    expect(infoLabel("OGG", null)).toBe("OGG");
  });

  it("drops the space, then cuts to seven characters", () => {
    expect(infoLabel("OPUS", 128)).toBe("OPUS128");
    expect(infoLabel("AAC+", 64)).toBe("AAC+ 64");
    expect(infoLabel("AAC+", 128)).toBe("AAC+128");
    expect(infoLabel("OPUS", 1024)).toBe("OPUS102");
  });

  it("shows nothing without a codec", () => {
    expect(infoLabel(null, 128)).toBeNull();
  });
});

describe("kbps", () => {
  it("rounds bits per second to kilobits", () => {
    expect(kbps(128000)).toBe(128);
    expect(kbps(1411200)).toBe(1411);
    expect(kbps(0)).toBeNull();
    expect(kbps(Number.NaN)).toBeNull();
    expect(kbps(undefined)).toBeNull();
  });
});

describe("stream headers", () => {
  it("reads icy-br", () => {
    expect(parseIcyBitrate("128")).toBe(128);
    expect(parseIcyBitrate("128,128")).toBe(128);
    expect(parseIcyBitrate(["64"])).toBe(64);
    expect(parseIcyBitrate("0")).toBeNull();
    expect(parseIcyBitrate("fast")).toBeNull();
    expect(parseIcyBitrate(undefined)).toBeNull();
  });

  it("maps the content type to a codec", () => {
    expect(codecFromContentType("audio/mpeg")).toBe("MP3");
    expect(codecFromContentType("audio/aacp")).toBe("AAC+");
    expect(codecFromContentType("audio/aac; charset=binary")).toBe("AAC");
    expect(codecFromContentType("application/ogg")).toBe("OGG");
    expect(codecFromContentType("text/html")).toBeNull();
    expect(codecFromContentType(undefined)).toBeNull();
  });
});
