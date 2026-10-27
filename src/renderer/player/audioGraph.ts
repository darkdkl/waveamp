import { audio } from "./dom";
import { state } from "./state";
import { bandFilter, EQ_LAYOUTS, filterGainsFor } from "../../shared/eqCurve";
import { dbToGain } from "./format";
import { logEvent } from "./log";
import chordTapUrl from "./chordTap.worklet.ts?worker&url";

export const audioCtx = new AudioContext();
const sourceNode = audioCtx.createMediaElementSource(audio);
const createFilter = (type: BiquadFilterType, frequency = 1000): BiquadFilterNode => {
  const filter = audioCtx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.gain.value = 0;
  return filter;
};
const fineLayout = EQ_LAYOUTS[19];
const lowShelf = createFilter("lowshelf", bandFilter(fineLayout, 0).frequency);
const highShelf = createFilter("highshelf", bandFilter(fineLayout, fineLayout.frequencies.length - 1).frequency);
const peakNodes = fineLayout.frequencies.map(() => createFilter("peaking"));
const filterNodes = [lowShelf, ...peakNodes, highShelf];
configureEqFilters();
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

const STEREO_BASS_HZ = 150;
const PSEUDO_DELAY_S = 0.012;
const PSEUDO_LOW_HZ = 300;
const PSEUDO_HIGH_HZ = 7000;
const STEREO_RAMP_S = 0.05;

const gainNode = (value: number): GainNode => {
  const node = audioCtx.createGain();
  node.gain.value = value;
  return node;
};

const stereoInput = audioCtx.createGain();
stereoInput.channelCount = 2;
stereoInput.channelCountMode = "explicit";
stereoInput.channelInterpretation = "speakers";
const stereoSplitter = audioCtx.createChannelSplitter(2);
const leftHalf = gainNode(0.5);
const rightHalf = gainNode(0.5);
const rightHalfInverted = gainNode(-1);
const mid = gainNode(1);
const side = gainNode(1);
const sideHighPass = audioCtx.createBiquadFilter();
sideHighPass.type = "highpass";
sideHighPass.frequency.value = STEREO_BASS_HZ;
const sideExtra = gainNode(0);
const pseudoDelay = audioCtx.createDelay(0.05);
pseudoDelay.delayTime.value = PSEUDO_DELAY_S;
const pseudoHighPass = audioCtx.createBiquadFilter();
pseudoHighPass.type = "highpass";
pseudoHighPass.frequency.value = PSEUDO_LOW_HZ;
const pseudoLowPass = audioCtx.createBiquadFilter();
pseudoLowPass.type = "lowpass";
pseudoLowPass.frequency.value = PSEUDO_HIGH_HZ;
const pseudoSide = gainNode(0);
const sideTotal = gainNode(1);
const sideTotalInverted = gainNode(-1);
const outLeft = gainNode(1);
const outRight = gainNode(1);
const stereoMerger = audioCtx.createChannelMerger(2);

stereoInput.connect(stereoSplitter);
stereoSplitter.connect(leftHalf, 0);
stereoSplitter.connect(rightHalf, 1);
leftHalf.connect(mid);
rightHalf.connect(mid);
leftHalf.connect(side);
rightHalf.connect(rightHalfInverted);
rightHalfInverted.connect(side);
side.connect(sideTotal);
side.connect(sideHighPass);
sideHighPass.connect(sideExtra);
sideExtra.connect(sideTotal);
mid.connect(pseudoDelay);
pseudoDelay.connect(pseudoHighPass);
pseudoHighPass.connect(pseudoLowPass);
pseudoLowPass.connect(pseudoSide);
pseudoSide.connect(sideTotal);
mid.connect(outLeft);
sideTotal.connect(outLeft);
mid.connect(outRight);
sideTotal.connect(sideTotalInverted);
sideTotalInverted.connect(outRight);
outLeft.connect(stereoMerger, 0, 0);
outRight.connect(stereoMerger, 0, 1);

audioNode.connect(preampNode);
preampNode.connect(stereoInput);
stereoMerger.connect(volumeNode);
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

export function setStereoWidening(extraSide: number, pseudo: number): void {
  sideExtra.gain.setTargetAtTime(extraSide, audioCtx.currentTime, STEREO_RAMP_S);
  pseudoSide.gain.setTargetAtTime(pseudo, audioCtx.currentTime, STEREO_RAMP_S);
}

export function setVolume(percent: number): void {
  volumeNode.gain.setTargetAtTime(percent / 100, audioCtx.currentTime, 0.015);
}

const EQ_RAMP_S = 0.015;
const EQ_SWITCH_FADE_S = 0.04;
const EQ_SWITCH_GAP_S = 0.001;
let eqSwitchEndsAt = 0;

function bandNode(index: number): BiquadFilterNode {
  const type = bandFilter(EQ_LAYOUTS[state.eqBandCount], index).type;
  if (type === "lowshelf") return lowShelf;
  if (type === "highshelf") return highShelf;
  return peakNodes[index];
}

export function configureEqFilters(): void {
  const layout = EQ_LAYOUTS[state.eqBandCount];
  peakNodes.forEach((filter, i) => {
    filter.frequency.value = layout.frequencies[i] ?? layout.frequencies[0];
    filter.Q.value = layout.q;
  });
  filterNodes.forEach((filter) => {
    filter.gain.value = 0;
  });
}

export function switchEqLayout(): void {
  const layout = EQ_LAYOUTS[state.eqBandCount];
  const now = audioCtx.currentTime;
  eqSwitchEndsAt = now + EQ_SWITCH_FADE_S;
  filterNodes.forEach((filter) => {
    filter.gain.cancelScheduledValues(now);
    filter.gain.setValueAtTime(filter.gain.value, now);
    filter.gain.linearRampToValueAtTime(0, eqSwitchEndsAt);
  });
  peakNodes.forEach((filter, i) => {
    filter.frequency.setValueAtTime(layout.frequencies[i] ?? layout.frequencies[0], eqSwitchEndsAt);
    filter.Q.setValueAtTime(layout.q, eqSwitchEndsAt);
  });
}

export function applyEqState(): void {
  const layout = EQ_LAYOUTS[state.eqBandCount];
  const gains = state.eqBandCount === 19 ? filterGainsFor(layout, state.bandGains, audioCtx.sampleRate) : state.bandGains;
  const start = Math.max(audioCtx.currentTime, eqSwitchEndsAt + EQ_SWITCH_GAP_S);
  const targets = new Map<BiquadFilterNode, number>(filterNodes.map((filter) => [filter, 0]));
  if (state.eqEnabled) gains.forEach((gain, i) => targets.set(bandNode(i), gain));
  targets.forEach((gain, filter) => {
    filter.gain.cancelScheduledValues(start);
    filter.gain.setTargetAtTime(gain, start, EQ_RAMP_S);
  });
  preampNode.gain.cancelScheduledValues(audioCtx.currentTime);
  preampNode.gain.setTargetAtTime(state.eqEnabled ? dbToGain(state.preampDb) : 1, audioCtx.currentTime, EQ_RAMP_S);
}

export function resumeAudioContext(): void {
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch((err) => logEvent("error", "audio-context", err.message));
  }
}

let chordTapModule: Promise<void> | null = null;

export async function startChordTap(onSamples: (samples: Float32Array, sampleRate: number) => void): Promise<() => void> {
  chordTapModule ??= audioCtx.audioWorklet.addModule(chordTapUrl);
  await chordTapModule;
  const tap = new AudioWorkletNode(audioCtx, "chord-tap", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
  const mute = audioCtx.createGain();
  mute.gain.value = 0;
  tap.port.onmessage = (event: MessageEvent<Float32Array>) => onSamples(event.data, audioCtx.sampleRate);
  sourceNode.connect(tap);
  tap.connect(mute);
  mute.connect(audioCtx.destination);
  return () => {
    tap.port.onmessage = null;
    sourceNode.disconnect(tap);
    tap.disconnect();
    mute.disconnect();
  };
}
