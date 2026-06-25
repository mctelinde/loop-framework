<script lang="ts">
  import {
    transportState, bpm, timeSig,
    play, pause, stop, setBpm, setTimeSig, tap,
    TIME_SIGNATURES,
  } from '../lib/transportStore';

  // BPM input: allow typing a value directly.
  let editingBpm = $state(false);
  let bpmInput = $state('');

  function startBpmEdit() {
    bpmInput = String($bpm);
    editingBpm = true;
  }

  function commitBpmEdit() {
    const v = parseInt(bpmInput, 10);
    if (!isNaN(v)) setBpm(v);
    editingBpm = false;
  }

  function onBpmKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') commitBpmEdit();
    if (e.key === 'Escape') editingBpm = false;
  }

  // Scroll on the BPM display nudges by 1.
  function onBpmScroll(e: WheelEvent) {
    e.preventDefault();
    setBpm($bpm + (e.deltaY < 0 ? 1 : -1));
  }

  // Hold +/− buttons to accelerate.
  let holdInterval: ReturnType<typeof setInterval> | null = null;
  let holdTimeout: ReturnType<typeof setTimeout> | null = null;

  function startHold(delta: number) {
    setBpm($bpm + delta);
    holdTimeout = setTimeout(() => {
      holdInterval = setInterval(() => setBpm($bpm + delta), 80);
    }, 400);
  }

  function endHold() {
    if (holdTimeout) { clearTimeout(holdTimeout); holdTimeout = null; }
    if (holdInterval) { clearInterval(holdInterval); holdInterval = null; }
  }
</script>

<div class="transport">
  <!-- ── Play / Pause / Stop ────────────────────────────────────────── -->
  <div class="btn-group">
    {#if $transportState === 'playing'}
      <button class="btn btn-active" onclick={pause} title="Pause">
        <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>
        Pause
      </button>
    {:else}
      <button class="btn btn-play" onclick={play} title="Play">
        <svg viewBox="0 0 16 16" aria-hidden="true"><polygon points="3,1 15,8 3,15"/></svg>
        Play
      </button>
    {/if}
    <button class="btn" onclick={stop} disabled={$transportState === 'stopped'} title="Stop">
      <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="1.5"/></svg>
      Stop
    </button>
  </div>

  <div class="divider"></div>

  <!-- ── BPM ───────────────────────────────────────────────────────── -->
  <div class="bpm-control" role="group" aria-label="BPM">
    <span class="label">BPM</span>
    <button
      class="adj-btn"
      onmousedown={() => startHold(-1)}
      onmouseup={endHold}
      onmouseleave={endHold}
      aria-label="Decrease BPM"
    >−</button>

    {#if editingBpm}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="bpm-input"
        type="number"
        min="40"
        max="240"
        autofocus
        bind:value={bpmInput}
        onblur={commitBpmEdit}
        onkeydown={onBpmKeydown}
      />
    {:else}
      <button
        class="bpm-display"
        onclick={startBpmEdit}
        onwheel={onBpmScroll}
        title="Click to edit, scroll to adjust"
        aria-label="BPM: {$bpm}"
      >{$bpm}</button>
    {/if}

    <button
      class="adj-btn"
      onmousedown={() => startHold(1)}
      onmouseup={endHold}
      onmouseleave={endHold}
      aria-label="Increase BPM"
    >+</button>

    <button class="btn tap-btn" onclick={tap} title="Tap Tempo">Tap</button>
  </div>

  <div class="divider"></div>

  <!-- ── Time Signature ────────────────────────────────────────────── -->
  <div class="timesig-control" role="group" aria-label="Time signature">
    <span class="label">Time</span>
    <div class="timesig-options">
      {#each TIME_SIGNATURES as sig}
        <button
          class="timesig-btn"
          class:active={$timeSig.label === sig.label}
          onclick={() => setTimeSig(sig)}
          aria-pressed={$timeSig.label === sig.label}
        >{sig.label}</button>
      {/each}
    </div>
  </div>
</div>

<style>
  .transport {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1.5rem;
    background: #181818;
    border-bottom: 1px solid #2a2a2a;
    flex-wrap: wrap;
    overflow-x: hidden;
  }

  @media (max-width: 640px) {
    .transport {
      padding: 0.4rem 1rem;
      gap: 0.5rem;
    }
  }

  .divider {
    width: 1px;
    height: 1.5rem;
    background: #2a2a2a;
    flex-shrink: 0;
  }

  /* ── Buttons ── */
  .btn-group {
    display: flex;
    gap: 0.4rem;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.75rem;
    background: #252525;
    border: 1px solid #333;
    border-radius: 5px;
    color: #ccc;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }

  @media (max-width: 640px) {
    .btn {
      padding: 0.25rem 0.5rem;
      font-size: 0.65rem;
      gap: 0.2rem;
    }
  }

  .btn:hover:not(:disabled) { background: #2e2e2e; color: #fff; }
  .btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .btn svg {
    width: 10px;
    height: 10px;
    fill: currentColor;
    flex-shrink: 0;
  }

  .btn-play { color: #4caf50; border-color: #2e5c2e; }
  .btn-play:hover { background: #1a3a1a; color: #66bb6a; }

  .btn-active { color: #ffa726; border-color: #5c3a1a; }
  .btn-active:hover { background: #3a2610; color: #ffb74d; }

  /* ── BPM ── */
  .bpm-control {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .label {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #555;
    margin-right: 0.1rem;
  }

  .bpm-display {
    min-width: 3.2rem;
    text-align: center;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 4px;
    color: #e8e8e8;
    font-size: 1.1rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    padding: 0.2rem 0.4rem;
    cursor: text;
    user-select: none;
  }

  @media (max-width: 640px) {
    .bpm-display {
      min-width: 2.5rem;
      font-size: 0.9rem;
      padding: 0.15rem 0.3rem;
    }

    .label {
      font-size: 0.6rem;
    }
  }

  .bpm-input {
    width: 3.6rem;
    text-align: center;
    background: #1a1a1a;
    border: 1px solid #4caf50;
    border-radius: 4px;
    color: #e8e8e8;
    font-size: 1.1rem;
    font-weight: 600;
    padding: 0.2rem 0.4rem;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .bpm-input::-webkit-outer-spin-button,
  .bpm-input::-webkit-inner-spin-button { -webkit-appearance: none; }

  .adj-btn {
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #222;
    border: 1px solid #333;
    border-radius: 4px;
    color: #888;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    user-select: none;
  }

  @media (max-width: 640px) {
    .adj-btn {
      width: 1.2rem;
      height: 1.2rem;
      font-size: 0.8rem;
    }
  }

  .adj-btn:hover { background: #2e2e2e; color: #fff; }
  .adj-btn:active { background: #1a1a1a; }

  .tap-btn {
    padding: 0.25rem 0.6rem;
    font-size: 0.75rem;
    background: #1e2a1e;
    border-color: #2e4a2e;
    color: #4caf50;
  }
  .tap-btn:hover { background: #243024; color: #66bb6a; }

  @media (max-width: 640px) {
    .tap-btn {
      padding: 0.2rem 0.4rem;
      font-size: 0.6rem;
    }
  }

  /* ── Time sig ── */
  .timesig-control {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .timesig-options {
    display: flex;
    gap: 0.25rem;
  }

  .timesig-btn {
    padding: 0.25rem 0.5rem;
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 4px;
    color: #888;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.1s;
  }

  @media (max-width: 640px) {
    .timesig-btn {
      padding: 0.2rem 0.35rem;
      font-size: 0.65rem;
    }
  }

  .timesig-btn:hover { background: #2a2a2a; color: #ccc; }
  .timesig-btn.active {
    background: #1a2a3a;
    border-color: #2a6090;
    color: #5baee8;
  }
</style>
