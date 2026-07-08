<script lang="ts">
  import Knob from './Knob.svelte';
  import {
    setVolume,
    setPan,
    setMuted,
    setSoloed,
    type DrumPadLayerState,
  } from '../lib/layerStore';
  import { DRUM_PAD_KEYS } from '../lib/drumPadAudio';
  import { timeToPercent } from '../lib/timelineLayout';

  interface Props {
    layer: DrumPadLayerState;
    timelineDuration: number;
    docked: boolean;
    onToggleDock: () => void;
  }

  let { layer, timelineDuration, docked, onToggleDock }: Props = $props();

  function volToDb(v: number): string {
    if (v <= 0) return '-∞';
    const db = 20 * Math.log10(v);
    return `${db >= 0 ? '+' : ''}${db.toFixed(1)}`;
  }
</script>

<div class="track-row" class:muted={layer.muted} class:soloed={layer.soloed}>
  <div class="track-controls">
    <div class="track-head">
      <div class="track-name" title={layer.name}>{layer.name}</div>
      <span class="type-pill">Drum Pad</span>
    </div>

    <div class="control-cluster">
      <button
        class="ms-btn mute"
        class:active={layer.muted}
        onclick={() => setMuted(layer.id, !layer.muted)}
        aria-pressed={layer.muted}
        title="Mute"
      >M</button>
      <button
        class="ms-btn solo"
        class:active={layer.soloed}
        onclick={() => setSoloed(layer.id, !layer.soloed)}
        aria-pressed={layer.soloed}
        title="Solo"
      >S</button>
    </div>

    <div class="control-cluster">
      <Knob
        value={layer.pan}
        min={-1}
        max={1}
        default={0}
        step={0.01}
        label="Pan"
        onChange={(v) => setPan(layer.id, v)}
      />
    </div>

    <label class="volume-inline">
      <span>Vol</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={layer.volume}
        oninput={(e) => setVolume(layer.id, parseFloat(e.currentTarget.value))}
        aria-label="Volume for {layer.name}"
      />
      <span class="db">{volToDb(layer.volume)} dB</span>
    </label>

    <button class="dock-btn" class:active={docked} onclick={onToggleDock}>
      {docked ? 'Hide Pad' : 'Open Pad'}
    </button>
  </div>

  <div class="timeline-cell">
    <div class="timeline-strip">
      {#if layer.strokes.length > 0}
        {#each layer.strokes as stroke, index (`${stroke.padIndex}-${stroke.time}-${index}`)}
          <span
            class="stroke-marker"
            style={`left:${timeToPercent(stroke.time, timelineDuration)}%;--stroke-color:${DRUM_PAD_KEYS[stroke.padIndex]?.color ?? '#9ca3af'};`}
            title={`${DRUM_PAD_KEYS[stroke.padIndex]?.label ?? 'Pad'} @ ${stroke.time.toFixed(2)}s`}
          ></span>
        {/each}
      {:else}
        <div class="empty-pattern">No pattern recorded</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .track-row {
    display: grid;
    grid-template-columns: var(--track-meta-width, 360px) minmax(0, 1fr);
    gap: 0.65rem;
    padding: 0.5rem 0.65rem;
    border-bottom: 1px solid #242424;
    background: #141414;
  }

  .track-row.muted { opacity: 0.55; }
  .track-row.soloed { box-shadow: inset 0 0 0 1px #8a6f2a; }

  .track-controls {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
  }

  .track-head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 8rem;
    max-width: 9.5rem;
  }

  .track-name {
    color: #d0d0d0;
    font-size: 0.78rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .type-pill {
    flex-shrink: 0;
    font-size: 0.62rem;
    color: #d8b4fe;
    border: 1px solid #4b3567;
    background: #21192d;
    border-radius: 999px;
    padding: 0.06rem 0.35rem;
  }

  .control-cluster {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .ms-btn {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
    border: 1px solid #2a2a2a;
    background: #1d1d1d;
    color: #666;
    cursor: pointer;
  }

  .ms-btn.mute.active { background: #3a1a1a; border-color: #7a3030; color: #f44336; }
  .ms-btn.solo.active { background: #3a2e0a; border-color: #7a6020; color: #ffa726; }

  .volume-inline {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.7rem;
    color: #9aa7a2;
    min-width: 10rem;
  }

  .volume-inline input {
    width: 6rem;
    accent-color: #8b5cf6;
  }

  .db {
    min-width: 3.6rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #7f7f7f;
  }

  .dock-btn {
    margin-left: auto;
    border: 1px solid #3b2f5c;
    border-radius: 5px;
    background: #1f1830;
    color: #d7c6ff;
    font-size: 0.68rem;
    padding: 0.3rem 0.55rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .dock-btn.active {
    background: #352651;
    color: #f1eaff;
  }

  .timeline-cell {
    min-width: 0;
    display: flex;
    align-items: center;
  }

  .timeline-strip {
    position: relative;
    width: 100%;
    height: 66px;
    border-radius: 7px;
    border: 1px solid #2a2a2a;
    background: linear-gradient(180deg, #171717 0%, #121212 100%);
    overflow: hidden;
  }

  .stroke-marker {
    position: absolute;
    top: 14%;
    bottom: 14%;
    width: 2px;
    transform: translateX(-1px);
    background: color-mix(in srgb, var(--stroke-color) 72%, #f8fafc);
    box-shadow: 0 0 6px color-mix(in srgb, var(--stroke-color) 45%, transparent);
  }

  .empty-pattern {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #5f5f5f;
    font-size: 0.72rem;
  }
</style>
