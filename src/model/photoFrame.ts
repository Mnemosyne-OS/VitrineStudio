/**
 * Cropping and turning a creation's photo (Debo, 2026-11-03: « outil pour
 * recadrer et retourner les photos »): the geometry only, no canvas.
 *
 * A frame is a number of quarter turns, then a crop drawn on the TURNED
 * picture, in fractions of its sides (0..1). Fractions, so the same crop holds
 * on the small preview and on the full-size picture it is applied to.
 */

export type QuarterTurns = 0 | 1 | 2 | 3;
/** A rectangle in fractions of the turned picture's sides. */
export interface FrameCrop { x: number; y: number; w: number; h: number }
export interface PhotoFrame { turns: QuarterTurns; crop: FrameCrop }
/** What the pointer holds: the whole crop, or one of its corners. */
export type CropHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

export const WHOLE: FrameCrop = { x: 0, y: 0, w: 1, h: 1 };
/** The smallest side a crop may shrink to, so a corner never crosses its opposite. */
export const MIN_SIDE = 0.05;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** One quarter turn more, clockwise (`1`) or the other way (`-1`). */
export function turn(turns: QuarterTurns, dir: 1 | -1): QuarterTurns {
  return (((turns + dir) % 4) + 4) % 4 as QuarterTurns;
}

/** The picture's size once turned: an odd number of quarter turns swaps its sides. */
export function turnedSize(width: number, height: number, turns: QuarterTurns): { w: number; h: number } {
  return turns % 2 === 1 ? { w: height, h: width } : { w: width, h: height };
}

/** The crop carried along when the picture turns a quarter, so what she framed stays framed. */
export function turnCrop(c: FrameCrop, dir: 1 | -1): FrameCrop {
  return dir === 1
    ? { x: 1 - (c.y + c.h), y: c.x, w: c.h, h: c.w }
    : { x: c.y, y: 1 - (c.x + c.w), w: c.h, h: c.w };
}

/** The largest centred crop whose PIXELS have `ratio` (width / height) on a W × H picture. */
export function ratioCrop(width: number, height: number, ratio: number): FrameCrop {
  // In fractions, h = w · W / (H · ratio).
  const k = width / (height * ratio);
  const w = k <= 1 ? 1 : 1 / k;
  const h = w * k;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/**
 * The crop after a drag of (dx, dy), in fractions of the picture, from `start`.
 * A corner moves while its opposite stays put; the whole crop moves without
 * leaving the picture. `lock` keeps a pixel ratio on a W × H picture.
 */
export function dragCrop(start: FrameCrop, handle: CropHandle, dx: number, dy: number, lock: { ratio: number; width: number; height: number } | null = null): FrameCrop {
  if (handle === 'move') {
    return { ...start, x: clamp(start.x + dx, 0, 1 - start.w), y: clamp(start.y + dy, 0, 1 - start.h) };
  }
  const west = handle === 'nw' || handle === 'sw';
  const north = handle === 'nw' || handle === 'ne';
  // The corner that stays, and the room it leaves on the side being pulled.
  const ax = west ? start.x + start.w : start.x;
  const ay = north ? start.y + start.h : start.y;
  const roomW = west ? ax : 1 - ax;
  const roomH = north ? ay : 1 - ay;
  const mx = (west ? start.x : start.x + start.w) + dx;
  const my = (north ? start.y : start.y + start.h) + dy;
  let w = Math.min(roomW, Math.max(MIN_SIDE, west ? ax - mx : mx - ax));
  let h = Math.min(roomH, Math.max(MIN_SIDE, north ? ay - my : my - ay));
  if (lock) {
    const k = lock.width / (lock.height * lock.ratio);
    h = w * k;
    if (h > roomH) { h = roomH; w = h / k; }
  }
  return { x: west ? ax - w : ax, y: north ? ay - h : ay, w, h };
}

/** The crop in whole pixels of a W × H picture, never empty and never past its edges. */
export function cropPixels(c: FrameCrop, width: number, height: number): { x: number; y: number; w: number; h: number } {
  const x = clamp(Math.round(c.x * width), 0, width - 1);
  const y = clamp(Math.round(c.y * height), 0, height - 1);
  return { x, y, w: clamp(Math.round(c.w * width), 1, width - x), h: clamp(Math.round(c.h * height), 1, height - y) };
}

/** True when the frame would give back the photo as it is: nothing to save. */
export function isUntouched(f: PhotoFrame): boolean {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-3;
  return f.turns === 0 && near(f.crop.x, 0) && near(f.crop.y, 0) && near(f.crop.w, 1) && near(f.crop.h, 1);
}
