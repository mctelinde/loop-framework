/**
 * engine.ts
 *
 * Main-thread controller for the Loop Framework AudioWorklet engine.
 *
 * Usage:
 *   const ctx = new AudioContext();
 *   const engine = new EngineController(ctx);
 *   await engine.initialize();
 *   const layerId = await engine.addLayer(audioBytes, 'Kick');
 *   engine.play();
 */

export type LayerId = number;

export interface WaveformPeaks {
  layerId: LayerId;
  /** Flat array: [min0, max0, min1, max1, …] — one min/max pair per bucket. */
  peaks: Float32Array;
}

// Internal pending-request bookkeeping
interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

/**
 * EngineController owns the AudioWorkletNode and proxies all engine
 * operations to the worklet thread via MessagePort.
 *
 * Commands are queued automatically if sent before the WASM module has
 * finished loading in the worklet — callers don't need to wait for 'ready'.
 * Only `addLayer` and `getWaveformPeaks` return Promises because they
 * produce a value; all other commands are fire-and-forget.
 */
export class EngineController {
  private readonly context: AudioContext;
  private node: AudioWorkletNode | null = null;
  private ready = false;
  private preReadyQueue: Array<{ payload: Record<string, unknown>; transfer: Transferable[] }> = [];

  /** Pending async requests keyed by requestId. */
  private pendingRequests = new Map<number, PendingRequest>();
  private nextRequestId = 0;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Load the AudioWorklet module and set up the node.
   * Must be called once before any other method (though other calls will
   * queue safely and execute once this resolves).
   *
   * @param processorUrl  URL of lf-engine-processor.js (default: '/lf-engine-processor.js')
   * @param wasmUrl       URL of the compiled .wasm binary (default: '/wasm/lf_wasm_bg.wasm')
   */
  async initialize(
    processorUrl = '/lf-engine-processor.js',
    wasmUrl = '/wasm/lf_wasm_bg.wasm',
  ): Promise<void> {
    await this.context.audioWorklet.addModule(processorUrl);

    this.node = new AudioWorkletNode(this.context, 'lf-engine-processor', {
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { wasmUrl },
    });

    this.node.connect(this.context.destination);
    this.node.port.onmessage = (e) => this._handleMessage(e.data);
  }

  // ── Transport ────────────────────────────────────────────────────────────

  play(): void { this._send({ type: 'play' }); }
  pause(): void { this._send({ type: 'pause' }); }
  stop(): void { this._send({ type: 'stop' }); }
  setBpm(bpm: number): void { this._send({ type: 'setBpm', bpm }); }
  setBeatsPerBar(beats: number): void { this._send({ type: 'setBeatsPerBar', beats }); }
  setMasterVolume(volume: number): void { this._send({ type: 'setMasterVolume', volume }); }

  // ── Layers ───────────────────────────────────────────────────────────────

  /**
   * Decode and add an audio layer.
   * The `audioData` buffer is transferred (zero-copy) to the worklet thread.
   * After this call the original ArrayBuffer will be detached.
   */
  addLayer(audioData: ArrayBuffer, name: string): Promise<LayerId> {
    return this._request<LayerId>(
      { type: 'addLayer', audioData, name },
      [audioData],
    );
  }

  removeLayer(layerId: LayerId): void {
    this._send({ type: 'removeLayer', layerId });
  }

  renameLayer(layerId: LayerId, name: string): void {
    this._send({ type: 'renameLayer', layerId, name });
  }

  setLayerVolume(layerId: LayerId, volume: number): void {
    this._send({ type: 'setLayerVolume', layerId, volume });
  }

  setLayerPan(layerId: LayerId, pan: number): void {
    this._send({ type: 'setLayerPan', layerId, pan });
  }

  setLayerMuted(layerId: LayerId, muted: boolean): void {
    this._send({ type: 'setLayerMuted', layerId, muted });
  }

  setLayerSoloed(layerId: LayerId, soloed: boolean): void {
    this._send({ type: 'setLayerSoloed', layerId, soloed });
  }

  setLoopRegion(layerId: LayerId, startSecs: number, endSecs: number): void {
    this._send({ type: 'setLoopRegion', layerId, startSecs, endSecs });
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  /**
   * Request waveform peak data for a layer.
   * The returned Float32Array is transferred from the worklet (zero-copy).
   *
   * @param bucketCount Number of min/max pairs — typically canvas width in pixels.
   */
  getWaveformPeaks(layerId: LayerId, bucketCount: number): Promise<WaveformPeaks> {
    return this._request<WaveformPeaks>({ type: 'getWaveformPeaks', layerId, bucketCount });
  }

  getLayerDuration(layerId: LayerId): Promise<number> {
    return this._request<number>({ type: 'getLayerDuration', layerId });
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private _handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case 'ready':
        this.ready = true;
        for (const { payload, transfer } of this.preReadyQueue) {
          this._postToWorklet(payload, transfer);
        }
        this.preReadyQueue = [];
        break;

      case 'layerAdded': {
        const req = this.pendingRequests.get(msg.requestId as number);
        if (req) {
          req.resolve(msg.layerId as LayerId);
          this.pendingRequests.delete(msg.requestId as number);
        }
        break;
      }

      case 'waveformPeaks': {
        const req = this.pendingRequests.get(msg.requestId as number);
        if (req) {
          req.resolve({ layerId: msg.layerId, peaks: msg.peaks } as WaveformPeaks);
          this.pendingRequests.delete(msg.requestId as number);
        }
        break;
      }

      case 'layerDuration': {
        const req = this.pendingRequests.get(msg.requestId as number);
        if (req) {
          req.resolve(msg.duration as number);
          this.pendingRequests.delete(msg.requestId as number);
        }
        break;
      }

      case 'error': {
        const reqId = msg.requestId as number | undefined;
        if (reqId !== undefined) {
          const req = this.pendingRequests.get(reqId);
          if (req) {
            req.reject(new Error(msg.message as string));
            this.pendingRequests.delete(reqId);
          }
        } else {
          console.error('[LoopEngine]', msg.message);
        }
        break;
      }
    }
  }

  /** Send a fire-and-forget command. Queues if worklet isn't ready yet. */
  private _send(cmd: Record<string, unknown>): void {
    if (!this.ready) {
      this.preReadyQueue.push({ payload: cmd, transfer: [] });
    } else {
      this._postToWorklet(cmd);
    }
  }

  /**
   * Send a command that expects a response, matched by requestId.
   * Transferable objects (e.g. ArrayBuffers) can be passed in `transfer`.
   */
  private _request<T>(
    cmd: Record<string, unknown>,
    transfer: Transferable[] = [],
  ): Promise<T> {
    const requestId = this.nextRequestId++;
    const cmdWithId = { ...cmd, requestId };

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      if (!this.ready) {
        this.preReadyQueue.push({ payload: cmdWithId, transfer });
      } else {
        this._postToWorklet(cmdWithId, transfer);
      }
    });
  }

  private _postToWorklet(
    payload: Record<string, unknown>,
    transfer: Transferable[] = [],
  ): void {
    this.node?.port.postMessage(payload, transfer);
  }
}
