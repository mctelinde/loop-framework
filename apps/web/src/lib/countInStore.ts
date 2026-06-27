/**
 * countInStore.ts
 *
 * Manages count-in state and logic for the record/play feature.
 * Provides 2-click and 4-click count-in options that respect the current BPM.
 */

import { writable, derived, get, type Readable } from 'svelte/store';
import { bpm } from './transportStore';
import { engine } from './engineStore';

export type CountInDuration = 2 | 4;
export type CountInState = 'idle' | 'counting' | 'ready';

const _countInEnabled = writable<boolean>(false);
const _countInDuration = writable<CountInDuration>(4);
const _countInState = writable<CountInState>('idle');
const _countInCounter = writable<number>(0);

export const countInEnabled: Readable<boolean> = derived(_countInEnabled, ($e) => $e);
export const countInDuration: Readable<CountInDuration> = derived(_countInDuration, ($d) => $d);
export const countInState: Readable<CountInState> = derived(_countInState, ($s) => $s);
export const countInCounter: Readable<number> = derived(_countInCounter, ($c) => $c);

let countInAbort: AbortController | null = null;

export function toggleCountIn(): void {
  _countInEnabled.update(($e) => !$e);
}

export function setCountInDuration(duration: CountInDuration): void {
  _countInDuration.set(duration);
}

export function setCountInEnabled(enabled: boolean): void {
  _countInEnabled.set(enabled);
}

/**
 * Initiates the count-in sequence.
 * Plays the specified number of click beats and returns a promise
 * that resolves when the count-in completes.
 */
export async function runCountIn(): Promise<void> {
  const enabled = get(_countInEnabled);
  if (!enabled) return;

  // Cancel any existing count-in
  if (countInAbort) {
    countInAbort.abort();
  }
  countInAbort = new AbortController();

  _countInState.set('counting');
  _countInCounter.set(0);

  try {
   // Get the shared AudioContext from the engine
   const engineCtrl = get(engine);
   if (!engineCtrl) {
     console.error('Engine not initialized for count-in');
     return;
   }

   const audioContext = engineCtrl.getAudioContext();

   const duration = get(_countInDuration);
   const currentBpm = get(bpm);
   const beatDurationMs = (60_000 / currentBpm); // ms per beat
   const clickDurationMs = 0.1; // click sound duration in ms

   for (let i = 1; i <= duration; i++) {
     if (countInAbort.signal.aborted) {
       _countInState.set('idle');
       return;
     }

     _countInCounter.set(i);

     // Play click sound
     playCountInClick(audioContext, i === duration);

     // Calculate wait time: full beat minus click duration for the last beat, 
     // full beat for other beats
     const waitTime = beatDurationMs - (i === duration ? clickDurationMs : 0);
      
     if (waitTime > 0) {
       await new Promise((resolve) =>
         setTimeout(resolve, waitTime)
       );
     }
   }

   _countInState.set('ready');
   _countInCounter.set(0);
 } catch (err) {
   if ((err as Error).name !== 'AbortError') {
     console.error('Count-in error:', err);
   }
   _countInState.set('idle');
 }
}

/**
* Cancels any ongoing count-in sequence.
*/
export function cancelCountIn(): void {
  if (countInAbort) {
    countInAbort.abort();
  }
  _countInState.set('idle');
  _countInCounter.set(0);
}

/**
 * Plays a single count-in click using the Web Audio API.
 * @param audioContext - The audio context to use
 * @param isFinal - Whether this is the final beat (plays a higher tone)
 */
function playCountInClick(audioContext: AudioContext, isFinal: boolean): void {
  try {
    const now = audioContext.currentTime;
    const duration = 0.1; // 100ms click
    const volume = 0.3;

    // Frequency: 800Hz for regular clicks, 1000Hz for the final beat
    const frequency = isFinal ? 1000 : 800;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.frequency.value = frequency;
    osc.type = 'sine';

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + duration);
  } catch (err) {
    console.error('Failed to play count-in click:', err);
  }
}
