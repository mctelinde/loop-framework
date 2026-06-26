use lf_engine::{Engine, LayerId};
use wasm_bindgen::prelude::*;

/// JavaScript-facing wrapper around the core Engine.
///
/// All methods map directly to the TypeScript API defined in phase1-plan.md.
/// The engine is created once per AudioContext and shared via a JS module-level reference.
#[wasm_bindgen]
pub struct LoopEngine {
    inner: Engine,
}

#[wasm_bindgen]
impl LoopEngine {
    /// Create a new engine.
    ///
    /// `sample_rate` should match `AudioContext.sampleRate` (typically 44100 or 48000).
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: u32) -> LoopEngine {
        // Route Rust panics to the browser console.
        // Enable by adding `console_error_panic_hook` to features in Cargo.toml.

        LoopEngine {
            inner: Engine::new(sample_rate),
        }
    }

    // ── Transport ────────────────────────────────────────────────────────────

    pub fn play(&mut self) {
        self.inner.play();
    }

    pub fn pause(&mut self) {
        self.inner.pause();
    }

    pub fn stop(&mut self) {
        self.inner.stop();
    }

    pub fn set_bpm(&mut self, bpm: f64) {
        self.inner.set_bpm(bpm);
    }

    pub fn bpm(&self) -> f64 {
        self.inner.bpm()
    }

    pub fn set_beats_per_bar(&mut self, beats: u32) {
        self.inner.set_beats_per_bar(beats);
    }

    pub fn set_master_volume(&mut self, volume: f32) {
        self.inner.set_master_volume(volume);
    }

    // ── Metronome ────────────────────────────────────────────────────────────

    pub fn set_metronome_enabled(&mut self, enabled: bool) {
        self.inner.set_metronome_enabled(enabled);
    }

    pub fn is_metronome_enabled(&self) -> bool {
        self.inner.is_metronome_enabled()
    }

    pub fn set_metronome_volume(&mut self, volume: f32) {
        self.inner.set_metronome_volume(volume);
    }

    // ── Layers ───────────────────────────────────────────────────────────────

    /// Decode and add an audio layer.  Returns the layer's numeric ID.
    /// Throws a JS error if the audio data cannot be decoded.
    pub fn add_layer(&mut self, audio_data: &[u8], name: &str) -> Result<u64, JsValue> {
        self.inner
            .add_layer_from_bytes(audio_data.to_vec(), name.to_string())
            .map(|id| id.0)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn remove_layer(&mut self, layer_id: u64) {
        self.inner.remove_layer(LayerId(layer_id));
    }

    pub fn rename_layer(&mut self, layer_id: u64, name: &str) {
        self.inner.rename_layer(LayerId(layer_id), name.to_string());
    }

    pub fn set_layer_volume(&mut self, layer_id: u64, volume: f32) {
        self.inner.set_layer_volume(LayerId(layer_id), volume);
    }

    pub fn set_layer_pan(&mut self, layer_id: u64, pan: f32) {
        self.inner.set_layer_pan(LayerId(layer_id), pan);
    }

    pub fn set_layer_muted(&mut self, layer_id: u64, muted: bool) {
        self.inner.set_layer_muted(LayerId(layer_id), muted);
    }

    pub fn set_layer_soloed(&mut self, layer_id: u64, soloed: bool) {
        self.inner.set_layer_soloed(LayerId(layer_id), soloed);
    }

    pub fn set_loop_region(&mut self, layer_id: u64, start_secs: f64, end_secs: f64) {
        self.inner.set_layer_loop_region(LayerId(layer_id), start_secs, end_secs);
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    /// Fill `output` with interleaved stereo float32 samples.
    ///
    /// Called by the AudioWorkletProcessor on every render quantum.
    /// `output` must be a Float32Array of length `block_size * 2`.
    pub fn process(&mut self, output: &mut [f32]) {
        self.inner.process(output);
    }

    // ── Waveform thumbnails ──────────────────────────────────────────────────

    /// Return peak data for a layer as a flat Float32Array: [min0, max0, min1, max1, …].
    /// Returns an empty array if the layer does not exist.
    pub fn layer_waveform_peaks(&self, layer_id: u64, bucket_count: u32) -> Vec<f32> {
        match self.inner.layer_waveform_peaks(LayerId(layer_id), bucket_count as usize) {
            None => vec![],
            Some(peaks) => peaks.iter().flat_map(|&(min, max)| [min, max]).collect(),
        }
    }

    /// Samples until the next beat boundary (for quantised start/stop).
    pub fn samples_to_next_beat(&self) -> u64 {
        self.inner.samples_to_next_beat()
    }

    /// Duration of a layer's audio buffer in seconds.
    pub fn layer_duration_secs(&self, layer_id: u64) -> f64 {
        self.inner.layer_duration_secs(LayerId(layer_id))
    }
}
