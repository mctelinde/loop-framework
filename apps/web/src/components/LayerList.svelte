<script lang="ts">
  import { layers, addLayer, insertLayerAt, removeLayer, renameLayer, reorderLayers, importing } from '../lib/layerStore';
  import { MicRecorder, type RecordingState } from '../lib/micRecorder';
  import { countInEnabled, runCountIn, cancelCountIn } from '../lib/countInStore';
  import { engine } from '../lib/engineStore';
  import { metronomeEnabled, bpm, timeSig } from '../lib/transportStore';
  import { recordingConfig, setMeasureCount, calculateMeasureDuration, calculateRecordingDuration, formatRecordingProgress } from '../lib/recordingStore';
  import { get } from 'svelte/store';

  // ── File validation ────────────────────────────────────────────────────────

  const ACCEPTED_MIME = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp3', 'audio/x-wav'];
  const MEASURE_OPTIONS = [2, 4, 8, 16, 32];

  function filterAudioFiles(fileList: FileList | null): File[] {
    if (!fileList) return [];
    return Array.from(fileList).filter(
      (f) => ACCEPTED_MIME.includes(f.type) || /\.(wav|mp3|ogg)$/i.test(f.name),
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  let addError = $state<string | null>(null);

  // ── Microphone recording ───────────────────────────────────────────────────

  let micRecorder: MicRecorder | null = null;
  let recordingState = $state<RecordingState>({ isRecording: false, duration: 0 });
  let recordingError = $state<string | null>(null);
  let showMeasureSelector = $state(false);

  async function handleAutoStop(wavBlob: Blob) {
    try {
      // Stop engine transport
      get(engine)?.stop();
      get(engine)?.setMetronomeEnabled(false);

      // Convert blob to File for addLayer()
      const file = new File([wavBlob], `recording-${Date.now()}.wav`, { type: 'audio/wav' });
      await addLayer(file);
    } catch (err) {
      recordingError = `Failed to save auto-stop recording: ${err}`;
    }
  }

  async function startRecording() {
    recordingError = null;
    try {
      // Run count-in before starting microphone recording if enabled
      if ($countInEnabled) {
        await runCountIn();
      }

      const config = get(recordingConfig);
      const measureDuration = calculateMeasureDuration();
      const maxDuration = calculateRecordingDuration();

      micRecorder = new MicRecorder(
        (state) => {
          recordingState = state;
        },
        handleAutoStop
      );

      // Pass measure info if recording by measures
      await micRecorder.startRecording(
        maxDuration,
        config.mode === 'measures' ? config.measureCount : undefined,
        config.mode === 'measures' ? measureDuration : undefined
      );

      // Start engine transport if metronome is enabled
      // This makes the metronome audible during recording
      if ($metronomeEnabled) {
        get(engine)?.play();
        get(engine)?.setMetronomeEnabled(true);
      }
    } catch (err) {
      recordingError = `${err}`;
      micRecorder = null;
    }
  }

  async function stopRecording() {
    if (!micRecorder) return;
    try {
      const wavBlob = micRecorder.stopRecording();
      micRecorder = null;

      // Stop engine transport
      get(engine)?.stop();
      get(engine)?.setMetronomeEnabled(false);

      // Convert blob to File for addLayer()
      const file = new File([wavBlob], `recording-${Date.now()}.wav`, { type: 'audio/wav' });
      await addLayer(file);
    } catch (err) {
      recordingError = `Failed to save recording: ${err}`;
    }
  }

  function cancelRecording() {
    cancelCountIn();
    if (!micRecorder) return;
    micRecorder.cancelRecording();
    micRecorder = null;

    // Stop engine when recording is cancelled
    get(engine)?.stop();
    get(engine)?.setMetronomeEnabled(false);
  }

  function formatRecordingDisplay(state: RecordingState): string {
    const config = get(recordingConfig);
    if (config.mode === 'measures' && state.totalMeasures && state.currentMeasure) {
      return `Measure ${Math.min(state.currentMeasure, state.totalMeasures)} of ${state.totalMeasures}`;
    }
    
    // Fallback to time display
    const m = Math.floor(state.duration / 60);
    const s = Math.floor(state.duration % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async function importFiles(files: File[], insertAt?: number) {
    addError = null;
    for (const file of files) {
      try {
        if (insertAt !== undefined) {
          await insertLayerAt(file, insertAt++);
        } else {
          await addLayer(file);
        }
      } catch (err) {
        addError = `Failed to load "${file.name}": ${err}`;
      }
    }
  }

  // ── Panel-level drag-and-drop (append) ────────────────────────────────────

  let isPanelDragOver = $state(false);

  function onPanelDrop(e: DragEvent) {
    e.preventDefault();
    isPanelDragOver = false;
    rowDragOverIndex = null;
    importFiles(filterAudioFiles(e.dataTransfer?.files ?? null));
  }

  function onPanelDragOver(e: DragEvent) {
    e.preventDefault();
    if (!isRowDrag(e)) isPanelDragOver = true;
  }

  function onPanelDragLeave(e: DragEvent) {
    // Only clear if leaving the panel entirely (not crossing to a child).
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget || !(e.currentTarget as HTMLElement).contains(related)) {
      isPanelDragOver = false;
    }
  }

  // ── File picker ────────────────────────────────────────────────────────────

  function onFileInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    importFiles(filterAudioFiles(input.files));
    input.value = '';
  }

  // ── Per-row drop (insert at row index) ────────────────────────────────────

  let rowDragOverIndex = $state<number | null>(null);

  /** True when dragging files from the OS (not an internal row reorder). */
  function isFileDrag(e: DragEvent): boolean {
    return Array.from(e.dataTransfer?.types ?? []).includes('Files');
  }

  function isRowDrag(e: DragEvent): boolean {
    return !isFileDrag(e);
  }

  function onRowFileDragOver(e: DragEvent, index: number) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    isPanelDragOver = false;
    rowDragOverIndex = index;
  }

  function onRowFileDrop(e: DragEvent, index: number) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    rowDragOverIndex = null;
    isPanelDragOver = false;
    importFiles(filterAudioFiles(e.dataTransfer?.files ?? null), index);
  }

  function onRowFileDragLeave() { rowDragOverIndex = null; }

  // ── Inline rename ──────────────────────────────────────────────────────────

  let renamingId = $state<number | null>(null);
  let renameValue = $state('');

  function startRename(id: number, currentName: string) {
    renamingId = id;
    renameValue = currentName;
  }

  function commitRename() {
    if (renamingId !== null) renameLayer(renamingId, renameValue);
    renamingId = null;
  }

  function onRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') renamingId = null;
  }

  // ── Drag-to-reorder ────────────────────────────────────────────────────────

  let reorderFromIndex = $state<number | null>(null);
  let reorderOverIndex = $state<number | null>(null);

  function onRowDragStart(e: DragEvent, index: number) {
    reorderFromIndex = index;
    e.dataTransfer!.effectAllowed = 'move';
    // Mark as non-file drag so per-row file handlers ignore it.
    e.dataTransfer!.setData('text/lf-reorder', String(index));
  }

  function onRowDragOver(e: DragEvent, index: number) {
    if (isFileDrag(e)) return; // handled by onRowFileDragOver
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    reorderOverIndex = index;
  }

  function onRowDrop(e: DragEvent, toIndex: number) {
    if (isFileDrag(e)) return;
    e.preventDefault();
    if (reorderFromIndex !== null && reorderFromIndex !== toIndex) {
      reorderLayers(reorderFromIndex, toIndex);
    }
    reorderFromIndex = null;
    reorderOverIndex = null;
  }

  function onRowDragEnd() {
    reorderFromIndex = null;
    reorderOverIndex = null;
  }
</script>

<section
  class="layer-list"
  class:panel-drag-over={isPanelDragOver}
  ondrop={onPanelDrop}
  ondragover={onPanelDragOver}
  ondragleave={onPanelDragLeave}
  role="list"
  aria-label="Audio layers"
>
  <!-- ── Header ──────────────────────────────────────────────────────── -->
  <div class="list-header">
    <span class="header-title">
      Layers
      {#if $importing > 0}
        <span class="loading-pill">
          <span class="spinner"></span>
          {$importing}
        </span>
      {/if}
    </span>
    <div class="header-buttons">
      {#if recordingState.isRecording}
        <button class="record-btn recording" disabled title="Recording">
          ● REC {formatRecordingDisplay(recordingState)}
        </button>
        <button class="stop-btn" onclick={stopRecording} title="Stop recording">⏹</button>
        <button class="cancel-btn" onclick={cancelRecording} title="Cancel recording">✕</button>
      {:else}
        <div class="measure-selector-wrapper">
          <button 
            class="measure-toggle-btn" 
            onclick={() => (showMeasureSelector = !showMeasureSelector)}
            title="Select recording length"
          >
            {$recordingConfig.measureCount}m
          </button>
          {#if showMeasureSelector}
            <div class="measure-dropdown">
              {#each MEASURE_OPTIONS as measures}
                <button
                  class="measure-option"
                  class:selected={$recordingConfig.measureCount === measures}
                  onclick={() => {
                    setMeasureCount(measures);
                    showMeasureSelector = false;
                  }}
                  title={`Record ${measures} measures`}
                >
                  {measures}m
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <button class="record-btn" onclick={startRecording} title="Record from microphone">
          ◐ Rec
        </button>
        <label class="add-btn" title="Add audio file">
          + Add
          <input
            type="file"
            accept=".wav,.mp3,.ogg,audio/*"
            multiple
            onchange={onFileInput}
            class="visually-hidden"
          />
        </label>
      {/if}
    </div>
  </div>

  {#if addError}
    <p class="error-banner" role="alert">{addError}
      <button class="dismiss" onclick={() => (addError = null)}>✕</button>
    </p>
  {/if}

  {#if recordingError}
    <p class="error-banner" role="alert">{recordingError}
      <button class="dismiss" onclick={() => (recordingError = null)}>✕</button>
    </p>
  {/if}

  <!-- ── Layer rows ───────────────────────────────────────────────────── -->
  {#if $layers.length === 0}
    <div class="empty-state">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <rect x="4" y="12" width="32" height="6" rx="2" opacity="0.3"/>
        <rect x="4" y="22" width="32" height="6" rx="2" opacity="0.2"/>
        <rect x="4" y="32" width="24" height="6" rx="2" opacity="0.1"/>
      </svg>
      <p>Drop audio files here or click <strong>+ Add</strong></p>
      <p class="hint">WAV · MP3 · OGG</p>
    </div>
  {:else}
    {#each $layers as layer, index (layer.id)}
      <!-- Per-row file drop indicator (insert before this row) -->
      {#if rowDragOverIndex === index}
        <div class="row-drop-indicator" aria-hidden="true"></div>
      {/if}

      <div
        class="layer-row"
        class:reorder-target={reorderOverIndex === index && reorderFromIndex !== index}
        draggable="true"
        ondragstart={(e) => onRowDragStart(e, index)}
        ondragover={(e) => { onRowDragOver(e, index); onRowFileDragOver(e, index); }}
        ondrop={(e) => { onRowDrop(e, index); onRowFileDrop(e, index); }}
        ondragleave={onRowFileDragLeave}
        ondragend={onRowDragEnd}
        role="listitem"
      >
        <span class="drag-handle" aria-hidden="true">⠿</span>

        <div class="layer-name">
          {#if renamingId === layer.id}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="rename-input"
              autofocus
              bind:value={renameValue}
              onblur={commitRename}
              onkeydown={onRenameKeydown}
            />
          {:else}
            <button
              class="name-btn"
              ondblclick={() => startRename(layer.id, layer.name)}
              title="Double-click to rename"
            >{layer.name}</button>
          {/if}
        </div>

        <button
          class="remove-btn"
          onclick={() => removeLayer(layer.id)}
          title="Remove layer"
          aria-label="Remove {layer.name}"
        >✕</button>
      </div>
    {/each}

    <!-- Drop indicator at end of list -->
    {#if rowDragOverIndex === $layers.length}
      <div class="row-drop-indicator" aria-hidden="true"></div>
    {/if}
  {/if}
</section>

<style>
  .layer-list {
    display: flex;
    flex-direction: column;
    background: #141414;
    border-right: 1px solid #2a2a2a;
    min-width: 220px;
    width: 260px;
    flex-shrink: 0;
    transition: background 0.1s;
  }

  /* ── Header ── */
  .list-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem 0.5rem;
    border-bottom: 1px solid #2a2a2a;
    min-width: 0;
  }

  .header-title {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #555;
    flex-shrink: 0;
  }

  .add-btn {
    font-size: 0.75rem;
    padding: 0.2rem 0.55rem;
    background: #1e2a1e;
    border: 1px solid #2e4a2e;
    border-radius: 4px;
    color: #4caf50;
    cursor: pointer;
    user-select: none;
    height: 24px;
    line-height: 1.2;
    display: flex;
    align-items: center;
  }
  .add-btn:hover { background: #243024; color: #66bb6a; }

  .header-buttons {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    min-width: 0;
    flex: 1;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .measure-selector-wrapper {
    position: relative;
  }

  .measure-toggle-btn {
    font-size: 0.75rem;
    padding: 0.2rem 0.55rem;
    background: #1a1e2a;
    border: 1px solid #2e3a4a;
    border-radius: 4px;
    color: #7dd3fc;
    cursor: pointer;
    user-select: none;
    transition: background 0.2s, color 0.2s;
    height: 24px;
    line-height: 1.2;
    display: flex;
    align-items: center;
  }

  .measure-toggle-btn:hover {
    background: #222a38;
    color: #a5e3ff;
  }

  .measure-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 4px;
    margin-top: 0.2rem;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    min-width: 60px;
  }

  .measure-option {
    display: block;
    width: 100%;
    padding: 0.35rem 0.5rem;
    background: transparent;
    border: none;
    color: #7dd3fc;
    font-size: 0.7rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .measure-option:first-child {
    border-radius: 3px 3px 0 0;
  }

  .measure-option:last-child {
    border-radius: 0 0 3px 3px;
  }

  .measure-option:hover {
    background: #2a2a3a;
    color: #a5e3ff;
  }

  .measure-option.selected {
    background: #1e3a4a;
    color: #4caf50;
    font-weight: 600;
  }

  .record-btn {
    font-size: 0.75rem;
    padding: 0.2rem 0.55rem;
    background: #2a1515;
    border: 1px solid #4a2e2e;
    border-radius: 4px;
    color: #ef5350;
    cursor: pointer;
    user-select: none;
    transition: background 0.2s, color 0.2s;
    height: 24px;
    line-height: 1.2;
    display: flex;
    align-items: center;
  }

  .record-btn:hover:not(:disabled) {
    background: #302020;
    color: #ff7675;
  }

  .record-btn.recording {
    background: #e53935;
    color: #fff;
    animation: pulse 0.6s ease-in-out infinite;
  }

  .record-btn:disabled {
    cursor: not-allowed;
    opacity: 0.8;
  }

  .stop-btn {
    font-size: 0.75rem;
    padding: 0.2rem 0.55rem;
    background: #4caf50;
    border: 1px solid #45a049;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    user-select: none;
    height: 24px;
    line-height: 1.2;
    display: flex;
    align-items: center;
  }

  .stop-btn:hover {
    background: #66bb6a;
  }

  .cancel-btn {
    font-size: 0.75rem;
    padding: 0.2rem 0.55rem;
    background: #555;
    border: 1px solid #777;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    user-select: none;
    height: 24px;
    line-height: 1.2;
    display: flex;
    align-items: center;
  }

  .cancel-btn:hover {
    background: #666;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .visually-hidden {
    position: absolute;
    width: 1px; height: 1px;
    overflow: hidden;
    clip: rect(0,0,0,0);
    white-space: nowrap;
  }

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2.5rem 1rem;
    color: #444;
    text-align: center;
    font-size: 0.8rem;
  }

  .empty-state svg {
    width: 40px;
    height: 40px;
    fill: #333;
    margin-bottom: 0.25rem;
  }

  .hint { font-size: 0.7rem; color: #333; }

  .layer-list.panel-drag-over {
    background: #1a2a1a;
    outline: 2px dashed #4caf50;
    outline-offset: -2px;
  }

  /* ── Loading pill ── */
  .loading-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-left: 0.4rem;
    font-size: 0.65rem;
    font-weight: 600;
    color: #4caf50;
    background: #1a2a1a;
    border: 1px solid #2e4a2e;
    border-radius: 999px;
    padding: 0.1rem 0.4rem;
  }

  .spinner {
    display: inline-block;
    width: 8px;
    height: 8px;
    border: 1.5px solid #4caf5055;
    border-top-color: #4caf50;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Row drop indicator ── */
  .row-drop-indicator {
    height: 2px;
    background: #4caf50;
    margin: 0 0.6rem;
    border-radius: 1px;
    box-shadow: 0 0 4px #4caf5088;
  }

  /* ── Layer rows ── */
  .layer-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.6rem;
    border-bottom: 1px solid #1e1e1e;
    cursor: grab;
    transition: background 0.1s;
  }

  .layer-row:hover { background: #1c1c1c; }

  .layer-row.reorder-target { border-top: 2px solid #4caf50; }

  .drag-handle {
    color: #333;
    font-size: 1rem;
    line-height: 1;
    cursor: grab;
    flex-shrink: 0;
    user-select: none;
  }
  .layer-row:hover .drag-handle { color: #555; }

  .layer-name {
    flex: 1;
    min-width: 0;
  }

  .name-btn {
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    color: #ccc;
    font-size: 0.82rem;
    cursor: text;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0;
  }
  .name-btn:hover { color: #fff; }

  .rename-input {
    width: 100%;
    background: #222;
    border: 1px solid #4caf50;
    border-radius: 3px;
    color: #e8e8e8;
    font-size: 0.82rem;
    padding: 0.1rem 0.3rem;
  }

  .remove-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    color: #333;
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0.1rem 0.2rem;
    border-radius: 3px;
    transition: color 0.1s, background 0.1s;
  }
  .remove-btn:hover { color: #f44336; background: #2a1515; }

  /* ── Error banner ── */
  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #f44336;
    background: #2a1515;
    padding: 0.4rem 0.75rem;
    border-bottom: 1px solid #3a2020;
  }

  .dismiss {
    background: none;
    border: none;
    color: #f4433688;
    cursor: pointer;
    font-size: 0.7rem;
    flex-shrink: 0;
  }
  .dismiss:hover { color: #f44336; }
</style>
