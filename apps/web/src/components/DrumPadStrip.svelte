<script lang="ts">
  import Knob from './Knob.svelte';
  import {
    setVolume,
    setPan,
    setMuted,
    setSoloed,
    updateDrumPadStrokes,
    addLayer,
    type DrumPadLayerState,
    type DrumStroke,
  } from '../lib/layerStore';
  import { engine } from '../lib/engineStore';
  import { get } from 'svelte/store';
  import { DRUM_PAD_KEYS, triggerDrumPadHit, quantizeStrokes, renderDrumStrokesToWav } from '../lib/drumPadAudio';

  interface Props { layer: DrumPadLayerState; }
  let { layer }: Props = $props();

  let recording = $state(false);
  let recordStartMs = $state(0);
  let rawStrokes = $state<DrumStroke[]>([]);
  let recordError = $state<string | null>(null);

  function currentCtx(): AudioContext | null {
    return get(engine)?.getAudioContext() ?? null;
  }

  function trigger(index: number): void {
    const ctx = currentCtx();
    if (!ctx) return;
    triggerDrumPadHit(ctx, index, layer.volume);
    if (!recording) return;
    rawStrokes = [
      ...rawStrokes,
      {
        padIndex: index,
        time: Math.max(0, (Date.now() - recordStartMs) / 1000),
        velocity: 1,
      },
    ];
  }

  function startRecord(): void {
    recordError = null;
    rawStrokes = [];
    recording = true;
    recordStartMs = Date.now();
  }

  async function stopRecord(): Promise<void> {
    if (!recording) return;
    recording = false;
    if (rawStrokes.length === 0) {
      updateDrumPadStrokes(layer.id, []);
      return;
    }

    const quantized = quantizeStrokes(rawStrokes);
    updateDrumPadStrokes(layer.id, quantized);

    try {
      const wav = renderDrumStrokesToWav(quantized);
      const wavBytes = new Uint8Array(wav.byteLength);
      wavBytes.set(wav);
      const file = new File([wavBytes.buffer], `${layer.name.replace(/\s+/g, '-').toLowerCase()}-take.wav`, {
        type: 'audio/wav',
      });
      await addLayer(file);
    } catch (err) {
      recordError = `Failed to render drum take: ${err}`;
    }
  }

  function clearPattern(): void {
    rawStrokes = [];
    updateDrumPadStrokes(layer.id, []);
  }

  const padPositions = DRUM_PAD_KEYS.map((key, i) => {
    const angle = (Math.PI * 2 * i) / DRUM_PAD_KEYS.length - Math.PI / 2;
    return {
      ...key,
      x: 50 + Math.cos(angle) * 34,
      y: 50 + Math.sin(angle) * 34,
    };
  });

  function volToDb(v: number): string {
    if (v <= 0) return '-∞';
    const db = 20 * Math.log10(v);
    return `${db >= 0 ? '+' : ''}${db.toFixed(1)}`;
  }

  let faderDragging = $state(false);
  let faderStartY = $state(0);
  let faderStartVol = $state(0);
  let faderFill = $derived(`${layer.volume * 100}%`);
  let thumbBottom = $derived(`calc(${layer.volume * 100}% - 6px)`);

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
</script>

<div class="strip" class:muted={layer.muted} class:soloed={layer.soloed}>
  <div class="strip-name" title={layer.name}>{layer.name}</div>
  <div class="type-badge">Drum Pad</div>

  <div class="pad-surface" role="group" aria-label="Circular drum pad">
    {#each padPositions as pad}
      <button
        class="pad-key"
        style={`left:${pad.x}%;top:${pad.y}%;--key-color:${pad.color};`}
        onclick={() => trigger(pad.index)}
        aria-label={`Trigger ${pad.label}`}
        title={pad.label}
      >
        {pad.label}
      </button>
    {/each}
    <div class="pad-center">
      {#if recording}REC{:else}{layer.strokes.length} hits{/if}
    </div>
  </div>

  <div class="pad-controls">
    {#if recording}
      <button class="record-btn active" onclick={stopRecord}>Stop + Commit</button>
    {:else}
      <button class="record-btn" onclick={startRecord}>Record Strokes</button>
    {/if}
    <button class="clear-btn" onclick={clearPattern} disabled={recording}>Clear</button>
  </div>

  {#if recordError}
    <div class="record-error" title={recordError}>⚠ {recordError}</div>
  {/if}

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

  <div
    class="fader-track"
    class:dragging={faderDragging}
    onpointerdown={onFaderPointerDown}
    onpointermove={onFaderPointerMove}
    onpointerup={onFaderPointerUp}
    title="Volume: {volToDb(layer.volume)} dB"
    role="slider"
    aria-label="Volume"
    aria-valuemin={0}
    aria-valuemax={1}
    aria-valuenow={layer.volume}
    tabindex="0"
  >
    <div class="fader-fill" style="height: {faderFill}"></div>
    <div class="fader-thumb" style="bottom: {thumbBottom}"></div>
  </div>
  <div class="db-display">{volToDb(layer.volume)} dB</div>
</div>

<style>
  .strip {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 220px;
    flex-shrink: 0;
    background: #161616;
    border-right: 1px solid #222;
    position: relative;
  }
  .strip.muted { opacity: 0.45; }
  .strip.soloed { box-shadow: inset 0 0 0 1px #ffa726; }
  .strip-name {
    font-size: 0.72rem;
    font-weight: 700;
    color: #d0d0d0;
    padding: 0.35rem 0.5rem 0.2rem;
    text-align: center;
  }
  .type-badge {
    font-size: 0.62rem;
    color: #7dd3fc;
    text-align: center;
    padding-bottom: 0.2rem;
  }
  .pad-surface {
    margin: 0.3rem auto 0.4rem;
    position: relative;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    border: 1px solid #2b2b2b;
    background: radial-gradient(circle at 50% 50%, #202020 0%, #131313 70%);
  }
  .pad-key {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--key-color) 55%, #222);
    background: color-mix(in srgb, var(--key-color) 28%, #111);
    color: #f4f4f4;
    font-size: 0.62rem;
    font-weight: 700;
    cursor: pointer;
  }
  .pad-key:hover { filter: brightness(1.15); }
  .pad-center {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-size: 0.64rem;
    color: #bbb;
    text-align: center;
    width: 64px;
  }
  .pad-controls {
    display: flex;
    gap: 0.4rem;
    padding: 0 0.6rem 0.4rem;
  }
  .record-btn,
  .clear-btn {
    flex: 1;
    padding: 0.25rem 0.45rem;
    font-size: 0.68rem;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid #333;
    background: #202020;
    color: #ddd;
  }
  .record-btn.active {
    background: #a32929;
    border-color: #d84343;
    color: #fff;
  }
  .clear-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .record-error {
    margin: 0 0.6rem 0.4rem;
    font-size: 0.64rem;
    color: #ef5350;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ms-row {
    display: flex;
    gap: 0.25rem;
    padding: 0.35rem 0.5rem;
    border-top: 1px solid #1e1e1e;
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
  }
  .ms-btn.mute.active  { background: #3a1a1a; border-color: #7a3030; color: #f44336; }
  .ms-btn.solo.active  { background: #3a2e0a; border-color: #7a6020; color: #ffa726; }
  .pan-row {
    display: flex;
    justify-content: center;
    padding: 0.3rem 0;
    border-bottom: 1px solid #1e1e1e;
  }
  .fader-track {
    flex: 1;
    position: relative;
    margin: 0.5rem auto;
    width: 16px;
    background: #111;
    border: 1px solid #222;
    border-radius: 8px;
    min-height: 60px;
    cursor: ns-resize;
  }
  .fader-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: #2a4a2a;
    border-radius: 0 0 8px 8px;
  }
  .fader-thumb {
    position: absolute;
    left: -4px;
    right: -4px;
    height: 12px;
    background: #ccc;
    border: 1px solid #888;
    border-radius: 3px;
  }
  .db-display {
    text-align: center;
    font-size: 0.6rem;
    color: #555;
    padding: 0.15rem 0 0.35rem;
  }
</style>
