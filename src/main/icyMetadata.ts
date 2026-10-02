import { fixMojibake } from "./textEncoding";

export const ICY_MAX_METAINT = 256 * 1024;
export const ICY_POLL_INTERVAL_MS = 30_000;
export const ICY_POLL_JITTER = 0.2;
export const ICY_MAX_BACKOFF_MS = 5 * 60_000;
const ICY_BLOCKING_STATUSES = new Set([403, 429]);

export function icyPollDelay(failures: number, random: () => number = Math.random): number {
  const backoff = ICY_POLL_INTERVAL_MS * 2 ** Math.max(0, failures);
  const jitter = 1 + (random() * 2 - 1) * ICY_POLL_JITTER;
  return Math.round(Math.min(ICY_MAX_BACKOFF_MS, backoff * jitter));
}

export function isBlockingStatus(status: number): boolean {
  return ICY_BLOCKING_STATUSES.has(status);
}

export function parseMetaInt(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const metaint = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(metaint) && metaint > 0 && metaint <= ICY_MAX_METAINT ? metaint : null;
}

export function parseStreamTitle(block: Buffer): string | null {
  const text = block.toString("latin1").replace(/\0+$/, "");
  const match = /StreamTitle='(.*?)'(?:;|\s*$)/s.exec(text);
  const title = (fixMojibake(match?.[1]) ?? "").replace(/\s+/g, " ").trim();
  return /[\p{L}\p{N}]/u.test(title) ? title : null;
}

export class IcyMetadataReader {
  private audioLeft: number;
  private metaLeft = -1;
  private meta: Buffer[] = [];

  constructor(private readonly metaint: number) {
    this.audioLeft = metaint;
  }

  push(chunk: Buffer): Buffer | null {
    let offset = 0;
    while (offset < chunk.length) {
      if (this.audioLeft > 0) {
        const skip = Math.min(this.audioLeft, chunk.length - offset);
        this.audioLeft -= skip;
        offset += skip;
      } else if (this.metaLeft < 0) {
        this.metaLeft = chunk[offset] * 16;
        offset += 1;
        if (this.metaLeft === 0) this.nextBlock();
      } else {
        const take = Math.min(this.metaLeft, chunk.length - offset);
        this.meta.push(chunk.subarray(offset, offset + take));
        this.metaLeft -= take;
        offset += take;
        if (this.metaLeft === 0) {
          const block = Buffer.concat(this.meta);
          this.nextBlock();
          return block;
        }
      }
    }
    return null;
  }

  private nextBlock(): void {
    this.audioLeft = this.metaint;
    this.metaLeft = -1;
    this.meta = [];
  }
}
