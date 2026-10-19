import { encodeUnder, qualityLadder } from './webp';

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
