import { writable, type Readable } from 'svelte/store';

const DEFAULT_LAYER_HEADER_HEIGHT = 44;
const DEFAULT_LAYER_FIRST_ROW_OFFSET = 44;

const _layerPanelHeaderHeight = writable<number>(DEFAULT_LAYER_HEADER_HEIGHT);
const _layerPanelFirstRowOffset = writable<number>(DEFAULT_LAYER_FIRST_ROW_OFFSET);

export const layerPanelHeaderHeight: Readable<number> = _layerPanelHeaderHeight;
export const layerPanelFirstRowOffset: Readable<number> = _layerPanelFirstRowOffset;

export function setLayerPanelHeaderHeight(height: number): void {
  const next = Number.isFinite(height) ? Math.max(0, Math.round(height)) : DEFAULT_LAYER_HEADER_HEIGHT;
  _layerPanelHeaderHeight.set(next);
}

export function setLayerPanelFirstRowOffset(offset: number): void {
  const next = Number.isFinite(offset) ? Math.max(0, Math.round(offset)) : DEFAULT_LAYER_FIRST_ROW_OFFSET;
  _layerPanelFirstRowOffset.set(next);
}
