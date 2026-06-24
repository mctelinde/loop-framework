<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    peaks: Float32Array | null;
    duration: number;
    loopStart: number;
    loopEnd: number;
    onLoopChange: (start: number, end: number) => void;
  }

  let { peaks, duration, loopStart, loopEnd, onLoopChange }: Props = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let containerWidth = $state(72);

  // Re-draw whenever peaks or loop region changes.
  $effect(() => {
    if (canvas && peaks) draw(canvas, peaks, containerWidth, loopStart, loopEnd, duration);
  });

  onMount(() => {
    const ro = new ResizeObserver((entries) => {
      containerWidth = entries[0].contentRect.width;
    });
    if (canvas?.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  });

  function draw(
    c: HTMLCanvasElement,
    p: Float32Array,
    w: number,
    start: number,
    end: number,
    dur: number,
  ) {
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = 64 * dpr;
    c.style.width = `${w}px`;
    c.style.height = '64px';

    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const h = 64;
    const mid = h / 2;
    const buckets = p.length / 2;
    const bucketW = w / buckets;

    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);

    // Loop region highlight
    if (dur > 0) {
      const sx = (start / dur) * w;
      const ex = (end / dur) * w;
      ctx.fillStyle = '#162616';
      ctx.fillRect(sx, 0, ex - sx, h);
    }

    // Waveform bars
    ctx.fillStyle = '#3a7a3a';
    for (let i = 0; i < buckets; i++) {
      const min = p[i * 2];
      const max = p[i * 2 + 1];
      const x = i * bucketW;
      const yTop = mid - max * mid;
      const yBot = mid - min * mid;
      ctx.fillRect(Math.floor(x), Math.floor(yTop), Math.max(1, Math.ceil(bucketW) - 1), Math.max(1, Math.ceil(yBot - yTop)));
    }

    // Centre line
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();

    // Loop boundary lines
    if (dur > 0) {
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 1;
      const sx = (start / dur) * w;
      const ex = (end / dur) * w;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex, 0); ctx.lineTo(ex, h); ctx.stroke();
    }
  }

  // ── Loop handle drag ──────────────────────────────────────────────────────

  type Handle = 'start' | 'end';
  let dragging = $state<Handle | null>(null);

  function startDrag(e: PointerEvent, handle: Handle) {
    e.preventDefault();
    dragging = handle;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || !canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
    if (dragging === 'start') {
      onLoopChange(Math.min(t, loopEnd - 0.01), loopEnd);
    } else {
      onLoopChange(loopStart, Math.max(t, loopStart + 0.01));
    }
  }

  function endDrag() { dragging = null; }

  function handleLeft(handle: Handle) {
    if (duration <= 0 || !canvas) return 0;
    const t = handle === 'start' ? loopStart : loopEnd;
    return (t / duration) * containerWidth;
  }
</script>

<div class="waveform-wrap" role="group" aria-label="Waveform and loop region" onpointermove={onPointerMove} onpointerup={endDrag}>
  <canvas bind:this={canvas}></canvas>
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="handle handle-start"
    style="left: {handleLeft('start')}px"
    role="slider"
    aria-label="Loop start"
    aria-valuemin={0}
    aria-valuemax={duration}
    aria-valuenow={loopStart}
    onpointerdown={(e) => startDrag(e, 'start')}
  ></div>
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="handle handle-end"
    style="left: {handleLeft('end')}px"
    role="slider"
    aria-label="Loop end"
    aria-valuemin={0}
    aria-valuemax={duration}
    aria-valuenow={loopEnd}
    onpointerdown={(e) => startDrag(e, 'end')}
  ></div>
</div>

<style>
  .waveform-wrap {
    position: relative;
    width: 100%;
    height: 64px;
    overflow: hidden;
    background: #111;
    cursor: crosshair;
  }

  canvas {
    display: block;
    width: 100%;
    height: 64px;
  }

  .handle {
    position: absolute;
    top: 0;
    width: 8px;
    height: 100%;
    transform: translateX(-50%);
    cursor: ew-resize;
    z-index: 2;
  }

  .handle::after {
    content: '';
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 0;
    width: 2px;
    height: 100%;
    background: #4caf50;
    opacity: 0.8;
    transition: opacity 0.1s;
  }

  .handle:hover::after { opacity: 1; }

  /* Small triangle tab at top of each handle */
  .handle::before {
    content: '';
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 0;
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 7px solid #4caf50;
  }
</style>
