import type { Worker } from "node:worker_threads";
import type { AnalysisSamples, SampleReader } from "./analysisAudio";

const CANCELLED = { ok: false, error: "failed" } as const;

export interface WorkerReader {
  read: SampleReader;
  cancel: () => void;
}

export function createWorkerReader(spawn: () => Worker, log: (message: string) => void): WorkerReader {
  let running: Worker | null = null;

  const cancel = () => {
    void running?.terminate();
    running = null;
  };

  const read: SampleReader = (filePath, segment) => {
    cancel();
    return new Promise((resolve) => {
      const worker = spawn();
      running = worker;
      let settled = false;
      const finish = (result: AnalysisSamples | null) => {
        if (settled) return;
        settled = true;
        if (running === worker) running = null;
        void worker.terminate();
        resolve(result);
      };
      const fail = (message: string) => {
        log(`Could not read "${filePath}" for chord analysis: ${message}`);
        finish(null);
      };
      worker.once("message", (message: { result?: AnalysisSamples | null; error?: string }) => {
        if (message.error) fail(message.error);
        else finish(message.result ?? null);
      });
      worker.once("error", (err: Error) => fail(err.message));
      worker.once("exit", () => finish(CANCELLED));
      worker.postMessage({ filePath, segment });
    });
  };

  return { read, cancel };
}
