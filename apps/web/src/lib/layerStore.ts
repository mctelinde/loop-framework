/**
 * layerStore.ts
 *
 * Client-side state for the layer list.
 * The engine is authoritative for audio; this store is authoritative for UI state.
 */

import { writable, derived, get, type Readable } from 'svelte/store';
import { engine } from './engineStore';
import type { LayerId as EngineLayerId } from './engine';

export type LayerId = string;
export type LayerType = 'audio' | 'drumPad';

export interface DrumStroke {
  padIndex: number;
  time: number;
  velocity: number;
}

interface BaseLayerState {
  id: LayerId;
  type: LayerType;
  name: string;
  volume: number;       // 0.0-1.0
  pan: number;          // -1.0-1.0
  muted: boolean;
  soloed: boolean;
}

export interface AudioLayerState extends BaseLayerState {
  type: 'audio';
  engineLayerId: EngineLayerId;
  loopStart: number;    // seconds
  loopEnd: number;      // seconds
  duration: number;     // seconds (full buffer)
  waveformPeaks: Float32Array | null;
  audioData: Uint8Array;
  originalFileName: string;
}

export interface DrumPadLayerState extends BaseLayerState {
  type: 'drumPad';
  strokes: DrumStroke[];
}

export type LayerState = AudioLayerState | DrumPadLayerState;

const _layers = writable<LayerState[]>([]);
const _importing = writable(0);
let nextUiLayerId = 1;

export const layers: Readable<LayerState[]> = derived(_layers, ($l) => $l);
export const importing: Readable<number> = derived(_importing, ($i) => $i);

const BUCKET_COUNT = 200;

function createUiLayerId(): LayerId {
  const id = `layer-${nextUiLayerId}`;
  nextUiLayerId += 1;
  return id;
}

function makeBase(name: string): Omit<BaseLayerState, 'id' | 'type'> {
  return {
    name,
    volume: 1.0,
    pan: 0.0,
    muted: false,
    soloed: false,
  };
}

function findLayer(id: LayerId): LayerState | undefined {
  return get(_layers).find((l) => l.id === id);
}

function withAudioEngineId(layer: LayerState): EngineLayerId | null {
  return layer.type === 'audio' ? layer.engineLayerId : null;
}

async function decodeFile(file: File): Promise<AudioLayerState> {
  const ctrl = get(engine);
  if (!ctrl) throw new Error('Engine not ready');

  const arrayBuffer = await file.arrayBuffer();
  const audioData = new Uint8Array(arrayBuffer.slice(0));

  const engineLayerId = await ctrl.addLayer(arrayBuffer, file.name);

  const [peakData, duration] = await Promise.all([
    ctrl.getWaveformPeaks(engineLayerId, BUCKET_COUNT),
    ctrl.getLayerDuration(engineLayerId),
  ]);

  return {
    id: createUiLayerId(),
    type: 'audio',
    ...makeBase(file.name.replace(/\.[^.]+$/, '')),
    originalFileName: file.name,
    audioData,
    engineLayerId,
    loopStart: 0,
    loopEnd: duration,
    duration,
    waveformPeaks: peakData.peaks,
  };
}

export async function addLayer(file: File): Promise<void> {
  _importing.update((n) => n + 1);
  try {
    const state = await decodeFile(file);
    _layers.update((ls) => [...ls, state]);
  } finally {
    _importing.update((n) => n - 1);
  }
}

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

export function addDrumPadLayer(): void {
  const count = get(_layers).filter((l) => l.type === 'drumPad').length + 1;
  const layer: DrumPadLayerState = {
    id: createUiLayerId(),
    type: 'drumPad',
    ...makeBase(`Drum Pad ${count}`),
    strokes: [],
  };
  _layers.update((ls) => [...ls, layer]);
}

export function updateDrumPadStrokes(id: LayerId, strokes: DrumStroke[]): void {
  _layers.update((ls) =>
    ls.map((layer) =>
      layer.id === id && layer.type === 'drumPad'
        ? { ...layer, strokes }
        : layer,
    ),
  );
}

export async function replaceLayerAudio(id: LayerId, file: File): Promise<void> {
  const ctrl = get(engine);
  if (!ctrl) throw new Error('Engine not ready');

  const current = findLayer(id);
  if (!current || current.type !== 'audio') return;

  _importing.update((n) => n + 1);
  try {
    ctrl.removeLayer(current.engineLayerId);

    const arrayBuffer = await file.arrayBuffer();
    const audioData = new Uint8Array(arrayBuffer.slice(0));
    const newEngineId = await ctrl.addLayer(arrayBuffer, current.name);

    const [peakData, duration] = await Promise.all([
      ctrl.getWaveformPeaks(newEngineId, BUCKET_COUNT),
      ctrl.getLayerDuration(newEngineId),
    ]);

    ctrl.setLayerVolume(newEngineId, current.volume);
    ctrl.setLayerPan(newEngineId, current.pan);
    ctrl.setLayerMuted(newEngineId, current.muted);
    ctrl.setLayerSoloed(newEngineId, current.soloed);
    ctrl.setLoopRegion(newEngineId, current.loopStart, Math.min(current.loopEnd, duration));

    _layers.update((ls) =>
      ls.map((layer) =>
        layer.id === id && layer.type === 'audio'
          ? {
              ...layer,
              audioData,
              originalFileName: file.name,
              engineLayerId: newEngineId,
              duration,
              loopEnd: Math.min(layer.loopEnd, duration),
              waveformPeaks: peakData.peaks,
            }
          : layer,
      ),
    );
  } finally {
    _importing.update((n) => n - 1);
  }
}

export function removeLayer(id: LayerId): void {
  const layer = findLayer(id);
  if (!layer) return;
  const engineLayerId = withAudioEngineId(layer);
  if (engineLayerId !== null) get(engine)?.removeLayer(engineLayerId);
  _layers.update((ls) => ls.filter((l) => l.id !== id));
}

export function renameLayer(id: LayerId, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const layer = findLayer(id);
  if (!layer) return;
  const engineLayerId = withAudioEngineId(layer);
  if (engineLayerId !== null) get(engine)?.renameLayer(engineLayerId, trimmed);
  _layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, name: trimmed } : l)));
}

export function reorderLayers(fromIndex: number, toIndex: number): void {
  _layers.update((ls) => {
    const next = [...ls];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  });
}

export function setVolume(id: LayerId, volume: number): void {
  const layer = findLayer(id);
  if (!layer) return;
  const engineLayerId = withAudioEngineId(layer);
  if (engineLayerId !== null) get(engine)?.setLayerVolume(engineLayerId, volume);
  _layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, volume } : l)));
}

export function setPan(id: LayerId, pan: number): void {
  const layer = findLayer(id);
  if (!layer) return;
  const engineLayerId = withAudioEngineId(layer);
  if (engineLayerId !== null) get(engine)?.setLayerPan(engineLayerId, pan);
  _layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, pan } : l)));
}

export function setMuted(id: LayerId, muted: boolean): void {
  const layer = findLayer(id);
  if (!layer) return;
  const engineLayerId = withAudioEngineId(layer);
  if (engineLayerId !== null) get(engine)?.setLayerMuted(engineLayerId, muted);
  _layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, muted } : l)));
}

export function setSoloed(id: LayerId, soloed: boolean): void {
  const layer = findLayer(id);
  if (!layer) return;
  const engineLayerId = withAudioEngineId(layer);
  if (engineLayerId !== null) get(engine)?.setLayerSoloed(engineLayerId, soloed);
  _layers.update((ls) => ls.map((l) => (l.id === id ? { ...l, soloed } : l)));
}

export function setLoopRegion(id: LayerId, loopStart: number, loopEnd: number): void {
  const layer = findLayer(id);
  if (!layer || layer.type !== 'audio') return;
  get(engine)?.setLoopRegion(layer.engineLayerId, loopStart, loopEnd);
  _layers.update((ls) =>
    ls.map((l) => (l.id === id && l.type === 'audio' ? { ...l, loopStart, loopEnd } : l)),
  );
}

export function clearAllLayers(): void {
  const ctrl = get(engine);
  get(_layers).forEach((layer) => {
    if (layer.type === 'audio') ctrl?.removeLayer(layer.engineLayerId);
  });
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

    const engineLayerId = await ctrl.addLayer(buf, settings.originalFileName);

    const [peakData, duration] = await Promise.all([
      ctrl.getWaveformPeaks(engineLayerId, BUCKET_COUNT),
      ctrl.getLayerDuration(engineLayerId),
    ]);

    const clampedEnd = Math.min(settings.loopEnd, duration);
    ctrl.setLayerVolume(engineLayerId, settings.volume);
    ctrl.setLayerPan(engineLayerId, settings.pan);
    ctrl.setLayerMuted(engineLayerId, settings.muted);
    ctrl.setLayerSoloed(engineLayerId, settings.soloed);
    ctrl.setLoopRegion(engineLayerId, settings.loopStart, clampedEnd);

    _layers.update((ls) => [
      ...ls,
      {
        id: createUiLayerId(),
        type: 'audio',
        name: settings.name,
        originalFileName: settings.originalFileName,
        audioData: copy,
        engineLayerId,
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
