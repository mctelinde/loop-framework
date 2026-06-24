<script lang="ts">
  import { onMount } from 'svelte';
  import { initEngine, engineReady } from './lib/engineStore';
  import Transport from './components/Transport.svelte';
  import LayerList from './components/LayerList.svelte';
  import LayerStrip from './components/LayerStrip.svelte';
  import SessionControls from './components/SessionControls.svelte';
  import { layers, importing } from './lib/layerStore';

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
    <h1>Loop Framework</h1>
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
          <LayerStrip {layer} />
        {:else}
          <p class="placeholder">Add audio files to get started</p>
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

  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .app-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1.5rem;
    background: #1a1a1a;
    border-bottom: 1px solid #2a2a2a;
  }

  .header-spacer { flex: 1; }

  h1 {
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #fff;
  }

  .status {
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
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

  .placeholder {
    color: #444;
    font-size: 0.875rem;
    text-align: center;
    margin: auto;
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
