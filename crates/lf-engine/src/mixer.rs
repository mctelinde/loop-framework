use crate::layer::Layer;

/// Render one frame from all active layers into a stereo output pair.
///
/// `any_soloed` must be computed by the caller before iterating so that solo
/// semantics are applied consistently across all layers in the same frame.
pub fn mix_frame(layers: &mut [Layer], any_soloed: bool) -> (f32, f32) {
    let mut left = 0.0f32;
    let mut right = 0.0f32;

    for layer in layers.iter_mut() {
        if layer.muted {
            continue;
        }
        if any_soloed && !layer.soloed {
            continue;
        }

        let channels = layer.buffer.channels as usize;
        let frame = layer.playback_frame;

        let mono = layer.buffer.sample(frame, 0);
        let stereo_r = if channels > 1 {
            layer.buffer.sample(frame, 1)
        } else {
            mono
        };

        // Constant-power (equal-power) pan law
        let pan_angle = (layer.pan + 1.0) * 0.5 * std::f32::consts::FRAC_PI_2;
        let gain_l = pan_angle.cos() * layer.volume;
        let gain_r = pan_angle.sin() * layer.volume;

        left += mono * gain_l;
        right += stereo_r * gain_r;
    }

    // Soft clip to prevent inter-sample clipping
    (soft_clip(left), soft_clip(right))
}

/// Simple cubic soft-clip: passes values ≤ 1.0 through, rounds peaks smoothly.
#[inline]
fn soft_clip(x: f32) -> f32 {
    if x >= 1.0 {
        return 2.0 / 3.0;
    }
    if x <= -1.0 {
        return -2.0 / 3.0;
    }
    x - (x * x * x) / 3.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn soft_clip_at_zero() {
        assert!((soft_clip(0.0) - 0.0).abs() < 1e-6);
    }

    #[test]
    fn soft_clip_at_one_is_bounded() {
        assert!(soft_clip(1.5).abs() <= 1.0);
        assert!(soft_clip(-1.5).abs() <= 1.0);
    }
}
