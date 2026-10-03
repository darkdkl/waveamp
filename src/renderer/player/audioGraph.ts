import { audio } from "./dom";
import { state } from "./state";
import { EQ_BANDS } from "./eqPresets";
import { dbToGain } from "./format";
import { logEvent } from "./log";

export const audioCtx = new AudioContext();
const sourceNode = audioCtx.createMediaElementSource(audio);
const filterNodes = EQ_BANDS.map((freq) => {
  const filter = audioCtx.createBiquadFilter();
  filter.type = "peaking";
  filter.frequency.value = freq;
  filter.Q.value = 1;
  filter.gain.value = 0;
  return filter;
});
const preampNode = audioCtx.createGain();
export const analyserNode = audioCtx.createAnalyser();
analyserNode.fftSize = 256;
analyserNode.smoothingTimeConstant = 0;

let audioNode: AudioNode = sourceNode;
filterNodes.forEach((filter) => {
  audioNode.connect(filter);
  audioNode = filter;
});
const volumeNode = audioCtx.createGain();

audioNode.connect(preampNode);
preampNode.connect(volumeNode);
volumeNode.connect(audioCtx.destination);
sourceNode.connect(analyserNode);

// A splitter's interpretation is fixed to "discrete"; this node upmixes mono so both needles move.
const meterStereoNode = audioCtx.createGain();
meterStereoNode.channelCount = 2;
meterStereoNode.channelCountMode = "explicit";
meterStereoNode.channelInterpretation = "speakers";
const channelSplitter = audioCtx.createChannelSplitter(2);
export const meterAnalysers = [audioCtx.createAnalyser(), audioCtx.createAnalyser()];
sourceNode.connect(meterStereoNode);
meterStereoNode.connect(channelSplitter);
meterAnalysers.forEach((analyser, channel) => {
  analyser.fftSize = 2048;
  channelSplitter.connect(analyser, channel);
});

export function setVolume(percent: number): void {
  volumeNode.gain.setTargetAtTime(percent / 100, audioCtx.currentTime, 0.015);
}

export function applyEqState(): void {
  filterNodes.forEach((filter, i) => {
    filter.gain.value = state.eqEnabled ? state.bandGains[i] : 0;
  });
  preampNode.gain.value = state.eqEnabled ? dbToGain(state.preampDb) : 1;
}

export function resumeAudioContext(): void {
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch((err) => logEvent("error", "audio-context", err.message));
  }
}
