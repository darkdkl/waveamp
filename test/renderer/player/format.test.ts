import { describe, expect, it } from "vitest";
import {
  dbToGain,
  formatBandLabel,
  formatDb,
  formatClock,
  formatTime,
  isAddableAudioFile,
  isHttpUrl,
  safeStreamUrl,
  safeTrackUrl,
  stationHost,
  trackDisplayName,
  trackLabel,
} from "../../../src/renderer/player/format";

describe("formatTime", () => {
  it("formats minutes and seconds with leading zeros", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(7.9)).toBe("00:07");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(3725)).toBe("62:05");
  });

  it("treats negative and non-finite values as zero", () => {
    expect(formatTime(-3)).toBe("00:00");
    expect(formatTime(NaN)).toBe("00:00");
    expect(formatTime(Infinity)).toBe("00:00");
  });
});

describe("trackLabel and trackDisplayName", () => {
  it("drops only the last extension", () => {
    expect(trackLabel("song.flac")).toBe("song");
    expect(trackLabel("my.great.song.mp3")).toBe("my.great.song");
    expect(trackLabel("no-extension")).toBe("no-extension");
  });

  it("prefers 'Artist — Title' from tags, then title, then the file name", () => {
    expect(trackDisplayName({ name: "file", tags: { title: "T", artist: "A", album: null, duration: null } })).toBe(
      "A — T"
    );
    expect(trackDisplayName({ name: "file", tags: { title: "T", artist: null, album: null, duration: null } })).toBe(
      "T"
    );
    expect(trackDisplayName({ name: "file" })).toBe("file");
  });
});

describe("EQ formatting", () => {
  it("labels bands in Hz and kHz", () => {
    expect(formatBandLabel(60)).toBe("60");
    expect(formatBandLabel(1000)).toBe("1K");
    expect(formatBandLabel(14000)).toBe("14K");
  });

  it("signs positive gains", () => {
    expect(formatDb(3)).toBe("+3");
    expect(formatDb(0)).toBe("0");
    expect(formatDb(-4)).toBe("-4");
  });

  it("converts dB to linear gain", () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(20)).toBeCloseTo(10);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
  });
});

describe("URL checks", () => {
  it("allows only http(s) streams and normalizes them", () => {
    expect(safeStreamUrl("http://r.example:8000")).toBe("http://r.example:8000/");
    expect(safeStreamUrl("https://r.example/live.mp3")).toBe("https://r.example/live.mp3");
    expect(safeStreamUrl("javascript:alert(1)")).toBeNull();
    expect(safeStreamUrl("file:///etc/hostname")).toBeNull();
    expect(safeStreamUrl("not a url")).toBeNull();
    expect(isHttpUrl("https://r.example")).toBe(true);
    expect(isHttpUrl("ftp://r.example")).toBe(false);
  });

  it("allows only file: and blob: for local tracks", () => {
    expect(safeTrackUrl("file:///music/%D1%82%D0%B5%D1%81%D1%82%20%231.flac")).toBe(
      "file:///music/%D1%82%D0%B5%D1%81%D1%82%20%231.flac"
    );
    expect(safeTrackUrl("blob:file:///0b6a1c2e")).toBe("blob:file:///0b6a1c2e");
    expect(safeTrackUrl("http://r.example/a.mp3")).toBeNull();
    expect(safeTrackUrl("javascript:alert(1)")).toBeNull();
  });

  it("shows the stream host or nothing", () => {
    expect(stationHost("http://stream.example:8000/live")).toBe("stream.example:8000");
    expect(stationHost("garbage")).toBe("");
  });
});

describe("isAddableAudioFile", () => {
  it("accepts known extensions even without a MIME type", () => {
    expect(isAddableAudioFile({ name: "a.FLAC", type: "" })).toBe(true);
    expect(isAddableAudioFile({ name: "a.opus", type: "" })).toBe(true);
  });

  it("accepts other audio/* files unless the format is unsupported", () => {
    expect(isAddableAudioFile({ name: "a.xyz", type: "audio/x-something" })).toBe(true);
    expect(isAddableAudioFile({ name: "a.wma", type: "audio/x-ms-wma" })).toBe(false);
    expect(isAddableAudioFile({ name: "a.mid", type: "audio/midi" })).toBe(false);
  });

  it("rejects non-audio files", () => {
    expect(isAddableAudioFile({ name: "cover.jpg", type: "image/jpeg" })).toBe(false);
    expect(isAddableAudioFile({ name: "notes.txt", type: "" })).toBe(false);
  });
});

describe("formatClock", () => {
  it("shows 24-hour time with a blinking colon", () => {
    expect(formatClock(new Date(2026, 9, 2, 9, 5))).toBe("09:05");
    expect(formatClock(new Date(2026, 9, 2, 21, 47), false)).toBe("21 47");
  });
});
