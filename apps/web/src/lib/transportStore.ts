/**
 * transportStore.ts
 *
 * Single source of truth for transport state, BPM, and time signature.
 * All mutations go through these functions so the engine and UI stay in sync.
 */

import { writable, derived, get, type Readable } from 'svelte/store';
import { engine } from './engineStore';

export type TransportState = 'stopped' | 'playing' | 'paused';

export interface TimeSignature {
  beatsPerBar: number;
  beatUnit: number; // denominator: 4 = quarter note, 8 = eighth note
  label: string;
}

export const TIME_SIGNATURES: TimeSignature[] = [
  { beatsPerBar: 4, beatUnit: 4, label: '4/4' },
  { beatsPerBar: 3, beatUnit: 4, label: '3/4' },
  { beatsPerBar: 6, beatUnit: 8, label: '6/8' },
];

const _state = writable<TransportState>('stopped');
const _bpm = writable<number>(120);
const _timeSig = writable<TimeSignature>(TIME_SIGNATURES[0]);

export const transportState: Readable<TransportState> = derived(_state, ($s) => $s);
export const bpm: Readable<number> = derived(_bpm, ($b) => $b);
export const timeSig: Readable<TimeSignature> = derived(_timeSig, ($t) => $t);

export function play(): void {
  get(engine)?.play();
  _state.set('playing');
}

export function pause(): void {
  get(engine)?.pause();
  _state.set('paused');
}

export function stop(): void {
  get(engine)?.stop();
  _state.set('stopped');
}

export function setBpm(value: number): void {
  const clamped = Math.round(Math.max(40, Math.min(240, value)));
  _bpm.set(clamped);
  get(engine)?.setBpm(clamped);
}

export function setTimeSig(sig: TimeSignature): void {
  _timeSig.set(sig);
  get(engine)?.setBeatsPerBar(sig.beatsPerBar);
}

// ── Tap Tempo ───────────────────────────────────────────────────────────────

const MAX_TAPS = 8;
const TAP_TIMEOUT_MS = 3000;

let tapTimes: number[] = [];

export function tap(): void {
  const now = performance.now();

  // Reset if too long since last tap.
  if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > TAP_TIMEOUT_MS) {
    tapTimes = [];
  }

  tapTimes.push(now);
  if (tapTimes.length > MAX_TAPS) tapTimes.shift();
  if (tapTimes.length < 2) return;

  const intervals = tapTimes.slice(1).map((t, i) => t - tapTimes[i]);
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  setBpm(Math.round(60_000 / avg));
}
