import { encodeUnder, qualityLadder, coverCrop } from './webp';

const blobOf = (size: number) => ({ size }) as Blob;

describe('encodeUnder', () => {
  it('keeps the sharpest quality that fits the weight', async () => {
    const tried: number[] = [];
    const sizes: Record<number, number> = { 0.9: 300_000, 0.85: 180_000, 0.78: 95_000 };
    const got = await encodeUnder(async (q) => { tried.push(q); return blobOf(sizes[q] ?? 50_000); }, 0.9, 100_000);
    expect(got.size).toBe(95_000);
    expect(tried[0]).toBe(0.9);
    expect(tried.length).toBeLessThanOrEqual(4);
  });

  it('finds the sharpest fit by halves, whichever step it is', async () => {
    // Size falls with quality; every threshold between two steps must land on the step above it.
    const ladder = qualityLadder(0.92);
    for (let k = 0; k < ladder.length; k++) {
      const limit = Math.round(ladder[k]! * 1_000_000);
      const tried: number[] = [];
      const got = await encodeUnder(async (q) => { tried.push(q); return blobOf(Math.round(q * 1_000_000)); }, 0.92, limit);
      expect(got.size).toBe(limit);
      expect(tried.length).toBeLessThanOrEqual(4);
    }
  });

  it('encodes once at the asked quality when there is no limit', async () => {
    const tried: number[] = [];
    await encodeUnder(async (q) => { tried.push(q); return blobOf(900_000); }, 0.92);
    expect(tried).toEqual([0.92]);
  });

  it('keeps the smallest when nothing fits, never below 0.5', async () => {
    const got = await encodeUnder(async (q) => blobOf(Math.round(q * 1_000_000)), 0.9, 10);
    expect(got.size).toBe(500_000);
    expect(qualityLadder(0.9).at(-1)).toBe(0.5);
  });
});

describe('the cut of a shared link’s picture', () => {
  it('keeps the largest centred part with the box’s shape, whatever the picture’s own', () => {
    // A 16:9 room is a little less wide than the box (1.78 against 1.90): its width is kept, 30 px go at the top and at the bottom.
    expect(coverCrop(1600, 900, 1200, 630)).toEqual({ sx: 0, sy: 30, sw: 1600, sh: 840 });
    // A panorama: its sides are cut, its height kept.
    expect(coverCrop(4000, 630, 1200, 630)).toEqual({ sx: 1400, sy: 0, sw: 1200, sh: 630 });
    // A tall photo: its top and bottom are cut, evenly.
    const tall = coverCrop(800, 1200, 1200, 630);
    expect(tall).toEqual({ sx: 0, sy: (1200 - 420) / 2, sw: 800, sh: 420 });
    // Never a part larger than the picture.
    for (const [w, h] of [[10, 10], [5000, 100], [100, 5000]] as const) {
      const c = coverCrop(w, h, 1200, 630);
      expect(c.sx).toBeGreaterThanOrEqual(0);
      expect(c.sy).toBeGreaterThanOrEqual(0);
      expect(c.sx + c.sw).toBeLessThanOrEqual(w + 1e-9);
      expect(c.sy + c.sh).toBeLessThanOrEqual(h + 1e-9);
      expect(c.sw / c.sh).toBeCloseTo(1200 / 630, 6);
    }
  });
});
