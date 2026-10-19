import { describe, expect, it } from 'vitest';
import { clampView, wheelFactor, zoomAt, ZOOM_MAX, ZOOM_REST } from './zoomView';

describe('the workbench zoom', () => {
  it('keeps the point under the pointer where it is', () => {
    const v = zoomAt(ZOOM_REST, 2, 100, -50, 800, 600);
    // The picture point under the pointer: (px - x) / s, before and after.
    expect((100 - v.x) / v.s).toBeCloseTo(100);
    expect((-50 - v.y) / v.s).toBeCloseTo(-50);
  });
  it('never goes under the whole photo nor past the maximum', () => {
    expect(zoomAt({ s: 2, x: 40, y: 10 }, 0.1, 0, 0, 800, 600)).toEqual(ZOOM_REST);
    expect(zoomAt(ZOOM_REST, 100, 0, 0, 800, 600).s).toBe(ZOOM_MAX);
  });
  it('never pans past an edge', () => {
    expect(clampView({ s: 2, x: 9999, y: -9999 }, 800, 600)).toEqual({ s: 2, x: 400, y: -300 });
  });
  it('zooms in on a wheel pushed away, out on one pulled back', () => {
    expect(wheelFactor(-100)).toBeCloseTo(1.25);
    expect(wheelFactor(100)).toBeCloseTo(0.8);
  });
});
