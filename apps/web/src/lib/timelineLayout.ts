import type { LayerState } from './layerStore';

export interface TimelineGridLine {
  time: number;
  kind: 'measure' | 'beat';
  label?: string;
}

const MIN_TIMELINE_SECONDS = 4;

export function timeToPercent(time: number, duration: number): number {
  if (duration <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, time / duration));
  return ratio * 100;
}

export function resolveTimelineDuration(
  layers: LayerState[],
  bpm: number,
  beatsPerBar: number,
): number {
  const safeBpm = Math.max(1, bpm);
  const safeBeatsPerBar = Math.max(1, beatsPerBar);
  const barDuration = (60 / safeBpm) * safeBeatsPerBar;
  let maxSeconds = Math.max(MIN_TIMELINE_SECONDS, barDuration * 4);

  for (const layer of layers) {
    if (layer.type === 'audio') {
      maxSeconds = Math.max(maxSeconds, layer.duration, layer.loopEnd);
      continue;
    }
    const latestStroke = layer.strokes.reduce((latest, stroke) => Math.max(latest, stroke.time), 0);
    maxSeconds = Math.max(maxSeconds, latestStroke + barDuration);
  }

  const barCount = Math.max(1, Math.ceil(maxSeconds / barDuration));
  return Number((barCount * barDuration).toFixed(4));
}

export function buildTimelineGrid(
  duration: number,
  bpm: number,
  beatsPerBar: number,
): TimelineGridLine[] {
  if (duration <= 0) return [];
  const safeBpm = Math.max(1, bpm);
  const safeBeatsPerBar = Math.max(1, beatsPerBar);
  const beatDuration = 60 / safeBpm;
  const lineCount = Math.ceil(duration / beatDuration);
  const lines: TimelineGridLine[] = [];

  for (let i = 0; i <= lineCount; i += 1) {
    const time = i * beatDuration;
    if (time > duration + 0.0001) break;
    const measureIndex = Math.floor(i / safeBeatsPerBar);
    const isMeasure = i % safeBeatsPerBar === 0;
    lines.push({
      time,
      kind: isMeasure ? 'measure' : 'beat',
      label: isMeasure ? `${measureIndex + 1}` : undefined,
    });
  }

  return lines;
}
