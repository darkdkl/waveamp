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
