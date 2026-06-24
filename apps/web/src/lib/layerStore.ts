/**
 * layerStore.ts
 *
 * Client-side state for the layer list.
 * The engine is authoritative for audio; this store is authoritative for UI state.
 * Every mutation calls the engine and updates local state.
 */

import { writable, derived, get, type Readable } from 'svelte/store';
import { engine } from './engineStore';
import type { LayerId } from './engine';

export interface LayerState {
  id: LayerId;
  name: string;
  volume: number;       // 0.0–1.0
  pan: number;          // -1.0–1.0
  muted: boolean;
  soloed: boolean;
  loopStart: number;    // seconds
  loopEnd: number;      // seconds
  duration: number;     // seconds (full buffer)
  waveformPeaks: Float32Array | null;
  /** Raw audio bytes kept for session export. */
  audioData: Uint8Array;
  /** Original file name (with extension) for format preservation. */
  originalFileName: string;
}

const _layers = writable<LayerState[]>([]);

/** Number of files currently being decoded. Use for loading indicators. */
const _importing = writable(0);

export const layers: Readable<LayerState[]> = derived(_layers, ($l) => $l);
export const importing: Readable<number> = derived(_importing, ($i) => $i);

// ── Shared decode helper ─────────────────────────────────────────────────────

const BUCKET_COUNT = 200;

async function decodeFile(file: File): Promise<LayerState> {
  const ctrl = get(engine);
  if (!ctrl) throw new Error('Engine not ready');

  const arrayBuffer = await file.arrayBuffer();
  // Keep a copy BEFORE transferring ownership to the worklet.
  const audioData = new Uint8Array(arrayBuffer.slice(0));

  const layerId = await ctrl.addLayer(arrayBuffer, file.name);

  const [peakData, duration] = await Promise.all([
    ctrl.getWaveformPeaks(layerId, BUCKET_COUNT),
    ctrl.getLayerDuration(layerId),
  ]);

  return {
    id: layerId,
    name: file.name.replace(/\.[^.]+$/, ''),
    originalFileName: file.name,
    audioData,
    volume: 1.0,
    pan: 0.0,
    muted: false,
    soloed: false,
    loopStart: 0,
    loopEnd: duration,
    duration,
    waveformPeaks: peakData.peaks,
  };
}

// ── Add (append) ─────────────────────────────────────────────────────────────

export async function addLayer(file: File): Promise<void> {
  _importing.update((n) => n + 1);
  try {
    const state = await decodeFile(file);
    _layers.update((ls) => [...ls, state]);
  } finally {
    _importing.update((n) => n - 1);
  }
}

// ── Insert at position ────────────────────────────────────────────────────────

export async function insertLayerAt(file: File, index: number): Promise<void> {
  _importing.update((n) => n + 1);
  try {
    const state = await decodeFile(file);
    _layers.update((ls) => {
      const next = [...ls];
      next.splice(index, 0, state);
      return next;
    });
  } finally {
    _importing.update((n) => n - 1);
  }
}

// ── Replace audio ────────────────────────────────────────────────────────────

/** Drop a new file onto an existing layer to swap its audio while preserving
 *  name, volume, pan, mute, and solo settings. */
export async function replaceLayerAudio(id: LayerId, file: File): Promise<void> {
  const ctrl = get(engine);
  if (!ctrl) throw new Error('Engine not ready');

  const current = get(_layers).find((l) => l.id === id);
  if (!current) return;

  _importing.update((n) => n + 1);
  try {
    // Remove old buffer from engine before adding new one.
    ctrl.removeLayer(id);

    const arrayBuffer = await file.arrayBuffer();
    const audioData = new Uint8Array(arrayBuffer.slice(0));
    const newId = await ctrl.addLayer(arrayBuffer, current.name);

    const [peakData, duration] = await Promise.all([
      ctrl.getWaveformPeaks(newId, BUCKET_COUNT),
      ctrl.getLayerDuration(newId),
    ]);

    // Restore mixer settings on new engine layer.
    ctrl.setLayerVolume(newId, current.volume);
    ctrl.setLayerPan(newId, current.pan);
    ctrl.setLayerMuted(newId, current.muted);
    ctrl.setLayerSoloed(newId, current.soloed);
    ctrl.setLoopRegion(newId, current.loopStart, Math.min(current.loopEnd, duration));

    _layers.update((ls) =>
      ls.map((l) =>
        l.id === id
          ? {
              ...current,
              id: newId,
              audioData,
              originalFileName: file.name,
              duration,
              loopEnd: Math.min(current.loopEnd, duration),
              waveformPeaks: peakData.peaks,
            }
          : l,
      ),
    );
  } finally {
    _importing.update((n) => n - 1);
  }
}

// ── Remove ───────────────────────────────────────────────────────────────────

export function removeLayer(id: LayerId): void {
  get(engine)?.removeLayer(id);
  _layers.update((ls) => ls.filter((l) => l.id !== id));
}

// ── Rename ───────────────────────────────────────────────────────────────────

export function renameLayer(id: LayerId, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  get(engine)?.renameLayer(id, trimmed);
  _layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, name: trimmed } : l)));
}

// ── Reorder (drag-and-drop) ──────────────────────────────────────────────────

export function reorderLayers(fromIndex: number, toIndex: number): void {
  _layers.update((ls) => {
    const next = [...ls];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  });
  // Note: engine layer order is cosmetic in Phase 1 (mix result is the same).
  // Phase 2 will sync order to the engine if scene ordering matters.
}

// ── Per-layer parameters ─────────────────────────────────────────────────────

export function setVolume(id: LayerId, volume: number): void {
  get(engine)?.setLayerVolume(id, volume);
  _layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, volume } : l)));
}

export function setPan(id: LayerId, pan: number): void {
  get(engine)?.setLayerPan(id, pan);
  _layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, pan } : l)));
}

export function setMuted(id: LayerId, muted: boolean): void {
  get(engine)?.setLayerMuted(id, muted);
  _layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, muted } : l)));
}

export function setSoloed(id: LayerId, soloed: boolean): void {
  get(engine)?.setLayerSoloed(id, soloed);
  _layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, soloed } : l)));
}

export function setLoopRegion(id: LayerId, loopStart: number, loopEnd: number): void {
  get(engine)?.setLoopRegion(id, loopStart, loopEnd);
  _layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, loopStart, loopEnd } : l)));
}

// ── Session load helpers ──────────────────────────────────────────────────────

/** Remove all layers from the engine and clear the store. */
export function clearAllLayers(): void {
  const ctrl = get(engine);
  get(_layers).forEach((l) => ctrl?.removeLayer(l.id));
  _layers.set([]);
}

export interface RestoredLayerSettings {
  name: string;
  originalFileName: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  loopStart: number;
  loopEnd: number;
}

/** Add a layer directly from raw bytes + saved settings (used when loading .loopfw). */
export async function addLayerFromBytes(
  audioData: Uint8Array,
  settings: RestoredLayerSettings,
): Promise<void> {
  const ctrl = get(engine);
  if (!ctrl) throw new Error('Engine not ready');

  _importing.update((n) => n + 1);
  try {
    const buf = audioData.buffer.slice(
      audioData.byteOffset,
      audioData.byteOffset + audioData.byteLength,
    ) as ArrayBuffer;
    const copy = new Uint8Array(buf.slice(0));

    const layerId = await ctrl.addLayer(buf, settings.originalFileName);

    const [peakData, duration] = await Promise.all([
      ctrl.getWaveformPeaks(layerId, BUCKET_COUNT),
      ctrl.getLayerDuration(layerId),
    ]);

    const clampedEnd = Math.min(settings.loopEnd, duration);
    ctrl.setLayerVolume(layerId, settings.volume);
    ctrl.setLayerPan(layerId, settings.pan);
    ctrl.setLayerMuted(layerId, settings.muted);
    ctrl.setLayerSoloed(layerId, settings.soloed);
    ctrl.setLoopRegion(layerId, settings.loopStart, clampedEnd);

    _layers.update((ls) => [
      ...ls,
      {
        id: layerId,
        name: settings.name,
        originalFileName: settings.originalFileName,
        audioData: copy,
        volume: settings.volume,
        pan: settings.pan,
        muted: settings.muted,
        soloed: settings.soloed,
        loopStart: settings.loopStart,
        loopEnd: clampedEnd,
        duration,
        waveformPeaks: peakData.peaks,
      },
    ]);
  } finally {
    _importing.update((n) => n - 1);
  }
}
