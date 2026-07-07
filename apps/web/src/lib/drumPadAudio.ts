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
    src.buffer = createNoiseBuffer(ctx, 0.2);
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
  osc.type = 'triangle';
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

  for (let i = 0; i < sampleRate * 0.4; i++) {
    const index = start + i;
    if (index >= buffer.length) break;
    const t = i / sampleRate;

    let s = 0;
    switch (stroke.padIndex) {
      case 0: {
        const freq = 160 * Math.exp(-18 * t) + 38;
        const env = Math.exp(-16 * t);
        s = Math.sin(2 * Math.PI * freq * t) * env;
        break;
      }
      case 1:
      case 6: {
        const env = Math.exp(-18 * t);
        s = (Math.random() * 2 - 1) * env;
        break;
      }
      case 2:
      case 3:
      case 7: {
        const env = Math.exp(-(stroke.padIndex === 3 ? 9 : 20) * t);
        s = (Math.random() * 2 - 1) * env * 0.65;
        break;
      }
      default: {
        const base = stroke.padIndex === 4 ? 180 : 140;
        const env = Math.exp(-10 * t);
        s = Math.sin(2 * Math.PI * base * t) * env;
      }
    }

    buffer[index] = Math.max(-1, Math.min(1, buffer[index] + s * 0.55 * v));
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

export function renderDrumStrokesToWav(strokes: DrumStroke[]): Uint8Array {
  const sampleRate = 44_100;
  const beatSeconds = 60 / Math.max(1, get(bpm));
  const minDuration = beatSeconds * 4;
  const maxTime = strokes.reduce((m, s) => Math.max(m, s.time), 0);
  const duration = Math.max(minDuration, maxTime + 1);

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
