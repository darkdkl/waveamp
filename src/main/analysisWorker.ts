import { parentPort } from "node:worker_threads";
import { readAnalysisSamples } from "./analysisAudio";
import type { AudioSegment } from "../shared/types";

parentPort?.once("message", async ({ filePath, segment }: { filePath: string; segment: AudioSegment }) => {
  try {
    const result = await readAnalysisSamples(filePath, segment);
    parentPort?.postMessage({ result }, result?.ok ? [result.samples.buffer as ArrayBuffer] : []);
  } catch (err) {
    parentPort?.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
});
