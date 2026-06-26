use std::collections::HashMap;

use crate::{
    buffer::{decode_audio, DecodeError},
    layer::{Layer, LayerId},
    metronome::Metronome,
    quantize::samples_to_next_beat,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransportState {
    Stopped,
    Playing,
    Paused,
}

pub struct Engine {
    sample_rate: u32,
    bpm: f64,
    /// Numerator of time signature (beats per bar).
    beats_per_bar: u32,
    master_volume: f32,

    state: TransportState,
    /// Running count of rendered samples (for beat-grid calculations).
    transport_sample: u64,
    /// Last beat the metronome was triggered on (to avoid double-triggering)
    last_triggered_beat: u64,

    layers: HashMap<LayerId, Layer>,
    /// Insertion-order list of layer IDs for deterministic mix order.
    layer_order: Vec<LayerId>,
    
    /// Metronome for click track
    metronome: Metronome,
}

impl Engine {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            sample_rate,
            bpm: 120.0,
            beats_per_bar: 4,
            master_volume: 1.0,
            state: TransportState::Stopped,
            transport_sample: 0,
            last_triggered_beat: 0,
            layers: HashMap::new(),
            layer_order: Vec::new(),
            metronome: Metronome::new(sample_rate),
        }
    }

    // ── Transport ────────────────────────────────────────────────────────────

    pub fn play(&mut self) {
        self.state = TransportState::Playing;
    }

    pub fn pause(&mut self) {
        self.state = TransportState::Paused;
    }

    pub fn stop(&mut self) {
        self.state = TransportState::Stopped;
        self.transport_sample = 0;
        self.last_triggered_beat = 0;
        for layer in self.layers.values_mut() {
            layer.reset();
        }
    }

    // ── BPM / time sig ───────────────────────────────────────────────────────

    pub fn set_bpm(&mut self, bpm: f64) {
        self.bpm = bpm.clamp(20.0, 999.0);
    }

    pub fn bpm(&self) -> f64 {
        self.bpm
    }

    pub fn set_beats_per_bar(&mut self, beats: u32) {
        self.beats_per_bar = beats.max(1);
    }

    pub fn set_master_volume(&mut self, vol: f32) {
        self.master_volume = vol.clamp(0.0, 1.0);
    }

    /// Samples until the next beat boundary (useful for quantised events).
    pub fn samples_to_next_beat(&self) -> u64 {
        samples_to_next_beat(
            self.transport_sample,
            self.sample_rate,
            self.bpm,
            self.beats_per_bar,
        )
    }

    // ── Metronome ────────────────────────────────────────────────────────────

    pub fn set_metronome_enabled(&mut self, enabled: bool) {
        self.metronome.set_enabled(enabled);
    }

    pub fn is_metronome_enabled(&self) -> bool {
        self.metronome.is_enabled()
    }

    pub fn set_metronome_volume(&mut self, volume: f32) {
        self.metronome.set_volume(volume);
    }

    // ── Layer management ─────────────────────────────────────────────────────

    pub fn add_layer_from_bytes(
        &mut self,
        data: Vec<u8>,
        name: String,
    ) -> Result<LayerId, DecodeError> {
        let buffer = decode_audio(data)?;
        let id = LayerId::generate();
        let layer = Layer::new(id, name, buffer);
        self.layer_order.push(id);
        self.layers.insert(id, layer);
        Ok(id)
    }

    pub fn remove_layer(&mut self, id: LayerId) {
        self.layers.remove(&id);
        self.layer_order.retain(|&lid| lid != id);
    }

    pub fn rename_layer(&mut self, id: LayerId, name: String) {
        if let Some(layer) = self.layers.get_mut(&id) {
            layer.name = name;
        }
    }

    pub fn set_layer_volume(&mut self, id: LayerId, vol: f32) {
        if let Some(layer) = self.layers.get_mut(&id) {
            layer.volume = vol.clamp(0.0, 1.0);
        }
    }

    pub fn set_layer_pan(&mut self, id: LayerId, pan: f32) {
        if let Some(layer) = self.layers.get_mut(&id) {
            layer.pan = pan.clamp(-1.0, 1.0);
        }
    }

    pub fn set_layer_muted(&mut self, id: LayerId, muted: bool) {
        if let Some(layer) = self.layers.get_mut(&id) {
            layer.muted = muted;
        }
    }

    pub fn set_layer_soloed(&mut self, id: LayerId, soloed: bool) {
        if let Some(layer) = self.layers.get_mut(&id) {
            layer.soloed = soloed;
        }
    }

    pub fn set_layer_loop_region(&mut self, id: LayerId, start_secs: f64, end_secs: f64) {
        if let Some(layer) = self.layers.get_mut(&id) {
            layer.loop_start_secs = start_secs.max(0.0);
            layer.loop_end_secs = Some(end_secs.max(start_secs));
        }
    }

    // ── Audio rendering ──────────────────────────────────────────────────────

    /// Fill `output` (interleaved stereo float32) with rendered audio.
    ///
    /// This is the method called by the AudioWorkletProcessor on every block.
    /// `output` length must be a multiple of 2 (L+R frame pairs).
    pub fn process(&mut self, output: &mut [f32]) {
        if self.state != TransportState::Playing {
            output.fill(0.0);
            return;
        }

        let any_soloed = self.layers.values().any(|l| l.soloed);
        let frame_count = output.len() / 2;

        for i in 0..frame_count {
            let mut left = 0.0f32;
            let mut right = 0.0f32;

            // ── Check for beat boundary and trigger metronome ────────────────
            if self.metronome.is_enabled() {
                let current_beat = (self.transport_sample * self.bpm as u64 * self.beats_per_bar as u64) / (60 * self.sample_rate as u64);
                if current_beat != self.last_triggered_beat {
                    self.last_triggered_beat = current_beat;
                    let is_beat_one = (current_beat % self.beats_per_bar as u64) == 0;
                    self.metronome.trigger_click(is_beat_one);
                }
            }

            // Process layers in insertion order; each is accessed independently.
            for &id in &self.layer_order {
                let layer = match self.layers.get_mut(&id) {
                    Some(l) => l,
                    None => continue,
                };

                if !layer.muted && !(any_soloed && !layer.soloed) {
                    let (l, r) = layer_stereo_frame(layer);
                    left += l;
                    right += r;
                }
                layer.advance(1);
            }

            // Mix in metronome
            let metro = self.metronome.next_sample();
            left += metro;
            right += metro;

            output[i * 2] = soft_clip(left) * self.master_volume;
            output[i * 2 + 1] = soft_clip(right) * self.master_volume;
            self.transport_sample += 1;
        }
    }

    /// Expose buffer peak data for waveform thumbnail generation.
    /// Returns a Vec of (min, max) pairs per `bucket_count` buckets.
    pub fn layer_waveform_peaks(
        &self,
        id: LayerId,
        bucket_count: usize,
    ) -> Option<Vec<(f32, f32)>> {
        let layer = self.layers.get(&id)?;
        let frames = layer.buffer.frame_count();
        if frames == 0 || bucket_count == 0 {
            return None;
        }

        let bucket_size = (frames / bucket_count).max(1);
        let mut peaks = Vec::with_capacity(bucket_count);

        for b in 0..bucket_count {
            let start = b * bucket_size;
            let end = ((b + 1) * bucket_size).min(frames);
            let mut min = f32::MAX;
            let mut max = f32::MIN;

            for frame in start..end {
                // Mix channels to mono for the thumbnail
                let channels = layer.buffer.channels as usize;
                let mono: f32 = (0..channels)
                    .map(|c| layer.buffer.sample(frame, c))
                    .sum::<f32>()
                    / channels as f32;
                if mono < min { min = mono; }
                if mono > max { max = mono; }
            }
            peaks.push((min, max));
        }

        Some(peaks)
    }

    /// Duration of a layer's audio buffer in seconds, or 0.0 if not found.
    pub fn layer_duration_secs(&self, id: LayerId) -> f64 {
        self.layers
            .get(&id)
            .map(|l| l.buffer.duration_secs())
            .unwrap_or(0.0)
    }
}

// ── Private helpers ──────────────────────────────────────────────────────────

/// Compute the stereo (left, right) contribution of a single layer at its
/// current playback frame, applying volume and equal-power pan.
fn layer_stereo_frame(layer: &Layer) -> (f32, f32) {
    let channels = layer.buffer.channels as usize;
    let frame = layer.playback_frame;

    let mono = layer.buffer.sample(frame, 0);
    let stereo_r = if channels > 1 { layer.buffer.sample(frame, 1) } else { mono };

    let pan_angle = (layer.pan + 1.0) * 0.5 * std::f32::consts::FRAC_PI_2;
    let gain_l = pan_angle.cos() * layer.volume;
    let gain_r = pan_angle.sin() * layer.volume;

    (mono * gain_l, stereo_r * gain_r)
}

/// Cubic soft-clip: passes |x| ≤ 1 through mostly unchanged, rounds peaks.
#[inline]
fn soft_clip(x: f32) -> f32 {
    if x >= 1.0 { return 2.0 / 3.0; }
    if x <= -1.0 { return -2.0 / 3.0; }
    x - (x * x * x) / 3.0
}
