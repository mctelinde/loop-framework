import { quantizeTime } from './recordingStore';
import { bpm } from './transportStore';
import { get } from 'svelte/store';
import type { DrumStroke } from './layerStore';

export interface DrumPadKey {
  index: number;
  label: string;
  color: string;
}

export const DRUM_PAD_KEYS: DrumPadKey[] = [
  { index: 0, label: 'K', color: '#ef5350' },
  { index: 1, label: 'S', color: '#ffa726' },
  { index: 2, label: 'CH', color: '#ffee58' },
  { index: 3, label: 'OH', color: '#9ccc65' },
  { index: 4, label: 'T1', color: '#26c6da' },
  { index: 5, label: 'T2', color: '#42a5f5' },
  { index: 6, label: 'CP', color: '#7e57c2' },
  { index: 7, label: 'RD', color: '#ec407a' },
];

export function quantizeStrokes(strokes: DrumStroke[]): DrumStroke[] {
  return strokes
    .map((stroke) => ({
      ...stroke,
      time: quantizeTime(stroke.time),
    }))
    .sort((a, b) => a.time - b.time);
}

function createNoiseBuffer(ctx: AudioContext, durationSeconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** One reusable white-noise buffer per AudioContext (white noise is stationary). */
const _noiseBufferCache = new WeakMap<AudioContext, AudioBuffer>();

function getOrCreateNoiseBuffer(ctx: AudioContext): AudioBuffer {
  let buf = _noiseBufferCache.get(ctx);
  if (!buf) {
    buf = createNoiseBuffer(ctx, 0.4);
    _noiseBufferCache.set(ctx, buf);
  }
  return buf;
}

/**
 * Pre-warm the noise buffer cache for a given AudioContext.
 * Call this just before starting a recording session to ensure the first
 * hit avoids the one-time allocation cost.
 */
export function preWarmDrumAudioCache(ctx: AudioContext): void {
  getOrCreateNoiseBuffer(ctx);
}

export function triggerDrumPadHit(
  ctx: AudioContext,
  keyIndex: number,
  velocity = 1,
  time = ctx.currentTime,
): void {
  const v = Math.max(0.1, Math.min(1.5, velocity));
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(ctx.destination);

  const noise = () => {
    const src = ctx.createBufferSource();
    src.buffer = getOrCreateNoiseBuffer(ctx);
    return src;
  };

  if (keyIndex === 0) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.15);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.8 * v, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(gain).connect(out);
    osc.start(time);
    osc.stop(time + 0.22);
    return;
  }

  if (keyIndex === 1 || keyIndex === 6) {
    const src = noise();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = keyIndex === 1 ? 1800 : 2200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.45 * v, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    src.connect(filter).connect(gain).connect(out);
    src.start(time);
    src.stop(time + 0.2);
    return;
  }

  if (keyIndex === 2 || keyIndex === 3 || keyIndex === 7) {
    const src = noise();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = keyIndex === 3 ? 5500 : 7000;
    const gain = ctx.createGain();
    const decay = keyIndex === 3 ? 0.35 : 0.12;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.28 * v, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    src.connect(filter).connect(gain).connect(out);
    src.start(time);
    src.stop(time + decay + 0.03);
    return;
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(keyIndex === 4 ? 180 : 130, time);
  osc.frequency.exponentialRampToValueAtTime(keyIndex === 4 ? 95 : 70, time + 0.2);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.35 * v, time + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.26);
  osc.connect(gain).connect(out);
  osc.start(time);
  osc.stop(time + 0.28);
}

function renderHit(buffer: Float32Array, sampleRate: number, stroke: DrumStroke): void {
  const start = Math.floor(stroke.time * sampleRate);
  const v = Math.max(0.1, Math.min(1.25, stroke.velocity));
  const maxSamples = buffer.length - start;
  if (maxSamples <= 0) return;

  // Exponential ramp helper matching Web Audio's exponentialRampToValueAtTime:
  // f(t) = a * (b/a)^(t/T)
  const expRamp = (a: number, b: number, t: number, T: number) =>
    t <= 0 ? a : t >= T ? b : a * Math.pow(b / a, t / T);

  switch (stroke.padIndex) {
    case 0: { // Kick: sine sweep 140→45 Hz over 150ms, 4ms attack / 200ms decay
      const peak = 0.8 * v;
      const limit = Math.min(maxSamples, Math.ceil(0.23 * sampleRate));
      let phase = 0;
      for (let i = 0; i < limit; i++) {
        const t = i / sampleRate;
        const freq = t < 0.15 ? expRamp(140, 45, t, 0.15) : 45;
        phase += (2 * Math.PI * freq) / sampleRate;
        const env = t < 0.004
          ? expRamp(0.0001, peak, t, 0.004)
          : expRamp(peak, 0.0001, t - 0.004, 0.196);
        buffer[start + i] = Math.max(-1, Math.min(1, buffer[start + i] + Math.sin(phase) * env));
      }
      break;
    }
    case 1: // Snare
    case 6: { // Clap: bandpass noise at 1800/2200 Hz
      const cf = stroke.padIndex === 1 ? 1800 : 2200;
      const peak = 0.45 * v;
      const limit = Math.min(maxSamples, Math.ceil(0.22 * sampleRate));
      // Difference-of-lowpass approximates bandpass
      let lp1 = 0, lp2 = 0;
      const a1 = Math.exp((-2 * Math.PI * cf * 2) / sampleRate);
      const a2 = Math.exp((-2 * Math.PI * cf * 0.5) / sampleRate);
      for (let i = 0; i < limit; i++) {
        const t = i / sampleRate;
        const env = t < 0.005
          ? expRamp(0.0001, peak, t, 0.005)
          : expRamp(peak, 0.0001, t - 0.005, 0.175);
        const noise = Math.random() * 2 - 1;
        lp1 = a1 * lp1 + (1 - a1) * noise;
        lp2 = a2 * lp2 + (1 - a2) * noise;
        buffer[start + i] = Math.max(-1, Math.min(1, buffer[start + i] + (lp2 - lp1) * 4 * env));
      }
      break;
    }
    case 2: // Closed hi-hat
    case 3: // Open hi-hat
    case 7: { // Ride: first-order highpass noise
      const hpCutoff = stroke.padIndex === 3 ? 5500 : 7000;
      const decay = stroke.padIndex === 3 ? 0.35 : 0.12;
      const peak = 0.28 * v;
      const limit = Math.min(maxSamples, Math.ceil((decay + 0.05) * sampleRate));
      const alpha = Math.exp((-2 * Math.PI * hpCutoff) / sampleRate);
      let y = 0, xPrev = 0;
      for (let i = 0; i < limit; i++) {
        const t = i / sampleRate;
        const env = t < 0.002
          ? expRamp(0.0001, peak, t, 0.002)
          : expRamp(peak, 0.0001, t - 0.002, decay);
        const x = Math.random() * 2 - 1;
        y = alpha * (y + x - xPrev); // 1-pole highpass: y[n] = α(y[n-1] + x[n] - x[n-1])
        xPrev = x;
        buffer[start + i] = Math.max(-1, Math.min(1, buffer[start + i] + y * env));
      }
      break;
    }
    default: { // Toms (4, 5): sine sweep matching live oscillator
      const baseFreq = stroke.padIndex === 4 ? 180 : 130;
      const endFreq = stroke.padIndex === 4 ? 95 : 70;
      const peak = 0.35 * v;
      const limit = Math.min(maxSamples, Math.ceil(0.3 * sampleRate));
      let phase = 0;
      for (let i = 0; i < limit; i++) {
        const t = i / sampleRate;
        const freq = t < 0.2 ? expRamp(baseFreq, endFreq, t, 0.2) : endFreq;
        phase += (2 * Math.PI * freq) / sampleRate;
        const env = t < 0.006
          ? expRamp(0.0001, peak, t, 0.006)
          : expRamp(peak, 0.0001, t - 0.006, 0.254);
        buffer[start + i] = Math.max(-1, Math.min(1, buffer[start + i] + Math.sin(phase) * env));
      }
    }
  }
}

function pcm16FromFloat(data: Float32Array): Int16Array {
  const out = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function renderDrumStrokesToWav(strokes: DrumStroke[], targetDuration?: number): Uint8Array {
  const sampleRate = 44_100;
  const beatSeconds = 60 / Math.max(1, get(bpm));
  const minDuration = beatSeconds * 4;
  const maxTime = strokes.reduce((m, s) => Math.max(m, s.time), 0);
  // Honour the caller's target duration (measure-snapped) so all drum takes share
  // the same loop length and stay in sync on playback.
  const duration = targetDuration ?? Math.max(minDuration, maxTime + 1);

  const mono = new Float32Array(Math.ceil(duration * sampleRate));
  for (const stroke of strokes) renderHit(mono, sampleRate, stroke);

  const pcm16 = pcm16FromFloat(mono);
  const dataLength = pcm16.byteLength;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  view.setUint32(0, 0x46464952, true);
  view.setUint32(4, 36 + dataLength, true);
  view.setUint32(8, 0x45564157, true);
  view.setUint32(12, 0x20746d66, true);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x61746164, true);
  view.setUint32(40, dataLength, true);

  new Int16Array(buffer, 44, pcm16.length).set(pcm16);
  return new Uint8Array(buffer);
}
