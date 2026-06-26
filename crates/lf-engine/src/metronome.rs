/// Metronome: generates click sounds synchronized with the transport.
///
/// Uses a simple oscillator-based approach to generate clicks at beat boundaries.
/// The click is a brief sine wave burst, with optional accent on beat 1.

const CLICK_DURATION_MS: f32 = 25.0;
const ACCENT_GAIN: f32 = 0.8;
const NORMAL_GAIN: f32 = 0.5;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClickState {
    Inactive,
    Active,
}

pub struct Metronome {
    enabled: bool,
    pub volume: f32,
    /// Samples remaining for the current click
    click_samples_remaining: u32,
    /// True if the current click is accented (beat 1)
    is_accented: bool,
    /// Phase accumulator for sine wave generation
    phase: f32,
    /// Sample rate for calculating click duration
    sample_rate: u32,
    /// Click frequency in Hz
    click_freq: f32,
}

impl Metronome {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            enabled: false,
            volume: 0.3,
            click_samples_remaining: 0,
            is_accented: false,
            phase: 0.0,
            sample_rate,
            click_freq: 800.0,
        }
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
        if !enabled {
            self.click_samples_remaining = 0;
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn set_volume(&mut self, volume: f32) {
        self.volume = volume.clamp(0.0, 1.0);
    }

    /// Trigger a click at the given beat position.
    /// `is_beat_one` indicates if this is beat 1 (should be accented).
    pub fn trigger_click(&mut self, is_beat_one: bool) {
        if !self.enabled {
            return;
        }
        let click_duration_samples = ((CLICK_DURATION_MS / 1000.0) * self.sample_rate as f32) as u32;
        self.click_samples_remaining = click_duration_samples.max(1);
        self.is_accented = is_beat_one;
        self.phase = 0.0;
    }

    /// Generate one sample of metronome output (or 0.0 if inactive).
    pub fn next_sample(&mut self) -> f32 {
        if self.click_samples_remaining == 0 {
            return 0.0;
        }

        // Generate a sine wave at click_freq
        let sample = (self.phase * 2.0 * std::f32::consts::PI).sin();

        // Apply a simple envelope: linear fade-out
        let envelope = self.click_samples_remaining as f32 / ((CLICK_DURATION_MS / 1000.0) * self.sample_rate as f32);

        // Select gain based on accent
        let gain = if self.is_accented {
            ACCENT_GAIN
        } else {
            NORMAL_GAIN
        };

        self.click_samples_remaining -= 1;

        // Advance phase for next sample
        self.phase += self.click_freq / self.sample_rate as f32;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }

        sample * envelope * gain * self.volume
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metronome_disabled_by_default() {
        let metro = Metronome::new(48000);
        assert!(!metro.is_enabled());
    }

    #[test]
    fn trigger_click_enables_output() {
        let mut metro = Metronome::new(48000);
        metro.set_enabled(true);
        metro.trigger_click(false);
        assert_ne!(metro.next_sample(), 0.0);
    }

    #[test]
    fn click_duration_expires() {
        let mut metro = Metronome::new(48000);
        metro.set_enabled(true);
        metro.trigger_click(false);

        // Sample enough times to exhaust the click
        let max_samples = ((CLICK_DURATION_MS / 1000.0) * 48000.0) as usize + 10;
        for _ in 0..max_samples {
            let _ = metro.next_sample();
        }

        // Should return silence after click expires
        assert_eq!(metro.next_sample(), 0.0);
    }

    #[test]
    fn volume_control_works() {
        let mut metro = Metronome::new(48000);
        metro.set_enabled(true);
        metro.set_volume(0.0);
        metro.trigger_click(false);
        assert_eq!(metro.next_sample(), 0.0);

        metro.set_volume(1.0);
        metro.trigger_click(false);
        assert_ne!(metro.next_sample(), 0.0);
    }
}
