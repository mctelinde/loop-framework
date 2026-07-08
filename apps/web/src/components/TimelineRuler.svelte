<script lang="ts">
  import { buildTimelineGrid, timeToPercent } from '../lib/timelineLayout';

  interface Props {
    duration: number;
    bpm: number;
    beatsPerBar: number;
  }

  let { duration, bpm, beatsPerBar }: Props = $props();
  let gridLines = $derived(buildTimelineGrid(duration, bpm, beatsPerBar));
</script>

<div class="timeline-ruler" role="presentation" aria-hidden="true">
  {#each gridLines as line (`${line.time}-${line.kind}`)}
    <div class="grid-line" class:measure={line.kind === 'measure'} style={`left:${timeToPercent(line.time, duration)}%;`}></div>
    {#if line.label}
      <div class="measure-label" style={`left:${timeToPercent(line.time, duration)}%;`}>
        {line.label}
      </div>
    {/if}
  {/each}
  <div class="timeline-end">{duration.toFixed(2)}s</div>
</div>

<style>
  .timeline-ruler {
    position: relative;
    min-height: 2rem;
    border: 1px solid #2b2b2b;
    border-radius: 8px;
    background: linear-gradient(180deg, #171717 0%, #121212 100%);
    overflow: hidden;
  }

  .grid-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: #2a2a2a;
  }

  .grid-line.measure {
    background: #3d5f3d;
  }

  .measure-label {
    position: absolute;
    top: 0.2rem;
    transform: translateX(0.25rem);
    font-size: 0.65rem;
    letter-spacing: 0.03em;
    color: #89a989;
    user-select: none;
  }

  .timeline-end {
    position: absolute;
    right: 0.45rem;
    top: 0.2rem;
    font-size: 0.6rem;
    color: #5e5e5e;
    font-variant-numeric: tabular-nums;
  }
</style>
