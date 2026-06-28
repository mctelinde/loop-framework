/**
 * recordingStore.ts
 *
 * Manages recording configuration including measure-based limits.
 * Handles BPM/time-signature calculations and user preferences.
 */

import { writable, derived, get, type Readable } from 'svelte/store';
import { bpm, timeSig } from './transportStore';

export type RecordingMode = 'measures' | 'time';

export interface RecordingConfig {
  mode: RecordingMode;
  measureCount: number;
  timeBased: number; // fallback duration in seconds
}

// Default 8 measures recording
const DEFAULT_MEASURE_COUNT = 8;
const STORAGE_KEY = 'lf-recording-measure-count';

const _config = writable<RecordingConfig>({
  mode: 'measures',
  measureCount: loadSavedMeasureCount(),
  timeBased: 30,
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
