/**
 * The photo workbench's zoom (Tony: « molette ici égal zoom sur le produit »):
 * a scale and an offset, the picture drawn `translate(x, y) scale(s)` around
 * its centre. Pure, so the arithmetic is tested apart from the pointer.
 */
export interface ZoomView { s: number; x: number; y: number }

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 8;
export const ZOOM_REST: ZoomView = { s: 1, x: 0, y: 0 };

/** Keeps the picture covering its box: no pan past an edge, none at all at 1×. */
export function clampView(v: ZoomView, w: number, h: number): ZoomView {
  const s = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.s));
  if (s === ZOOM_MIN) return ZOOM_REST;
  const mx = ((s - 1) * w) / 2, my = ((s - 1) * h) / 2;
  return { s, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
}

/**
 * Zooms by `factor` keeping the point under the pointer where it is. `px, py`
 * are the pointer from the box's centre, `w, h` the box.
 */
export function zoomAt(v: ZoomView, factor: number, px: number, py: number, w: number, h: number): ZoomView {
  const s = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.s * factor));
  const k = s / v.s;
  return clampView({ s, x: px - (px - v.x) * k, y: py - (py - v.y) * k }, w, h);
}

/** One wheel notch (deltaY ≈ ±100) is ×1.25; a trackpad's small deltas zoom smoothly. */
export function wheelFactor(deltaY: number): number {
  return Math.exp((-deltaY / 100) * Math.log(1.25));
}
