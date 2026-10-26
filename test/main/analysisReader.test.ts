import { EventEmitter } from "node:events";
import type { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import { createWorkerReader } from "../../src/main/analysisReader";

class FakeWorker extends EventEmitter {
  posted: unknown[] = [];
  terminated = false;

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): Promise<number> {
    if (!this.terminated) {
      this.terminated = true;
      queueMicrotask(() => this.emit("exit", 1));
    }
    return Promise.resolve(1);
  }
}

function setup() {
  const workers: FakeWorker[] = [];
  const logs: string[] = [];
  const reader = createWorkerReader(
    () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    },
    (message) => logs.push(message)
  );
  return { reader, workers, logs };
}

const segment = { start: 10, end: 20 };
const samples = { ok: true, samples: new Float32Array(3) } as const;

describe("createWorkerReader", () => {
  it("sends the request to the worker and returns its result", async () => {
    const { reader, workers } = setup();
    const pending = reader.read("/music/album.flac", segment);
    expect(workers[0].posted).toEqual([{ filePath: "/music/album.flac", segment }]);
    workers[0].emit("message", { result: samples });
    expect(await pending).toBe(samples);
    expect(workers[0].terminated).toBe(true);
  });

  it("hands back null and logs when the worker reports an error", async () => {
    const { reader, workers, logs } = setup();
    const pending = reader.read("/music/album.flac", segment);
    workers[0].emit("message", { error: "broken frame" });
    expect(await pending).toBeNull();
    expect(logs[0]).toContain("broken frame");
  });

  it("hands back null when the worker fails to start", async () => {
    const { reader, workers, logs } = setup();
    const pending = reader.read("/music/album.flac", segment);
    workers[0].emit("error", new Error("cannot load module"));
    expect(await pending).toBeNull();
    expect(logs).toHaveLength(1);
  });

  it("answers a cancelled read with a failure instead of a fallback", async () => {
    const { reader, logs } = setup();
    const pending = reader.read("/music/album.flac", segment);
    reader.cancel();
    expect(await pending).toEqual({ ok: false, error: "failed" });
    expect(logs).toHaveLength(0);
  });

  it("cancels the previous read when a new one starts", async () => {
    const { reader, workers } = setup();
    const first = reader.read("/music/album.flac", segment);
    const second = reader.read("/music/album.flac", { start: 30, end: 40 });
    expect(workers[0].terminated).toBe(true);
    expect(await first).toEqual({ ok: false, error: "failed" });
    workers[1].emit("message", { result: samples });
    expect(await second).toBe(samples);
  });
});
