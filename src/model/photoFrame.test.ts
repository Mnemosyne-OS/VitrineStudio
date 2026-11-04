import { describe, expect, it } from 'vitest';
import { cropPixels, dragCrop, isUntouched, MIN_SIDE, ratioCrop, turn, turnCrop, turnedSize, WHOLE } from './photoFrame';

const near = (c: { x: number; y: number; w: number; h: number }, e: { x: number; y: number; w: number; h: number }) => {
  for (const k of ['x', 'y', 'w', 'h'] as const) expect(c[k]).toBeCloseTo(e[k], 6);
};

describe('photo frame geometry', () => {
  it('turns by quarters both ways and swaps the sides on an odd turn', () => {
    expect(turn(0, 1)).toBe(1);
    expect(turn(3, 1)).toBe(0);
    expect(turn(0, -1)).toBe(3);
    expect(turnedSize(4000, 3000, 1)).toEqual({ w: 3000, h: 4000 });
    expect(turnedSize(4000, 3000, 2)).toEqual({ w: 4000, h: 3000 });
  });

  it('carries the crop along with the picture, and four turns bring it back', () => {
    const c = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    // Clockwise: the top-left corner of the picture goes to its top-right.
    near(turnCrop(c, 1), { x: 0.4, y: 0.1, w: 0.4, h: 0.3 });
    near(turnCrop(turnCrop(c, 1), -1), c);
    near(turnCrop(turnCrop(turnCrop(turnCrop(c, 1), 1), 1), 1), c);
  });

  it('a square crop is square in PIXELS, centred, as large as the picture allows', () => {
    const landscape = ratioCrop(4000, 2000, 1);
    near(landscape, { x: 0.25, y: 0, w: 0.5, h: 1 });
    const portrait = ratioCrop(2000, 4000, 1);
    near(portrait, { x: 0, y: 0.25, w: 1, h: 0.5 });
  });

  it('a corner moves while its opposite stays, and never leaves the picture', () => {
    near(dragCrop(WHOLE, 'se', -0.2, -0.3), { x: 0, y: 0, w: 0.8, h: 0.7 });
    near(dragCrop(WHOLE, 'nw', 0.2, 0.1), { x: 0.2, y: 0.1, w: 0.8, h: 0.9 });
    // Pulled outward past the edge: held at the edge.
    near(dragCrop({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 'se', 0.9, 0.9), { x: 0.2, y: 0.2, w: 0.8, h: 0.8 });
    // Pulled past the opposite corner: the crop keeps its smallest side.
    const tiny = dragCrop(WHOLE, 'se', -2, -2);
    expect(tiny.w).toBeCloseTo(MIN_SIDE, 6);
    expect(tiny.h).toBeCloseTo(MIN_SIDE, 6);
  });

  it('the whole crop moves without leaving the picture', () => {
    near(dragCrop({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 'move', 0.6, -0.6), { x: 0.5, y: 0, w: 0.5, h: 0.5 });
  });

  it('a locked ratio holds while a corner is dragged, even against an edge', () => {
    const lock = { ratio: 1, width: 4000, height: 2000 };
    const c = dragCrop({ x: 0.25, y: 0, w: 0.5, h: 1 }, 'se', -0.1, 0, lock);
    expect((c.w * 4000) / (c.h * 2000)).toBeCloseTo(1, 6);
    // Widened: the height would pass the bottom, so the width gives way.
    const wide = dragCrop({ x: 0.25, y: 0, w: 0.5, h: 1 }, 'se', 0.2, 0, lock);
    expect(wide.h).toBeCloseTo(1, 6);
    expect(wide.w).toBeCloseTo(0.5, 6);
  });

  it('the crop in pixels is whole, never empty, never past the edges', () => {
    expect(cropPixels({ x: 0.25, y: 0, w: 0.5, h: 1 }, 4000, 2000)).toEqual({ x: 1000, y: 0, w: 2000, h: 2000 });
    expect(cropPixels({ x: 0.9999, y: 0.9999, w: 0.0001, h: 0.0001 }, 100, 100)).toEqual({ x: 99, y: 99, w: 1, h: 1 });
    expect(cropPixels({ x: 0.5, y: 0, w: 0.6, h: 1 }, 100, 100).w).toBe(50);
  });

  it('nothing to save when the photo would come back as it is', () => {
    expect(isUntouched({ turns: 0, crop: WHOLE })).toBe(true);
    expect(isUntouched({ turns: 1, crop: WHOLE })).toBe(false);
    expect(isUntouched({ turns: 0, crop: { x: 0, y: 0, w: 0.9, h: 1 } })).toBe(false);
  });
});
