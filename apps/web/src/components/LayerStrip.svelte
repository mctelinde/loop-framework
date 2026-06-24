<script lang="ts">
  import WaveformCanvas from './WaveformCanvas.svelte';
  import Knob from './Knob.svelte';
  import { setVolume, setPan, setMuted, setSoloed, setLoopRegion, replaceLayerAudio } from '../lib/layerStore';
  import type { LayerState } from '../lib/layerStore';

  interface Props { layer: LayerState; }
  let { layer }: Props = $props();

  // ── Drop-to-replace ────────────────────────────────────────────────────────

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
    e.stopPropagation(); // don't bubble up to LayerList
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

  // Fader drag state
  let faderDragging = $state(false);
  let faderStartY = $state(0);
  let faderStartVol = $state(0);

  function onFaderPointerDown(e: PointerEvent) {
    faderDragging = true;
    faderStartY = e.clientY;
    faderStartVol = layer.volume;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onFaderPointerMove(e: PointerEvent) {
    if (!faderDragging) return;
    const delta = (faderStartY - e.clientY) / 120;
    setVolume(layer.id, Math.max(0, Math.min(1, faderStartVol + delta)));
  }

  function onFaderPointerUp() { faderDragging = false; }

  function onFaderScroll(e: WheelEvent) {
    e.preventDefault();
    setVolume(layer.id, Math.max(0, Math.min(1, layer.volume + (e.deltaY < 0 ? 0.02 : -0.02))));
  }

  // Volume display: convert 0–1 to dB (-∞ to 0)
  function volToDb(v: number): string {
    if (v <= 0) return '-∞';
    const db = 20 * Math.log10(v);
    return (db >= 0 ? '+' : '') + db.toFixed(1);
  }

  // Fader fill height (0% at bottom = 0.0, 100% = 1.0)
  let faderFill = $derived(`${layer.volume * 100}%`);
  // Thumb position from bottom
  let thumbBottom = $derived(`calc(${layer.volume * 100}% - 6px)`);
</script>

<div
  class="strip"
  class:muted={layer.muted}
  class:soloed={layer.soloed}
  class:drop-target={isDropTarget}
  role="region"
  aria-label="Layer: {layer.name}"
  ondragover={onStripDragOver}
  ondragleave={onStripDragLeave}
  ondrop={onStripDrop}
>
  {#if replaceError}
    <div class="replace-error" title={replaceError}>!</div>
  {/if}

  <!-- ── Name ──────────────────────────────────────────────────────── -->
  <div class="strip-name" title={layer.name}>{layer.name}</div>

  <!-- ── Waveform + loop region ────────────────────────────────────── -->
  <WaveformCanvas
    peaks={layer.waveformPeaks}
    duration={layer.duration}
    loopStart={layer.loopStart}
    loopEnd={layer.loopEnd}
    onLoopChange={(s, e) => setLoopRegion(layer.id, s, e)}
  />

  <!-- ── Loop time display ─────────────────────────────────────────── -->
  <div class="loop-times">
    <span>{layer.loopStart.toFixed(2)}s</span>
    <span>{layer.loopEnd.toFixed(2)}s</span>
  </div>

  <!-- ── Mute / Solo ───────────────────────────────────────────────── -->
  <div class="ms-row">
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

  <!-- ── Pan knob ──────────────────────────────────────────────────── -->
  <div class="pan-row">
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

  <!-- ── Volume fader ──────────────────────────────────────────────── -->
  <div
    class="fader-track"
    class:dragging={faderDragging}
    onpointerdown={onFaderPointerDown}
    onpointermove={onFaderPointerMove}
    onpointerup={onFaderPointerUp}
    onwheel={onFaderScroll}
    title="Volume: {volToDb(layer.volume)} dB (drag or scroll)"
    role="slider"
    aria-label="Volume"
    aria-valuemin={0}
    aria-valuemax={1}
    aria-valuenow={layer.volume}
    tabindex="0"
  >
    <div class="fader-fill" style="height: {faderFill}"></div>
    <div class="fader-thumb" style="bottom: {thumbBottom}"></div>
    <div class="fader-unity" title="Unity (0 dB)"></div>
  </div>

  <!-- ── dB readout ────────────────────────────────────────────────── -->
  <div class="db-display">{volToDb(layer.volume)} dB</div>

</div>

<style>
  .strip {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 80px;
    flex-shrink: 0;
    background: #161616;
    border-right: 1px solid #222;
    user-select: none;
    position: relative;
  }

  .strip.muted { opacity: 0.45; }
  .strip.soloed { box-shadow: inset 0 0 0 1px #ffa726; }
  .strip.drop-target {
    outline: 2px dashed #4caf50;
    outline-offset: -2px;
    background: #161e16;
  }

  .replace-error {
    position: absolute;
    top: 2px; right: 2px;
    width: 14px; height: 14px;
    background: #f44336;
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: help;
  }

  /* ── Name ── */
  .strip-name {
    font-size: 0.7rem;
    font-weight: 600;
    color: #aaa;
    padding: 0.3rem 0.4rem 0.2rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-bottom: 1px solid #1e1e1e;
    text-align: center;
  }

  /* ── Loop times ── */
  .loop-times {
    display: flex;
    justify-content: space-between;
    padding: 0.15rem 0.35rem;
    font-size: 0.55rem;
    font-variant-numeric: tabular-nums;
    color: #444;
    background: #111;
    border-bottom: 1px solid #1e1e1e;
  }

  /* ── Mute / Solo ── */
  .ms-row {
    display: flex;
    gap: 0.25rem;
    padding: 0.35rem 0.4rem;
    border-bottom: 1px solid #1e1e1e;
  }

  .ms-btn {
    flex: 1;
    padding: 0.2rem 0;
    border-radius: 3px;
    font-size: 0.7rem;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid #2a2a2a;
    background: #1e1e1e;
    color: #555;
    transition: all 0.1s;
  }

  .ms-btn.mute.active  { background: #3a1a1a; border-color: #7a3030; color: #f44336; }
  .ms-btn.solo.active  { background: #3a2e0a; border-color: #7a6020; color: #ffa726; }
  .ms-btn:hover        { background: #252525; color: #aaa; }

  /* ── Pan ── */
  .pan-row {
    display: flex;
    justify-content: center;
    padding: 0.25rem 0 0.1rem;
    border-bottom: 1px solid #1e1e1e;
  }

  /* ── Fader ── */
  .fader-track {
    flex: 1;
    position: relative;
    margin: 0.5rem auto;
    width: 16px;
    background: #111;
    border: 1px solid #222;
    border-radius: 8px;
    cursor: ns-resize;
    min-height: 80px;
  }

  .fader-track:focus { outline: 1px solid #4caf5066; }
  .fader-track.dragging { cursor: ns-resize; }

  .fader-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: #2a4a2a;
    border-radius: 0 0 8px 8px;
    transition: height 0.05s;
  }

  .fader-thumb {
    position: absolute;
    left: -4px;
    right: -4px;
    height: 12px;
    background: #ccc;
    border: 1px solid #888;
    border-radius: 3px;
    transition: bottom 0.05s;
  }

  .fader-track:hover .fader-thumb { background: #fff; }

  /* Unity (0 dB) notch at 100% = full volume */
  .fader-unity {
    position: absolute;
    bottom: calc(100% - 2px);
    left: -2px;
    right: -2px;
    height: 1px;
    background: #4caf5055;
  }

  /* ── dB readout ── */
  .db-display {
    text-align: center;
    font-size: 0.6rem;
    font-variant-numeric: tabular-nums;
    color: #555;
    padding: 0.15rem 0 0.3rem;
  }
</style>
