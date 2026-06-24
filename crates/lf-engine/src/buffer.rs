/// A decoded, interleaved float32 audio buffer.
#[derive(Clone)]
pub struct AudioBuffer {
    /// Interleaved samples: [L0, R0, L1, R1, …] or [M0, M1, …] for mono.
    pub samples: Vec<f32>,
    pub channels: u16,
    pub sample_rate: u32,
}

impl AudioBuffer {
    pub fn new(samples: Vec<f32>, channels: u16, sample_rate: u32) -> Self {
        Self { samples, channels, sample_rate }
    }

    /// Total number of frames (one frame = one sample per channel).
    pub fn frame_count(&self) -> usize {
        if self.channels == 0 {
            return 0;
        }
        self.samples.len() / self.channels as usize
    }

    /// Duration in seconds.
    pub fn duration_secs(&self) -> f64 {
        self.frame_count() as f64 / self.sample_rate as f64
    }

    /// Read a single sample for a given frame and channel (0-indexed).
    /// Returns 0.0 if out of bounds.
    pub fn sample(&self, frame: usize, channel: usize) -> f32 {
        let idx = frame * self.channels as usize + channel;
        self.samples.get(idx).copied().unwrap_or(0.0)
    }
}

// ── Decoding ────────────────────────────────────────────────────────────────

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DecodeError {
    #[error("symphonia error: {0}")]
    Symphonia(#[from] SymphoniaError),
    #[error("no audio tracks found in file")]
    NoAudioTrack,
    #[error("no samples decoded")]
    NoSamples,
}

/// Decode raw audio bytes (WAV, MP3, OGG, …) into a float32 buffer.
pub fn decode_audio(data: Vec<u8>) -> Result<AudioBuffer, DecodeError> {
    let cursor = std::io::Cursor::new(data);
    let mss = MediaSourceStream::new(Box::new(cursor), Default::default());

    let hint = Hint::new();
    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();
    let decoder_opts = DecoderOptions::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)?;
    let mut format = probed.format;

    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != symphonia::core::codecs::CODEC_TYPE_NULL)
        .ok_or(DecodeError::NoAudioTrack)?;

    let track_id = track.id;
    let mut decoder =
        symphonia::default::get_codecs().make(&track.codec_params, &decoder_opts)?;

    let channels = track
        .codec_params
        .channels
        .map(|c| c.count() as u16)
        .unwrap_or(1);
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);

    let mut all_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(SymphoniaError::ResetRequired) => {
                decoder.reset();
                continue;
            }
            Err(SymphoniaError::IoError(_)) => break,
            Err(e) => return Err(DecodeError::Symphonia(e)),
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(e) => return Err(DecodeError::Symphonia(e)),
        };

        let spec = *decoded.spec();
        let mut sample_buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
        sample_buf.copy_interleaved_ref(decoded);
        all_samples.extend_from_slice(sample_buf.samples());
    }

    if all_samples.is_empty() {
        return Err(DecodeError::NoSamples);
    }

    Ok(AudioBuffer::new(all_samples, channels, sample_rate))
}
