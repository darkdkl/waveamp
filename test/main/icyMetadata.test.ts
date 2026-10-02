import { describe, expect, it } from "vitest";
import { IcyMetadataReader, parseMetaInt, parseStreamTitle } from "../../src/main/icyMetadata";

function metadataBlock(text: string, encoding: BufferEncoding = "utf8"): Buffer {
  const body = Buffer.from(text, encoding);
  const padded = Buffer.alloc(Math.ceil(body.length / 16) * 16);
  body.copy(padded);
  return Buffer.concat([Buffer.from([padded.length / 16]), padded]);
}

describe("parseMetaInt", () => {
  it("accepts a positive interval", () => {
    expect(parseMetaInt("16000")).toBe(16000);
    expect(parseMetaInt(["8192"])).toBe(8192);
  });

  it("rejects missing, zero and oversized values", () => {
    expect(parseMetaInt(undefined)).toBeNull();
    expect(parseMetaInt("0")).toBeNull();
    expect(parseMetaInt("abc")).toBeNull();
    expect(parseMetaInt(String(10 * 1024 * 1024))).toBeNull();
  });
});

describe("parseStreamTitle", () => {
  it("reads the title", () => {
    expect(parseStreamTitle(Buffer.from("StreamTitle='Norah Jones - Don't Know Why';StreamUrl='';\0\0"))).toBe(
      "Norah Jones - Don't Know Why"
    );
  });

  it("decodes UTF-8 and cp1251 titles", () => {
    expect(parseStreamTitle(Buffer.from("StreamTitle='Кино - Звезда';", "utf8"))).toBe("Кино - Звезда");
    const cp1251 = Buffer.from([...Buffer.from("StreamTitle='"), 0xca, 0xe8, 0xed, 0xee, ...Buffer.from("';")]);
    expect(parseStreamTitle(cp1251)).toBe("Кино");
  });

  it("returns null for empty or placeholder titles", () => {
    expect(parseStreamTitle(Buffer.from("StreamTitle='';"))).toBeNull();
    expect(parseStreamTitle(Buffer.from("StreamTitle=' - ';"))).toBeNull();
    expect(parseStreamTitle(Buffer.from("StreamUrl='http://x';"))).toBeNull();
  });
});

describe("IcyMetadataReader", () => {
  it("skips audio and returns the metadata block across chunks", () => {
    const stream = Buffer.concat([Buffer.alloc(10, 1), metadataBlock("StreamTitle='A - B';"), Buffer.alloc(4, 1)]);
    const reader = new IcyMetadataReader(10);
    let block: Buffer | null = null;
    for (let i = 0; i < stream.length && !block; i += 3) block = reader.push(stream.subarray(i, i + 3));
    expect(block && parseStreamTitle(block)).toBe("A - B");
  });

  it("moves past empty metadata blocks", () => {
    const stream = Buffer.concat([Buffer.alloc(8), Buffer.from([0]), Buffer.alloc(8), metadataBlock("StreamTitle='C - D';")]);
    const block = new IcyMetadataReader(8).push(stream);
    expect(block && parseStreamTitle(block)).toBe("C - D");
  });
});
