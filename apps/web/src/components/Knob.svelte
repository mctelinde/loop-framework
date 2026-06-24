<script lang="ts">
  /**
   * Knob.svelte — rotary control
   * Drag vertically to change value (up = increase).
   * Double-click to reset to default.
   * Scroll wheel also works.
   */

  interface Props {
    value: number;
    min?: number;
    max?: number;
    default?: number;
    step?: number;
    label?: string;
    onChange: (v: number) => void;
  }

  let {
    value,
    min = -1,
    max = 1,
    default: defaultValue = 0,
    step = 0.01,
    label = '',
    onChange,
  }: Props = $props();

  // Map value → rotation angle: min = -135°, max = +135°
  const ANGLE_RANGE = 270;
  const ANGLE_OFFSET = -135;

  function valueToAngle(v: number): number {
    return ANGLE_OFFSET + ((v - min) / (max - min)) * ANGLE_RANGE;
  }

  let angle = $derived(valueToAngle(value));

  // Drag state
  let dragging = $state(false);
  let dragStartY = $state(0);
  let dragStartValue = $state(0);

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    dragStartY = e.clientY;
    dragStartValue = value;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const delta = (dragStartY - e.clientY) / 120; // px → normalised
    const raw = dragStartValue + delta * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, snapped)));
  }

  function onPointerUp() { dragging = false; }

  function onDblClick() { onChange(defaultValue); }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? step : -step;
    onChange(Math.max(min, Math.min(max, value + delta)));
  }

  // Format display value
  function fmt(v: number): string {
    if (min === -1 && max === 1) {
      if (Math.abs(v) < 0.01) return 'C';
      return (v > 0 ? 'R' : 'L') + Math.round(Math.abs(v) * 100);
    }
    return v.toFixed(2);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="knob-wrap"
  class:dragging
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  ondblclick={onDblClick}
  onwheel={onWheel}
  title="{label}: {fmt(value)} (drag or scroll; dbl-click to reset)"
  aria-label="{label}: {fmt(value)}"
  role="slider"
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuenow={value}
  tabindex="0"
>
  <svg viewBox="0 0 36 36" class="knob-svg" aria-hidden="true">
    <!-- Track arc background -->
    <circle cx="18" cy="18" r="13" class="track-bg" />
    <!-- Value arc — drawn as a rotated line for simplicity -->
    <circle cx="18" cy="18" r="13" class="track-fill"
      stroke-dasharray="{ ((value - min) / (max - min)) * 55 } 100"
      pathLength="100"
      transform="rotate(225 18 18)"
    />
    <!-- Knob face -->
    <circle cx="18" cy="18" r="11" class="knob-face" />
    <!-- Indicator dot -->
    <circle
      cx={18 + 7 * Math.cos(((angle - 90) * Math.PI) / 180)}
      cy={18 + 7 * Math.sin(((angle - 90) * Math.PI) / 180)}
      r="1.8"
      class="indicator"
    />
  </svg>
  {#if label}
    <span class="knob-label">{label}</span>
  {/if}
  <span class="knob-value">{fmt(value)}</span>
</div>

<style>
  .knob-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    cursor: ns-resize;
    user-select: none;
    -webkit-user-select: none;
    padding: 2px;
    border-radius: 4px;
  }

  .knob-wrap:focus { outline: 1px solid #4caf5066; }
  .knob-wrap.dragging { cursor: ns-resize; }
  .knob-wrap:hover .knob-face { fill: #323232; }

  .knob-svg {
    width: 36px;
    height: 36px;
    overflow: visible;
  }

  .track-bg {
    fill: none;
    stroke: #1e1e1e;
    stroke-width: 3;
    stroke-dasharray: 55 100;
    transform-origin: center;
    transform: rotate(225deg);
    transform-box: fill-box;
  }

  .track-fill {
    fill: none;
    stroke: #4caf50;
    stroke-width: 3;
    stroke-linecap: round;
  }

  .knob-face {
    fill: #2a2a2a;
    stroke: #3a3a3a;
    stroke-width: 1;
    transition: fill 0.1s;
  }

  .indicator { fill: #e0e0e0; }

  .knob-label {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #555;
  }

  .knob-value {
    font-size: 0.6rem;
    font-variant-numeric: tabular-nums;
    color: #777;
  }
</style>
