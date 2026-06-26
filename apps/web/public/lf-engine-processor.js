/* @ts-self-types="./lf_wasm.d.ts" */

/**
 * JavaScript-facing wrapper around the core Engine.
 *
 * All methods map directly to the TypeScript API defined in phase1-plan.md.
 * The engine is created once per AudioContext and shared via a JS module-level reference.
 */
class LoopEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        LoopEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_loopengine_free(ptr, 0);
    }
    /**
     * Decode and add an audio layer.  Returns the layer's numeric ID.
     * Throws a JS error if the audio data cannot be decoded.
     * @param {Uint8Array} audio_data
     * @param {string} name
     * @returns {bigint}
     */
    add_layer(audio_data, name) {
        const ptr0 = passArray8ToWasm0(audio_data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.loopengine_add_layer(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return BigInt.asUintN(64, ret[0]);
    }
    /**
     * @returns {number}
     */
    bpm() {
        const ret = wasm.loopengine_bpm(this.__wbg_ptr);
        return ret;
    }
    /**
     * Duration of a layer's audio buffer in seconds.
     * @param {bigint} layer_id
     * @returns {number}
     */
    layer_duration_secs(layer_id) {
        const ret = wasm.loopengine_layer_duration_secs(this.__wbg_ptr, layer_id);
        return ret;
    }
    /**
     * Return peak data for a layer as a flat Float32Array: [min0, max0, min1, max1, …].
     * Returns an empty array if the layer does not exist.
     * @param {bigint} layer_id
     * @param {number} bucket_count
     * @returns {Float32Array}
     */
    layer_waveform_peaks(layer_id, bucket_count) {
        const ret = wasm.loopengine_layer_waveform_peaks(this.__wbg_ptr, layer_id, bucket_count);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Create a new engine.
     *
     * `sample_rate` should match `AudioContext.sampleRate` (typically 44100 or 48000).
     * @param {number} sample_rate
     */
    constructor(sample_rate) {
        const ret = wasm.loopengine_new(sample_rate);
        this.__wbg_ptr = ret;
        LoopEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    pause() {
        wasm.loopengine_pause(this.__wbg_ptr);
    }
    play() {
        wasm.loopengine_play(this.__wbg_ptr);
    }
    /**
     * Fill `output` with interleaved stereo float32 samples.
     *
     * Called by the AudioWorkletProcessor on every render quantum.
     * `output` must be a Float32Array of length `block_size * 2`.
     * @param {Float32Array} output
     */
    process(output) {
        var ptr0 = passArrayF32ToWasm0(output, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.loopengine_process(this.__wbg_ptr, ptr0, len0, output);
    }
    /**
     * @param {bigint} layer_id
     */
    remove_layer(layer_id) {
        wasm.loopengine_remove_layer(this.__wbg_ptr, layer_id);
    }
    /**
     * @param {bigint} layer_id
     * @param {string} name
     */
    rename_layer(layer_id, name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.loopengine_rename_layer(this.__wbg_ptr, layer_id, ptr0, len0);
    }
    /**
     * Samples until the next beat boundary (for quantised start/stop).
     * @returns {bigint}
     */
    samples_to_next_beat() {
        const ret = wasm.loopengine_samples_to_next_beat(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * @param {number} beats
     */
    set_beats_per_bar(beats) {
        wasm.loopengine_set_beats_per_bar(this.__wbg_ptr, beats);
    }
    /**
     * @param {number} bpm
     */
    set_bpm(bpm) {
        wasm.loopengine_set_bpm(this.__wbg_ptr, bpm);
    }
    /**
     * @param {bigint} layer_id
     * @param {boolean} muted
     */
    set_layer_muted(layer_id, muted) {
        wasm.loopengine_set_layer_muted(this.__wbg_ptr, layer_id, muted);
    }
    /**
     * @param {bigint} layer_id
     * @param {number} pan
     */
    set_layer_pan(layer_id, pan) {
        wasm.loopengine_set_layer_pan(this.__wbg_ptr, layer_id, pan);
    }
    /**
     * @param {bigint} layer_id
     * @param {boolean} soloed
     */
    set_layer_soloed(layer_id, soloed) {
        wasm.loopengine_set_layer_soloed(this.__wbg_ptr, layer_id, soloed);
    }
    /**
     * @param {bigint} layer_id
     * @param {number} volume
     */
    set_layer_volume(layer_id, volume) {
        wasm.loopengine_set_layer_volume(this.__wbg_ptr, layer_id, volume);
    }
    /**
     * @param {bigint} layer_id
     * @param {number} start_secs
     * @param {number} end_secs
     */
    set_loop_region(layer_id, start_secs, end_secs) {
        wasm.loopengine_set_loop_region(this.__wbg_ptr, layer_id, start_secs, end_secs);
    }
    /**
     * @param {number} volume
     */
    set_master_volume(volume) {
        wasm.loopengine_set_master_volume(this.__wbg_ptr, volume);
    }
    /**
     * @param {boolean} enabled
     */
    set_metronome_enabled(enabled) {
        wasm.loopengine_set_metronome_enabled(this.__wbg_ptr, enabled);
    }
    /**
     * @param {number} volume
     */
    set_metronome_volume(volume) {
        wasm.loopengine_set_metronome_volume(this.__wbg_ptr, volume);
    }
    stop() {
        wasm.loopengine_stop(this.__wbg_ptr);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_copy_to_typed_array_c5728021fabd0236: function(arg0, arg1, arg2) {
            new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(getArrayU8FromWasm0(arg0, arg1));
        },
        __wbg___wbindgen_throw_ea4887a5f8f9a9db: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./lf_wasm_bg.js": import0,
    };
}

let LoopEngineFinalization = null;

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = null;
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        if (typeof TextDecoder !== 'undefined') { cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }); }
        if (cachedTextDecoder) cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedTextEncoder = null;

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    _ensureGlueInit();
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}
// ─── Lazy glue init (AudioWorklet-safe) ──────────────────────────────────────
// TextDecoder/TextEncoder/FinalizationRegistry are NOT available in Chrome's
// AudioWorkletGlobalScope. We defer their initialization to the first initSync()
// call so that registerProcessor() is always reached at module evaluation time.

function _ensureGlueInit() {
  if (cachedTextDecoder !== null) return;

  if (typeof TextDecoder !== 'undefined') {
    cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
  } else {
    // Minimal UTF-8 decoder fallback for AudioWorklet
    cachedTextDecoder = {
      decode: function(bytes) {
        if (!bytes || bytes.length === 0) return '';
        var str = '', i = 0, b, cp;
        while (i < bytes.length) {
          b = bytes[i++];
          if (b < 0x80) { str += String.fromCharCode(b); }
          else if (b < 0xE0) { str += String.fromCharCode(((b & 0x1F) << 6) | (bytes[i++] & 0x3F)); }
          else if (b < 0xF0) { str += String.fromCharCode(((b & 0x0F) << 12) | ((bytes[i++] & 0x3F) << 6) | (bytes[i++] & 0x3F)); }
          else { cp = ((b & 0x07) << 18)|((bytes[i++]&0x3F)<<12)|((bytes[i++]&0x3F)<<6)|(bytes[i++]&0x3F); str += String.fromCodePoint(cp); }
        }
        return str;
      }
    };
  }

  if (typeof TextEncoder !== 'undefined') {
    cachedTextEncoder = new TextEncoder();
    if (!('encodeInto' in cachedTextEncoder)) {
      cachedTextEncoder.encodeInto = function(arg, view) {
        var buf = cachedTextEncoder.encode(arg); view.set(buf);
        return { read: arg.length, written: buf.length };
      };
    }
  } else {
    // Minimal UTF-8 encoder fallback for AudioWorklet
    cachedTextEncoder = {
      encode: function(str) {
        var bytes = [], i = 0, cp;
        while (i < str.length) {
          cp = str.codePointAt(i);
          if (cp < 0x80) { bytes.push(cp); }
          else if (cp < 0x800) { bytes.push(0xC0|(cp>>6), 0x80|(cp&0x3F)); }
          else if (cp < 0x10000) { bytes.push(0xE0|(cp>>12), 0x80|((cp>>6)&0x3F), 0x80|(cp&0x3F)); }
          else { bytes.push(0xF0|(cp>>18), 0x80|((cp>>12)&0x3F), 0x80|((cp>>6)&0x3F), 0x80|(cp&0x3F)); i++; }
          i++;
        }
        return new Uint8Array(bytes);
      },
      encodeInto: function(str, view) {
        var enc = this.encode(str); view.set(enc);
        return { read: str.length, written: enc.length };
      }
    };
  }

  LoopEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: function() {}, unregister: function() {} }
    : new FinalizationRegistry(function(ptr) { wasm.__wbg_loopengine_free(ptr, 1); });

  if (typeof Symbol !== 'undefined' && Symbol.dispose) {
    LoopEngine.prototype[Symbol.dispose] = LoopEngine.prototype.free;
  }
}

// ─── AudioWorkletProcessor ────────────────────────────────────────────────────

const QUANTUM_FRAMES = 128;
let scratchBuffer = new Float32Array(QUANTUM_FRAMES * 2);
let engine = null;

class LoopEngineProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    var wasmModule = options && options.processorOptions && options.processorOptions.wasmModule;
    try {
      initSync({ module: wasmModule });
      engine = new LoopEngine(sampleRate);
      this.port.postMessage({ type: 'ready' });
    } catch (err) {
      this.port.postMessage({ type: 'error', message: String(err) });
    }
    this.port.onmessage = (function(e) { this._dispatch(e.data); }).bind(this);
  }

  _dispatch(cmd) {
    if (!engine) return;
    switch (cmd.type) {
      case 'play':            engine.play(); break;
      case 'pause':           engine.pause(); break;
      case 'stop':            engine.stop(); break;
      case 'setBpm':          engine.set_bpm(cmd.bpm); break;
      case 'setBeatsPerBar':  engine.set_beats_per_bar(cmd.beats); break;
      case 'setMasterVolume': engine.set_master_volume(cmd.volume); break;
      case 'addLayer': {
        try {
          var layerId = engine.add_layer(new Uint8Array(cmd.audioData), cmd.name);
          this.port.postMessage({ type: 'layerAdded', requestId: cmd.requestId, layerId: layerId, name: cmd.name });
        } catch (err) {
          this.port.postMessage({ type: 'error', requestId: cmd.requestId, message: String(err) });
        }
        break;
      }
      case 'removeLayer':    engine.remove_layer(cmd.layerId); break;
      case 'renameLayer':    engine.rename_layer(cmd.layerId, cmd.name); break;
      case 'setLayerVolume': engine.set_layer_volume(cmd.layerId, cmd.volume); break;
      case 'setLayerPan':    engine.set_layer_pan(cmd.layerId, cmd.pan); break;
      case 'setLayerMuted':  engine.set_layer_muted(cmd.layerId, cmd.muted); break;
      case 'setLayerSoloed': engine.set_layer_soloed(cmd.layerId, cmd.soloed); break;
      case 'setLoopRegion':  engine.set_loop_region(cmd.layerId, cmd.startSecs, cmd.endSecs); break;
      case 'setMetronomeEnabled':
        try { engine.set_metronome_enabled(cmd.enabled); } catch(e) {}
        break;
      case 'setMetronomeVolume':
        try { engine.set_metronome_volume(cmd.volume); } catch(e) {}
        break;
      case 'getWaveformPeaks': {
        var peaks = engine.layer_waveform_peaks(cmd.layerId, cmd.bucketCount);
        this.port.postMessage({ type: 'waveformPeaks', requestId: cmd.requestId, layerId: cmd.layerId, peaks: peaks }, [peaks.buffer]);
        break;
      }
      case 'getLayerDuration': {
        var dur = engine.layer_duration_secs(cmd.layerId);
        this.port.postMessage({ type: 'layerDuration', requestId: cmd.requestId, layerId: cmd.layerId, duration: dur });
        break;
      }
      default:
        this.port.postMessage({ type: 'error', message: 'Unknown command: ' + cmd.type });
    }
  }

  process(_inputs, outputs) {
    if (!engine) return true;
    var out0 = outputs[0];
    var frameCount = (out0 && out0[0]) ? out0[0].length : QUANTUM_FRAMES;
    if (scratchBuffer.length !== frameCount * 2) scratchBuffer = new Float32Array(frameCount * 2);
    engine.process(scratchBuffer);
    var left = out0[0], right = out0[1] || out0[0];
    for (var i = 0; i < frameCount; i++) {
      left[i] = scratchBuffer[i * 2];
      right[i] = scratchBuffer[i * 2 + 1];
    }
    return true;
  }
}

registerProcessor('lf-engine-processor', LoopEngineProcessor);