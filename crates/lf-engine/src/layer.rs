use std::sync::atomic::{AtomicU64, Ordering};

use crate::buffer::AudioBuffer;

static NEXT_LAYER_ID: AtomicU64 = AtomicU64::new(1);

/// Opaque, unique identifier for a layer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct LayerId(pub u64);

impl LayerId {
    pub fn generate() -> Self {
        LayerId(NEXT_LAYER_ID.fetch_add(1, Ordering::Relaxed))
    }
}

/// A single audio layer in the mixer.
pub struct Layer {
    pub id: LayerId,
    pub name: String,
    pub buffer: AudioBuffer,

    /// Normalised volume: 0.0 (silent) – 1.0 (full).
    pub volume: f32,
    /// Stereo pan: -1.0 (hard left) – 0.0 (centre) – 1.0 (hard right).
    pub pan: f32,
    pub muted: bool,
    pub soloed: bool,

    /// Loop region start, in seconds (relative to buffer start).
    pub loop_start_secs: f64,
    /// Loop region end, in seconds (relative to buffer start).
    /// If None, loops to end of buffer.
    pub loop_end_secs: Option<f64>,

    /// Current playback position, in frames within the buffer.
    pub(crate) playback_frame: usize,
}

impl Layer {
    pub fn new(id: LayerId, name: String, buffer: AudioBuffer) -> Self {
        let duration = buffer.duration_secs();
        Self {
            id,
            name,
            buffer,
            volume: 1.0,
            pan: 0.0,
            muted: false,
            soloed: false,
            loop_start_secs: 0.0,
            loop_end_secs: Some(duration),
            playback_frame: 0,
        }
    }

    /// Return the effective loop start frame.
    pub fn loop_start_frame(&self) -> usize {
        let sr = self.buffer.sample_rate as f64;
        (self.loop_start_secs * sr) as usize
    }

    /// Return the effective loop end frame (clamped to buffer length).
    pub fn loop_end_frame(&self) -> usize {
        let sr = self.buffer.sample_rate as f64;
        let max = self.buffer.frame_count();
        let end = self
            .loop_end_secs
            .map(|s| (s * sr) as usize)
            .unwrap_or(max);
        end.min(max)
    }

    /// Advance by `frames` and wrap within loop region.
    /// Returns `true` if the layer wrapped (looped) during this advance.
    pub fn advance(&mut self, frames: usize) -> bool {
        let start = self.loop_start_frame();
        let end = self.loop_end_frame();
        let region_len = end.saturating_sub(start);
        if region_len == 0 {
            return false;
        }

        self.playback_frame += frames;
        let mut wrapped = false;
        while self.playback_frame >= end {
            self.playback_frame = start + (self.playback_frame - end) % region_len;
            wrapped = true;
        }
        wrapped
    }

    /// Reset playback to the loop start.
    pub fn reset(&mut self) {
        self.playback_frame = self.loop_start_frame();
    }
}
