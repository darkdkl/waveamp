import type { Worker } from "node:worker_threads";
import createAnalysisWorker from "./analysisWorker?nodeWorker";
import { writeLog } from "./logging";
import type { AnalysisSamples, SampleReader } from "./analysisAudio";

const CANCELLED = { ok: false, error: "failed" } as const;

let running: Worker | null = null;

export function cancelAnalysisRead(): void {
  void running?.terminate();
  running = null;
}

export const readSamplesInWorker: SampleReader = (filePath, segment) => {
  cancelAnalysisRead();
  return new Promise((resolve) => {
    const worker = createAnalysisWorker({});
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
      writeLog("warn", "chords", `Could not read "${filePath}" for chord analysis: ${message}`);
      finish(null);
    };
    worker.once("message", (message: { result?: AnalysisSamples | null; error?: string }) => {
      if (message.error) fail(message.error);
      else finish(message.result ?? null);
    });
    worker.once("error", (err) => fail(err.message));
    worker.once("exit", () => finish(CANCELLED));
    worker.postMessage({ filePath, segment });
  });
};
