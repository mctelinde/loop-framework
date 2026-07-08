/**
 * recordingStore.ts
 *
 * Manages recording configuration including measure-based limits.
 * Handles BPM/time-signature calculations and user preferences.
 */

import { writable, derived, get, type Readable } from 'svelte/store';
import { bpm, timeSig } from './transportStore';

export type RecordingMode = 'measures' | 'time';
export type QuantizeMode = 'off' | 'beat' | 'eighth' | 'sixteenth';
export type QuantizeStrength = 'light' | 'medium' | 'hard';

export interface RecordingConfig {
  mode: RecordingMode;
  measureCount: number;
  timeBased: number; // fallback duration in seconds
  quantizeMode: QuantizeMode;
  quantizeStrength: QuantizeStrength;
  /** Input latency compensation in milliseconds (positive = shift strokes earlier). */
  latencyOffsetMs: number;
}

// Default 8 measures recording
const DEFAULT_MEASURE_COUNT = 8;
const STORAGE_KEY = 'lf-recording-measure-count';
const QUANTIZE_MODE_KEY = 'lf-quantize-mode';
const QUANTIZE_STRENGTH_KEY = 'lf-quantize-strength';
const LATENCY_OFFSET_KEY = 'lf-latency-offset-ms';

const _config = writable<RecordingConfig>({
  mode: 'measures',
  measureCount: loadSavedMeasureCount(),
  timeBased: 30,
  quantizeMode: loadSavedQuantizeMode(),
  quantizeStrength: loadSavedQuantizeStrength(),
  latencyOffsetMs: loadSavedLatencyOffsetMs(),
});

export const recordingConfig: Readable<RecordingConfig> = derived(_config, ($c) => $c);

/**
 * Load persisted measure count from localStorage
 */
function loadSavedMeasureCount(): number {
  if (typeof window === 'undefined') return DEFAULT_MEASURE_COUNT;
  const saved = localStorage.getItem(STORAGE_KEY);
  const parsed = saved ? parseInt(saved, 10) : null;
  return parsed && parsed >= 1 && parsed <= 64 ? parsed : DEFAULT_MEASURE_COUNT;
}

/**
 * Save measure count preference
 */
function saveMeasureCount(count: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(count));
  }
}

function loadSavedQuantizeMode(): QuantizeMode {
  if (typeof window === 'undefined') return 'sixteenth';
  const saved = localStorage.getItem(QUANTIZE_MODE_KEY);
  if (saved === 'off' || saved === 'beat' || saved === 'eighth' || saved === 'sixteenth') {
    return saved;
  }
  return 'sixteenth';
}

function saveQuantizeMode(mode: QuantizeMode): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(QUANTIZE_MODE_KEY, mode);
  }
}

function loadSavedQuantizeStrength(): QuantizeStrength {
  if (typeof window === 'undefined') return 'medium';
  const saved = localStorage.getItem(QUANTIZE_STRENGTH_KEY);
  if (saved === 'light' || saved === 'medium' || saved === 'hard') return saved;
  return 'medium';
}

function saveQuantizeStrength(strength: QuantizeStrength): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(QUANTIZE_STRENGTH_KEY, strength);
  }
}

function loadSavedLatencyOffsetMs(): number {
  if (typeof window === 'undefined') return 0;
  const saved = localStorage.getItem(LATENCY_OFFSET_KEY);
  const parsed = saved !== null ? parseFloat(saved) : NaN;
  return isFinite(parsed) ? Math.max(-200, Math.min(200, parsed)) : 0;
}

/**
 * Set number of measures for recording
 */
export function setMeasureCount(count: number): void {
  const clamped = Math.max(1, Math.min(64, Math.round(count)));
  _config.update((c) => ({ ...c, measureCount: clamped }));
  saveMeasureCount(clamped);
}

/**
 * Set recording mode (measures or time-based)
 */
export function setRecordingMode(mode: RecordingMode): void {
  _config.update((c) => ({ ...c, mode }));
}

export function setQuantizeMode(mode: QuantizeMode): void {
  _config.update((c) => ({ ...c, quantizeMode: mode }));
  saveQuantizeMode(mode);
}

export function setQuantizeStrength(strength: QuantizeStrength): void {
  _config.update((c) => ({ ...c, quantizeStrength: strength }));
  saveQuantizeStrength(strength);
}

export function setLatencyOffsetMs(ms: number): void {
  const clamped = Math.max(-200, Math.min(200, Math.round(ms)));
  _config.update((c) => ({ ...c, latencyOffsetMs: clamped }));
  if (typeof window !== 'undefined') {
    localStorage.setItem(LATENCY_OFFSET_KEY, String(clamped));
  }
}

function quantizeStrengthValue(strength: QuantizeStrength): number {
  if (strength === 'light') return 0.45;
  if (strength === 'hard') return 1;
  return 0.75;
}

export function quantizeTime(seconds: number): number {
  const config = get(_config);
  if (config.quantizeMode === 'off') return Math.max(0, seconds);
  const currentBpm = get(bpm);
  if (!currentBpm || currentBpm <= 0) return Math.max(0, seconds);

  const beat = 60 / currentBpm;
  const step =
    config.quantizeMode === 'beat'
      ? beat
      : config.quantizeMode === 'eighth'
        ? beat / 2
        : beat / 4;

  if (step <= 0) return Math.max(0, seconds);
  const nearest = Math.round(seconds / step) * step;
  const strength = quantizeStrengthValue(config.quantizeStrength);
  return Math.max(0, seconds + (nearest - seconds) * strength);
}

/**
 * Calculate the duration of one measure in seconds
 * Formula: (60 / BPM) * beatsPerMeasure
 */
export function calculateMeasureDuration(): number {
  const currentBpm = get(bpm);
  const currentTimeSig = get(timeSig);
  
  if (!currentBpm || !currentTimeSig) return 0;
  
  const secondsPerBeat = 60 / currentBpm;
  return secondsPerBeat * currentTimeSig.beatsPerBar;
}

/**
 * Calculate total recording duration in seconds based on measure count
 */
export function calculateRecordingDuration(): number {
  const config = get(_config);
  if (config.mode === 'time') {
    return config.timeBased;
  }
  
  const measureDuration = calculateMeasureDuration();
  return measureDuration * config.measureCount;
}

/**
 * Calculate current measure number based on elapsed time
 * Returns 1-indexed measure number (1-based, not 0-based)
 */
export function calculateCurrentMeasure(elapsedSeconds: number): number {
  const measureDuration = calculateMeasureDuration();
  if (measureDuration <= 0) return 1;
  
  return Math.floor(elapsedSeconds / measureDuration) + 1;
}

/**
 * Check if recording should stop (reached end of last measure)
 */
export function shouldStopRecording(elapsedSeconds: number): boolean {
  const config = get(_config);
  if (config.mode === 'time') {
    return elapsedSeconds >= config.timeBased;
  }
  
  const measureDuration = calculateMeasureDuration();
  const totalDuration = measureDuration * config.measureCount;
  
  return elapsedSeconds >= totalDuration;
}

/**
 * Format recording progress for display (e.g., "Measure 3 of 8")
 */
export function formatRecordingProgress(elapsedSeconds: number): string {
  const config = get(_config);
  if (config.mode === 'time') {
    const secs = Math.floor(elapsedSeconds);
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  }
  
  const currentMeasure = calculateCurrentMeasure(elapsedSeconds);
  const clamped = Math.min(currentMeasure, config.measureCount);
  
  return `Measure ${clamped} of ${config.measureCount}`;
}
