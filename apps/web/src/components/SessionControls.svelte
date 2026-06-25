<script lang="ts">
  import { layers } from '../lib/layerStore';
  import { saveSession, loadSession, scheduleAutoSave, getAutoSave } from '../lib/session';
  import { onMount } from 'svelte';

  let sessionName = $state('Untitled');
  let saving = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let lastSaved = $state<Date | null>(null);
  let showAutosaveBanner = $state(false);

  // Trigger auto-save whenever layers change.
  $effect(() => {
    // Subscribe to layers reactively via the store — access .length to track changes.
    void $layers.length;
    scheduleAutoSave(sessionName);
  });

  onMount(() => {
    const autosave = getAutoSave();
    if (autosave && autosave.layers?.length > 0) {
      showAutosaveBanner = true;
    }
  });

  async function onSave() {
    error = null;
    saving = true;
    try {
      await saveSession(sessionName);
      lastSaved = new Date();
    } catch (err) {
      error = `Save failed: ${err}`;
    } finally {
      saving = false;
    }
  }

  function onLoadInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    doLoad(file);
  }

  async function doLoad(file: File) {
    error = null;
    loading = true;
    try {
      sessionName = file.name.replace(/\.loopfw$/i, '');
      await loadSession(file);
      lastSaved = null;
    } catch (err) {
      error = `Load failed: ${err}`;
    } finally {
      loading = false;
    }
  }

  function onFileDrop(e: DragEvent) {
    e.preventDefault();
    const file = Array.from(e.dataTransfer?.files ?? []).find((f) =>
      /\.loopfw$/i.test(f.name),
    );
    if (file) doLoad(file);
  }
</script>

<div class="session-controls" role="toolbar" tabindex="-1" aria-label="Session controls" ondragover={(e) => e.preventDefault()} ondrop={onFileDrop}>
  <!-- Session name -->
  <input
    class="session-name"
    type="text"
    bind:value={sessionName}
    placeholder="Session name"
    aria-label="Session name"
    maxlength="64"
  />

  <!-- Save button -->
  <button
    class="ctrl-btn save-btn"
    onclick={onSave}
    disabled={saving || $layers.length === 0}
    title="Export session as .loopfw"
  >
    {#if saving}
      <span class="spinner"></span> Saving…
    {:else}
      <svg viewBox="0 0 14 14" aria-hidden="true">
        <path d="M2 2h7l3 3v7H2V2zm4 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM4 2v3h5V2H4z"/>
      </svg>
      Save
    {/if}
  </button>

  <!-- Load button -->
  <label class="ctrl-btn load-btn" title="Open .loopfw session file">
    {#if loading}
      <span class="spinner"></span> Loading…
    {:else}
      <svg viewBox="0 0 14 14" aria-hidden="true">
        <path d="M1 3h5l1.5 1.5H13v8H1V3zm6 3v4m-2-2l2 2 2-2" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      </svg>
      Open
    {/if}
    <input
      type="file"
      accept=".loopfw"
      onchange={onLoadInput}
      class="visually-hidden"
      disabled={loading}
    />
  </label>

  <!-- Status indicators -->
  {#if lastSaved}
    <span class="saved-badge" title="Saved at {lastSaved.toLocaleTimeString()}">✓ Saved</span>
  {/if}
  {#if error}
    <button
      class="error-badge"
      title={error}
      onclick={() => (error = null)}
      onkeydown={(e) => e.key === 'Enter' && (error = null)}
      aria-label="Dismiss error"
    >⚠ Error</button>
  {/if}
</div>

<!-- Autosave recovery banner -->
{#if showAutosaveBanner}
  <div class="autosave-banner" role="alert">
    <span>A previous session was found (metadata only — audio files will need to be re-added).</span>
    <button class="banner-dismiss" onclick={() => (showAutosaveBanner = false)}>Dismiss</button>
  </div>
{/if}

<style>
  .session-controls {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  .session-name {
    width: 130px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 4px;
    color: #ccc;
    font-size: 0.8rem;
    padding: 0.25rem 0.5rem;
    transition: border-color 0.1s;
  }

  @media (max-width: 640px) {
    .session-name {
      width: 80px;
      font-size: 0.7rem;
      padding: 0.2rem 0.3rem;
    }
  }

  .session-name:focus { outline: none; border-color: #555; color: #fff; }
  .session-name::placeholder { color: #444; }

  .ctrl-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.28rem 0.65rem;
    border-radius: 4px;
    font-size: 0.78rem;
    cursor: pointer;
    border: 1px solid #333;
    background: #222;
    color: #bbb;
    white-space: nowrap;
    user-select: none;
    transition: background 0.1s, color 0.1s;
  }

  @media (max-width: 640px) {
    .ctrl-btn {
      padding: 0.2rem 0.4rem;
      font-size: 0.65rem;
      gap: 0.2rem;
    }

    .ctrl-btn svg {
      width: 10px;
      height: 10px;
    }
  }

  .ctrl-btn:hover:not(:disabled) { background: #2a2a2a; color: #fff; }
  .ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .ctrl-btn svg {
    width: 12px; height: 12px;
    fill: currentColor;
    flex-shrink: 0;
  }

  .save-btn { border-color: #2a4a2a; color: #4caf50; background: #1a2a1a; }
  .save-btn:hover:not(:disabled) { background: #1e3a1e; color: #66bb6a; }

  .load-btn { border-color: #2a3a4a; color: #5baee8; background: #1a2030; }
  .load-btn:hover:not(:disabled) { background: #1e2a3a; color: #7cc4f8; }

  .visually-hidden {
    position: absolute; width: 1px; height: 1px;
    overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap;
  }

  .spinner {
    display: inline-block;
    width: 9px; height: 9px;
    border: 1.5px solid #4caf5044;
    border-top-color: #4caf50;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .saved-badge {
    font-size: 0.7rem;
    color: #4caf50;
    padding: 0.15rem 0.4rem;
    background: #1a2a1a;
    border: 1px solid #2a4a2a;
    border-radius: 999px;
  }

  .error-badge {
    font-size: 0.7rem;
    color: #ffa726;
    padding: 0.15rem 0.4rem;
    background: #2a1e0a;
    border: 1px solid #4a3010;
    border-radius: 999px;
    cursor: pointer;
  }

  /* ── Autosave banner ── */
  .autosave-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.4rem 1.5rem;
    background: #1a1e2a;
    border-bottom: 1px solid #2a3050;
    font-size: 0.75rem;
    color: #8899cc;
  }

  @media (max-width: 640px) {
    .autosave-banner {
      gap: 0.5rem;
      padding: 0.3rem 1rem;
      flex-wrap: wrap;
    }
  }

  .banner-dismiss {
    background: none;
    border: 1px solid #2a3050;
    border-radius: 4px;
    color: #8899cc;
    font-size: 0.7rem;
    padding: 0.15rem 0.5rem;
    cursor: pointer;
    flex-shrink: 0;
  }
  .banner-dismiss:hover { color: #aabbee; border-color: #3a4070; }
</style>
