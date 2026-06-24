/// Given the current transport position (in samples) and a BPM + time signature,
/// return the number of samples until the next beat boundary.
///
/// This is used to implement quantised start/stop: a layer change is deferred
/// until the next beat so it stays in grid.
pub fn samples_to_next_beat(
    current_sample: u64,
    sample_rate: u32,
    bpm: f64,
    beats_per_bar: u32,
) -> u64 {
    let _ = beats_per_bar; // reserved for bar-level quantisation
    let samples_per_beat = (sample_rate as f64 * 60.0 / bpm) as u64;
    if samples_per_beat == 0 {
        return 0;
    }
    let phase = current_sample % samples_per_beat;
    if phase == 0 {
        0
    } else {
        samples_per_beat - phase
    }
}

/// Quantise a loop length (in samples) to the nearest beat boundary.
///
/// If `snap_up` is true, rounds up; otherwise rounds to the nearest beat.
pub fn quantise_loop_length(
    length_samples: u64,
    sample_rate: u32,
    bpm: f64,
    snap_up: bool,
) -> u64 {
    let samples_per_beat = (sample_rate as f64 * 60.0 / bpm) as u64;
    if samples_per_beat == 0 {
        return length_samples;
    }
    let beats = if snap_up {
        (length_samples + samples_per_beat - 1) / samples_per_beat
    } else {
        let low = length_samples / samples_per_beat;
        let high = low + 1;
        let mid = (low * samples_per_beat + high * samples_per_beat) / 2;
        if length_samples >= mid { high } else { low }
    };
    beats * samples_per_beat
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn next_beat_at_boundary() {
        // Exactly on a beat: no wait required.
        let spb = (44100.0 * 60.0 / 120.0) as u64; // 22050 samples @ 120 BPM
        assert_eq!(samples_to_next_beat(spb, 44100, 120.0, 4), 0);
    }

    #[test]
    fn next_beat_midway() {
        let spb = (44100.0 * 60.0 / 120.0) as u64;
        let half = spb / 2;
        let remaining = samples_to_next_beat(half, 44100, 120.0, 4);
        assert_eq!(remaining, spb - half);
    }
}
