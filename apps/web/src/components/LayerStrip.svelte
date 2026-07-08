<script lang="ts">
  import WaveformCanvas from './WaveformCanvas.svelte';
  import Knob from './Knob.svelte';
  import { setVolume, setPan, setMuted, setSoloed, setLoopRegion, replaceLayerAudio } from '../lib/layerStore';
  import { timeToPercent } from '../lib/timelineLayout';
  import type { AudioLayerState } from '../lib/layerStore';

  interface Props {
    layer: AudioLayerState;
    timelineDuration: number;
  }

  let { layer, timelineDuration }: Props = $props();

  const ACCEPTED_MIME = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp3', 'audio/x-wav'];
  let isDropTarget = $state(false);
  let replaceError = $state<string | null>(null);

  function isAudioDrag(e: DragEvent): boolean {
    return Array.from(e.dataTransfer?.types ?? []).includes('Files');
  }

  function onStripDragOver(e: DragEvent) {
    if (!isAudioDrag(e)) return;
    e.preventDefault();
    isDropTarget = true;
  }

  function onStripDragLeave() { isDropTarget = false; }

  async function onStripDrop(e: DragEvent) {
    if (!isAudioDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    isDropTarget = false;
    replaceError = null;

    const file = Array.from(e.dataTransfer?.files ?? []).find(
      (f) => ACCEPTED_MIME.includes(f.type) || /\.(wav|mp3|ogg)$/i.test(f.name),
    );
    if (!file) return;

    try {
      await replaceLayerAudio(layer.id, file);
    } catch (err) {
      replaceError = String(err);
    }
  }

  function volToDb(v: number): string {
    if (v <= 0) return '-∞';
    const db = 20 * Math.log10(v);
    return `${db >= 0 ? '+' : ''}${db.toFixed(1)}`;
  }

  let clipWidth = $derived(Math.max(8, timeToPercent(layer.duration, timelineDuration)));
</script>

<div
  class="track-row"
  class:muted={layer.muted}
  class:soloed={layer.soloed}
  class:drop-target={isDropTarget}
  role="region"
  aria-label="Layer: {layer.name}"
  ondragover={onStripDragOver}
  ondragleave={onStripDragLeave}
  ondrop={onStripDrop}
>
  <div class="track-controls">
    {#if replaceError}
      <div class="replace-error" title={replaceError}>!</div>
    {/if}

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

    <div class="loop-times">
      <span>{layer.loopStart.toFixed(2)}s</span>
      <span>{layer.loopEnd.toFixed(2)}s</span>
    </div>
  </div>

  <div class="timeline-cell">
    <div class="timeline-strip">
      <div class="timeline-clip" style={`width:${clipWidth}%;`}>
        <WaveformCanvas
          peaks={layer.waveformPeaks}
          duration={layer.duration}
          loopStart={layer.loopStart}
          loopEnd={layer.loopEnd}
          onLoopChange={(s, e) => setLoopRegion(layer.id, s, e)}
        />
      </div>
    </div>
  </div>
</div>

<style>
  .track-row {
    display: grid;
    grid-template-columns: var(--track-meta-width, 360px) minmax(0, 1fr);
    gap: 0.65rem;
    padding: 0.5rem 0.65rem;
    min-height: var(--track-row-height, 82px);
    border-bottom: 1px solid #242424;
    background: #141414;
    position: relative;
  }

  .track-row.muted { opacity: 0.55; }
  .track-row.soloed { box-shadow: inset 0 0 0 1px #8a6f2a; }
  .track-row.drop-target {
    outline: 2px dashed #4caf50;
    outline-offset: -2px;
    background: #172017;
  }

  .track-controls {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
    position: relative;
  }

  .replace-error {
    position: absolute;
    top: 0.1rem;
    right: 0.2rem;
    width: 14px;
    height: 14px;
    border-radius: 999px;
    background: #f44336;
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: help;
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
    accent-color: #4caf50;
  }

  .db {
    min-width: 3.6rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #7f7f7f;
  }

  .loop-times {
    margin-left: auto;
    min-width: 5.8rem;
    display: flex;
    justify-content: space-between;
    gap: 0.3rem;
    padding: 0.2rem 0.35rem;
    border-radius: 6px;
    border: 1px solid #2c2c2c;
    background: #111;
    font-size: 0.62rem;
    color: #848484;
    font-variant-numeric: tabular-nums;
  }

  .timeline-cell {
    min-width: 0;
    display: flex;
    align-items: center;
  }

  .timeline-strip {
    width: 100%;
    height: 66px;
    border-radius: 7px;
    border: 1px solid #2a2a2a;
    background: linear-gradient(180deg, #171717 0%, #121212 100%);
    overflow: hidden;
  }

  .timeline-clip {
    max-width: 100%;
    min-width: 0;
    height: 100%;
  }
</style>
