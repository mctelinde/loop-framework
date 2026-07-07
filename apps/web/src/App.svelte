<script lang="ts">
  import { onMount } from 'svelte';
  import { initEngine, engineReady } from './lib/engineStore';
  import Transport from './components/Transport.svelte';
  import LayerList from './components/LayerList.svelte';
  import LayerStrip from './components/LayerStrip.svelte';
  import DrumPadStrip from './components/DrumPadStrip.svelte';
  import SessionControls from './components/SessionControls.svelte';
  import { layers, importing, addLayer, addDrumPadLayer } from './lib/layerStore';

  // ── Global drag overlay ────────────────────────────────────────────────────
  // Shows when a user drags files anywhere over the app window.

  let globalDragOver = $state(false);
  let globalDragCounter = 0; // counter avoids flicker on child crossings

  function onWindowDragEnter(e: DragEvent) {
    if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
    globalDragCounter++;
    globalDragOver = true;
  }

  function onWindowDragLeave() {
    globalDragCounter--;
    if (globalDragCounter <= 0) { globalDragCounter = 0; globalDragOver = false; }
  }

  function onWindowDrop() { globalDragCounter = 0; globalDragOver = false; }

  let initError = $state<string | null>(null);
  let emptyStateError = $state<string | null>(null);

  const ACCEPTED_MIME = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp3', 'audio/x-wav'];

  function filterAudioFiles(fileList: FileList | null): File[] {
    if (!fileList) return [];
    return Array.from(fileList).filter(
      (f) => ACCEPTED_MIME.includes(f.type) || /\.(wav|mp3|ogg)$/i.test(f.name),
    );
  }

  async function onEmptyStateAudioInput(e: Event) {
    emptyStateError = null;
    const input = e.currentTarget as HTMLInputElement;
    const files = filterAudioFiles(input.files);
    for (const file of files) {
      try {
        await addLayer(file);
      } catch (err) {
        emptyStateError = `Failed to load "${file.name}": ${err}`;
      }
    }
    input.value = '';
  }

  onMount(async () => {
    try {
      await initEngine();
    } catch (err) {
      initError = String(err);
    }
  });
</script>

<svelte:window
  ondragenter={onWindowDragEnter}
  ondragleave={onWindowDragLeave}
  ondrop={onWindowDrop}
/>

<main>
  <header class="app-header">
    <h1><span class="logo-loop">Loop</span><span class="logo-framework">Framework</span></h1>
    {#if !$engineReady && !initError}
      <span class="status loading">Loading engine…</span>
    {:else if initError}
      <span class="status error">Engine failed: {initError}</span>
    {:else}
      <span class="status ready">Engine ready</span>
    {/if}
    <div class="header-spacer"></div>
    {#if $engineReady}
      <SessionControls />
    {/if}
  </header>

  {#if $engineReady}
    <Transport />
    <div class="workspace">
      <LayerList />
      <div class="mixer-area">
        {#each $layers as layer (layer.id)}
          {#if layer.type === 'audio'}
            <LayerStrip {layer} />
          {:else}
            <DrumPadStrip {layer} />
          {/if}
        {:else}
          <div class="empty-actions">
            <p class="empty-title">Start building your loop</p>
            <div class="empty-action-buttons">
              <label class="empty-action audio" title="Add audio file">
                + Add Audio Layer
                <input
                  type="file"
                  accept=".wav,.mp3,.ogg,audio/*"
                  multiple
                  onchange={onEmptyStateAudioInput}
                  class="visually-hidden"
                />
              </label>
              <button class="empty-action drum" onclick={addDrumPadLayer} title="Add drum pad layer">
                + Add Drum Pad
              </button>
            </div>
            <p class="empty-hint">WAV · MP3 · OGG</p>
            {#if emptyStateError}
              <p class="empty-error" role="alert">{emptyStateError}</p>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Global drag overlay: lights up when files are dragged anywhere on the page -->
  {#if globalDragOver && $engineReady}
    <div class="global-drop-overlay" aria-hidden="true">
      <div class="drop-message">
        <span class="drop-icon">🎵</span>
        <span>Drop audio files to add layers</span>
        <span class="drop-hint">WAV · MP3 · OGG</span>
      </div>
    </div>
  {/if}
</main>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Righteous&display=swap');

  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    background: #0f0f0f;
    color: #e8e8e8;
    font-family: 'Inter', system-ui, sans-serif;
    min-height: 100vh;
  }

  :global(h1) {
    font-family: 'Righteous', cursive;
  }

  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }

  .app-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1.5rem;
    background: #1a1a1a;
    border-bottom: 1px solid #2a2a2a;
    flex-wrap: wrap;
    overflow-x: hidden;
  }

  @media (max-width: 640px) {
    .app-header {
      padding: 0.5rem 1rem;
      gap: 0.5rem;
    }
  }

  .header-spacer { flex: 1; min-width: 0; }

  h1 {
    font-family: 'Righteous', cursive;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #fff;
    display: flex;
    align-items: baseline;
    gap: 0.3rem;
  }

  .logo-loop {
    font-family: 'Righteous', cursive;
    color: #fff;
  }

  .logo-framework {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.75rem;
    color: #888;
    font-weight: 400;
    letter-spacing: 0.05em;
  }

  @media (max-width: 640px) {
    h1 {
      font-size: 0.9rem;
    }
  }

  .status {
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
  }

  @media (max-width: 640px) {
    .status {
      font-size: 0.6rem;
      padding: 0.15rem 0.4rem;
    }
  }

  .status.loading {
    background: #2a2a2a;
    color: #888;
  }

  .status.ready {
    background: #1a3a1a;
    color: #4caf50;
  }

  .status.error {
    background: #3a1a1a;
    color: #f44336;
  }

  .workspace {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .mixer-area {
    flex: 1;
    display: flex;
    padding: 1rem;
    overflow-x: auto;
  }

  .empty-actions {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.85rem;
    text-align: center;
  }

  .empty-title {
    color: #d1d5db;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .empty-action-buttons {
    display: flex;
    gap: 0.9rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .empty-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 180px;
    padding: 0.95rem 1.1rem;
    border-radius: 10px;
    border: 1px solid;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }

  .empty-action.audio {
    background: #1e2a1e;
    border-color: #2e4a2e;
    color: #7ddf82;
  }

  .empty-action.audio:hover {
    background: #253325;
    border-color: #3d5e3d;
    color: #a5f7a8;
  }

  .empty-action.drum {
    background: #1f1830;
    border-color: #3b2f5c;
    color: #d7c6ff;
  }

  .empty-action.drum:hover {
    background: #29203b;
    border-color: #514176;
    color: #efe7ff;
  }

  .empty-hint {
    color: #6b7280;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
  }

  .empty-error {
    color: #f87171;
    font-size: 0.8rem;
    max-width: 32rem;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  @media (max-width: 720px) {
    .empty-action {
      min-width: min(260px, 90vw);
      width: min(260px, 90vw);
    }
  }

  /* ── Global drop overlay ── */
  .global-drop-overlay {
    position: fixed;
    inset: 0;
    background: #0d1a0d99;
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 100;
    border: 3px dashed #4caf50;
  }

  .drop-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: #4caf50;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .drop-icon { font-size: 2.5rem; }

  .drop-hint {
    font-size: 0.75rem;
    font-weight: 400;
    color: #4caf5099;
    letter-spacing: 0.1em;
  }
</style>
