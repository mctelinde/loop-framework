/**
 * lf-engine-processor.js
 *
 * AudioWorkletProcessor for Loop Framework.
 * Loaded by AudioContext.audioWorklet.addModule('/lf-engine-processor.js').
 *
 * The LoopEngine WASM instance lives here, on the audio rendering thread.
 * All engine mutations arrive as postMessage commands from the main thread.
 * Responses (layer IDs, waveform peaks, errors) are posted back.
 *
 * Architecture:
 *   Main thread  ──postMessage(cmd)──►  Worklet thread
 *                ◄──postMessage(res)──  (this file)
 *                                       └─ engine.process() on every quantum
 *
 * NOTE: Static top-level imports in AudioWorklet ES modules have known
 * cross-browser reliability issues.  WASM is loaded via dynamic import()
 * inside the constructor so that registerProcessor() always runs regardless
 * of async import timing.
 */

// Pre-allocated interleaved stereo scratch buffer (128 frames × 2 channels).
// Reused every quantum to avoid GC pressure on the audio thread.
const QUANTUM_FRAMES = 128;
let scratchBuffer = new Float32Array(QUANTUM_FRAMES * 2);

let engine = null;

class LoopEngineProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    this._ready = false;
    this._queue = []; // commands that arrived before WASM was ready

    // The WASM .wasm binary URL can be passed via processorOptions so the
    // main thread controls where static assets live.
    const wasmUrl =
      options?.processorOptions?.wasmUrl ?? './wasm/lf_wasm_bg.wasm';

    // Dynamic import avoids the static-import reliability issues in AudioWorklet
    // ES module scopes — registerProcessor() above has already run by this point.
    import('./wasm/lf_wasm.js')
      .then(({ default: init, LoopEngine }) => init(wasmUrl).then(() => ({ LoopEngine })))
      .then(({ LoopEngine }) => {
        engine = new LoopEngine(sampleRate);
        this._ready = true;

        // Drain any commands that arrived during init.
        for (const cmd of this._queue) this._dispatch(cmd);
        this._queue = [];

        this.port.postMessage({ type: 'ready' });
      })
      .catch((err) => {
        this.port.postMessage({ type: 'error', message: String(err) });
      });

    this.port.onmessage = (e) => {
      if (!this._ready) {
        this._queue.push(e.data);
      } else {
        this._dispatch(e.data);
      }
    };
  }

  /**
   * Dispatch a command from the main thread to the engine.
   * Every async operation includes a `requestId` so responses can be
   * matched on the main thread without relying on message ordering.
   */
  _dispatch(cmd) {
    if (!engine) return;

    switch (cmd.type) {
      // ── Transport ──────────────────────────────────────────────────────────
      case 'play':
        engine.play();
        break;
      case 'pause':
        engine.pause();
        break;
      case 'stop':
        engine.stop();
        break;
      case 'setBpm':
        engine.set_bpm(cmd.bpm);
        break;
      case 'setBeatsPerBar':
        engine.set_beats_per_bar(cmd.beats);
        break;
      case 'setMasterVolume':
        engine.set_master_volume(cmd.volume);
        break;

      // ── Layers ─────────────────────────────────────────────────────────────
      case 'addLayer': {
        try {
          const layerId = engine.add_layer(new Uint8Array(cmd.audioData), cmd.name);
          this.port.postMessage({
            type: 'layerAdded',
            requestId: cmd.requestId,
            layerId,
            name: cmd.name,
          });
        } catch (err) {
          this.port.postMessage({
            type: 'error',
            requestId: cmd.requestId,
            message: String(err),
          });
        }
        break;
      }
      case 'removeLayer':
        engine.remove_layer(cmd.layerId);
        break;
      case 'renameLayer':
        engine.rename_layer(cmd.layerId, cmd.name);
        break;
      case 'setLayerVolume':
        engine.set_layer_volume(cmd.layerId, cmd.volume);
        break;
      case 'setLayerPan':
        engine.set_layer_pan(cmd.layerId, cmd.pan);
        break;
      case 'setLayerMuted':
        engine.set_layer_muted(cmd.layerId, cmd.muted);
        break;
      case 'setLayerSoloed':
        engine.set_layer_soloed(cmd.layerId, cmd.soloed);
        break;
      case 'setLoopRegion':
        engine.set_loop_region(cmd.layerId, cmd.startSecs, cmd.endSecs);
        break;

      // ── Utilities ──────────────────────────────────────────────────────────
      case 'getWaveformPeaks': {
        const peaks = engine.layer_waveform_peaks(cmd.layerId, cmd.bucketCount);
        this.port.postMessage(
          { type: 'waveformPeaks', requestId: cmd.requestId, layerId: cmd.layerId, peaks },
          [peaks.buffer],
        );
        break;
      }
      case 'getLayerDuration': {
        const duration = engine.layer_duration_secs(cmd.layerId);
        this.port.postMessage({ type: 'layerDuration', requestId: cmd.requestId, layerId: cmd.layerId, duration });
        break;
      }

      default:
        this.port.postMessage({ type: 'error', message: `Unknown command: ${cmd.type}` });
    }
  }

  /**
   * Called by the Web Audio API on every render quantum (128 frames).
   * Must return `true` to keep the processor alive.
   */
  process(_inputs, outputs, _parameters) {
    if (!this._ready || !engine) {
      // Output silence until the engine is ready.
      return true;
    }

    const frameCount = outputs[0]?.[0]?.length ?? QUANTUM_FRAMES;

    // Resize scratch buffer if the host uses a non-standard quantum size.
    if (scratchBuffer.length !== frameCount * 2) {
      scratchBuffer = new Float32Array(frameCount * 2);
    }

    engine.process(scratchBuffer);

    // Deinterleave [L0, R0, L1, R1, …] → separate channel arrays.
    const left = outputs[0][0];
    const right = outputs[0][1] ?? outputs[0][0]; // mono fallback
    for (let i = 0; i < frameCount; i++) {
      left[i] = scratchBuffer[i * 2];
      right[i] = scratchBuffer[i * 2 + 1];
    }

    return true;
  }
}

registerProcessor('lf-engine-processor', LoopEngineProcessor);
