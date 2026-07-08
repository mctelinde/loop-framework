import { writable, type Readable } from 'svelte/store';

const DEFAULT_LAYER_HEADER_HEIGHT = 44;

const _layerPanelHeaderHeight = writable<number>(DEFAULT_LAYER_HEADER_HEIGHT);

export const layerPanelHeaderHeight: Readable<number> = _layerPanelHeaderHeight;

export function setLayerPanelHeaderHeight(height: number): void {
  const next = Number.isFinite(height) ? Math.max(0, Math.round(height)) : DEFAULT_LAYER_HEADER_HEIGHT;
  _layerPanelHeaderHeight.set(next);
}
