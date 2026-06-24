/**
 * engineStore.ts
 *
 * Svelte store that owns the EngineController lifecycle.
 * Components import `engine` for fire-and-forget calls and
 * `engineReady` to gate UI interactions behind WASM readiness.
 *
 * Usage:
 *   import { engine, engineReady, initEngine } from '$lib/engineStore';
 *   await initEngine();              // call once in App.svelte onMount
 *   $engine.play();                  // reactive, always safe to call
 */

import { writable, derived, type Readable } from 'svelte/store';
import { EngineController } from './engine';

const _controller = writable<EngineController | null>(null);
const _ready = writable(false);

/** The EngineController instance. Null until initEngine() resolves. */
export const engine: Readable<EngineController | null> = derived(_controller, ($c) => $c);

/** True once the WASM module has loaded inside the AudioWorklet. */
export const engineReady: Readable<boolean> = derived(_ready, ($r) => $r);

/**
 * Create the AudioContext, load the AudioWorklet module, and wait for
 * the WASM engine to signal readiness.  Safe to call multiple times —
 * subsequent calls are no-ops.
 */
export async function initEngine(): Promise<EngineController> {
  // Return existing controller if already initialised.
  let existing: EngineController | null = null;
  _controller.subscribe((v) => { existing = v; })();
  if (existing) return existing;

  const ctx = new AudioContext();

  // AudioContext requires a user gesture to start.  If the page loaded
  // without one (e.g. autoplay policy), resume on first interaction.
  if (ctx.state === 'suspended') {
    const resume = () => { ctx.resume(); document.removeEventListener('click', resume); };
    document.addEventListener('click', resume);
  }

  const controller = new EngineController(ctx);

  // Wire readiness: EngineController fires 'ready' internally; we expose
  // it to Svelte via the _ready store by wrapping initialize().
  await controller.initialize();

  // The worklet posts 'ready' after WASM init; expose that as a store.
  // EngineController already queues commands, so components can call
  // engine methods immediately — readiness just gates the UI.
  _ready.set(true);
  _controller.set(controller);

  return controller;
}
