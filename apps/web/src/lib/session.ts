/**
 * session.ts
 *
 * Save and load Loop Framework sessions as `.loopfw` files (ZIP archives).
 *
 * Archive layout:
 *   project.json          – metadata, BPM, layer settings
 *   audio/0-kick.wav      – audio files, indexed to avoid name collisions
 *
 * Auto-save: project.json metadata is written to localStorage on every
 * meaningful change.  Audio is not included (too large); on recovery the
 * user sees layer placeholders but must re-import audio manually.
 */

import { zip, unzip, strToU8, strFromU8 } from 'fflate';
import { get } from 'svelte/store';
import { layers, clearAllLayers, addLayerFromBytes, type RestoredLayerSettings } from './layerStore';
import { bpm, timeSig, setBpm, setTimeSig, TIME_SIGNATURES } from './transportStore';
import type { AudioLayerState } from './layerStore';

// ── Schema ───────────────────────────────────────────────────────────────────

const FORMAT_VERSION = '1.0';
const AUTOSAVE_KEY = 'lf_autosave';

interface ProjectLayer {
  index: number;
  audioFile: string;       // path inside ZIP: "audio/0-kick.wav"
  name: string;
  originalFileName: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  loopStart: number;
  loopEnd: number;
}

interface ProjectJson {
  version: string;
  name: string;
  bpm: number;
  timeSignature: { beatsPerBar: number; beatUnit: number; label: string };
  layers: ProjectLayer[];
}

// ── Save (.loopfw export) ─────────────────────────────────────────────────────

function buildProjectJson(name: string): { json: ProjectJson; layers: ProjectLayer[] } {
  const currentLayers = get(layers).filter((l): l is AudioLayerState => l.type === 'audio');
  const projectLayers: ProjectLayer[] = currentLayers.map((l, i) => ({
    index: i,
    audioFile: `audio/${i}-${sanitizeFilename(l.originalFileName)}`,
    name: l.name,
    originalFileName: l.originalFileName,
    volume: l.volume,
    pan: l.pan,
    muted: l.muted,
    soloed: l.soloed,
    loopStart: l.loopStart,
    loopEnd: l.loopEnd,
  }));

  return {
    json: {
      version: FORMAT_VERSION,
      name,
      bpm: get(bpm),
      timeSignature: get(timeSig),
      layers: projectLayers,
    },
    layers: projectLayers,
  };
}

export async function saveSession(name = 'Untitled'): Promise<void> {
  const currentLayers = get(layers).filter((l): l is AudioLayerState => l.type === 'audio');
  const { json, layers: projectLayers } = buildProjectJson(name);

  const files: Record<string, Uint8Array> = {
    'project.json': strToU8(JSON.stringify(json, null, 2)),
  };

  currentLayers.forEach((l, i) => {
    files[projectLayers[i].audioFile] = l.audioData;
  });

  const zipData = await zipAsync(files);
  triggerDownload(zipData, `${name}.loopfw`);
  autoSave(name);
}

// ── Load (.loopfw import) ─────────────────────────────────────────────────────

export async function loadSession(file: File): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();
  const zipData = new Uint8Array(arrayBuffer);

  const unzipped = await unzipAsync(zipData);

  const jsonBytes = unzipped['project.json'];
  if (!jsonBytes) throw new Error('Invalid .loopfw file: missing project.json');

  const project: ProjectJson = JSON.parse(strFromU8(jsonBytes));
  if (!project.version || !project.layers) {
    throw new Error('Invalid .loopfw file: malformed project.json');
  }

  // Clear current session.
  clearAllLayers();

  // Restore transport.
  setBpm(project.bpm ?? 120);
  const sig = TIME_SIGNATURES.find((s) => s.label === project.timeSignature?.label);
  if (sig) setTimeSig(sig);

  // Restore layers in order.
  for (const pl of project.layers) {
    const audioBytes = unzipped[pl.audioFile];
    if (!audioBytes) {
      console.warn(`[session] Missing audio file: ${pl.audioFile} — skipping layer`);
      continue;
    }
    const settings: RestoredLayerSettings = {
      name: pl.name,
      originalFileName: pl.originalFileName,
      volume: pl.volume,
      pan: pl.pan,
      muted: pl.muted,
      soloed: pl.soloed,
      loopStart: pl.loopStart,
      loopEnd: pl.loopEnd,
    };
    await addLayerFromBytes(audioBytes, settings);
  }

  autoSave(project.name ?? file.name.replace(/\.loopfw$/, ''));
}

// ── Auto-save (metadata only, no audio) ──────────────────────────────────────

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleAutoSave(name = 'Untitled'): void {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => autoSave(name), 2000);
}

function autoSave(name: string): void {
  try {
    const { json } = buildProjectJson(name);
    // Strip audio references — auto-save is metadata only.
    const light = { ...json, layers: json.layers.map(({ audioFile: _, ...rest }) => rest) };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(light));
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded).
  }
}

export function getAutoSave(): ProjectJson | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAutoSave(): void {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
}

// ── Utilities ────────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
}

function triggerDownload(data: Uint8Array, filename: string): void {
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(data);
  const blob = new Blob([bytes.buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function zipAsync(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    zip(files, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data))),
  );
}

function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) =>
    unzip(data, (err, files) => (err ? reject(err) : resolve(files))),
  );
}
