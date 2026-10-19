import { cutMask, DEFAULT_VECTORIZE, inkMask, snipAt, otsu, simplify, traceOutlines, vectorize, type Pixels } from './vectorize';

/** A picture from rows of characters: '#' = dark ink, '.' = white, ' ' = transparent. */
function picture(rows: string[]): Pixels {
  const height = rows.length, width = rows[0]!.length;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    const i = (y * width + x) * 4;
    const v = c === '#' ? 30 : 250;
    data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = c === ' ' ? 0 : 255;
  }));
  return { width, height, data };
}

describe('vectorize', () => {
  it('finds the dark ink on a white ground by Otsu, and the ink by alpha on a transparent one', () => {
    const white = picture(['....', '.##.', '.##.', '....']);
    expect(otsu(white)).toBeGreaterThanOrEqual(30);
    expect(otsu(white)).toBeLessThan(250);
    expect([...inkMask(white, DEFAULT_VECTORIZE)]).toEqual([0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0]);
    const clear = picture(['    ', ' .. ', ' .. ', '    ']);
    expect([...inkMask(clear, DEFAULT_VECTORIZE)].filter(Boolean)).toHaveLength(4);
  });

  it('traces a square as one loop of four corners', () => {
    const loops = traceOutlines(new Uint8Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0]), 4, 4);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.length).toBe(4);
    expect(loops[0]).toEqual(expect.arrayContaining([[1, 1], [3, 1], [3, 3], [1, 3]]));
  });

  it('keeps the hole of a ring as a second loop, cut out by evenodd', () => {
    const ring = picture(['.....', '.###.', '.#.#.', '.###.', '.....']);
    const out = vectorize(ring, { ...DEFAULT_VECTORIZE, smooth: false, minArea: 1 })!;
    expect(out.shapes).toBe(2);
    expect(out.svg).toContain('fill-rule="evenodd"');
    expect((out.svg.match(/M/g) ?? []).length).toBe(2);
  });

  it('keeps two pixels that only touch at a corner as two shapes', () => {
    const loops = traceOutlines(new Uint8Array([1, 0, 0, 1]), 2, 2);
    expect(loops).toHaveLength(2);
  });

  it('drops dust smaller than the minimum area, and says when nothing is left', () => {
    const speck = picture(['.....', '..#..', '.....']);
    expect(vectorize(speck, { ...DEFAULT_VECTORIZE, minArea: 4 })).toBeNull();
  });

  it('simplifies a straight staircase-free edge to its ends', () => {
    expect(simplify([[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]], 0.5)).toHaveLength(4);
  });

  it('writes the ink in its own colour', () => {
    const out = vectorize(picture(['....', '.##.', '.##.', '....']), { ...DEFAULT_VECTORIZE, minArea: 1 })!;
    expect(out.svg).toContain('fill="#1e1e1e"');
  });
});

describe('cutting shapes that touch', () => {
  // A ring and the bar that meets it: one region until a cut crosses the bar.
  const joined = picture([
    '...........',
    '.###.......',
    '.#.#######.',
    '.###.......',
    '...........',
  ]);
  const o = { ...DEFAULT_VECTORIZE, smooth: false, minArea: 1 };

  it('makes one region two where the person cut, and leaves the rest of the ink', () => {
    expect(vectorize(joined, o)!.shapes).toBe(2);
    const cut = vectorize(joined, { ...o, cuts: [[5, 1, 5, 4]] })!;
    expect(cut.shapes).toBe(3);
    const mask = inkMask(joined, o);
    cutMask(mask, 11, 5, [[5.5, 1, 5.5, 4]], 1);
    expect(mask.reduce((a, b) => a + b, 0)).toBe(inkMask(joined, o).reduce((a, b) => a + b, 0) - 1);
  });

  it('stops where the line stops: a cut that ends short of the bar leaves it whole', () => {
    const mask = inkMask(joined, o);
    cutMask(mask, 11, 5, [[5.5, 0, 5.5, 1.2]], 2);
    expect(mask.reduce((a, b) => a + b, 0)).toBe(inkMask(joined, o).reduce((a, b) => a + b, 0));
  });
});

describe('a tap that snips', () => {
  const joined = picture([
    '...........',
    '.###.......',
    '.#.#######.',
    '.###.......',
    '...........',
  ]);
  const o = { ...DEFAULT_VECTORIZE, smooth: false, minArea: 1 };

  it('cuts straight across the bar where tapped, and the ring stays whole', () => {
    const mask = inkMask(joined, o);
    const snip = snipAt(mask, 11, 5, 6.5, 2.5)!;
    // Across the bar: vertical, never along it.
    expect(Math.abs(snip[0] - snip[2])).toBeLessThan(0.01);
    expect(vectorize(joined, { ...o, cuts: [snip] })!.shapes).toBe(3);
  });

  it('snaps a tap just beside the ink onto it, and finds nothing far from any', () => {
    const mask = inkMask(joined, o);
    expect(snipAt(mask, 11, 5, 6.5, 0.5, 3)).not.toBeNull();
    expect(snipAt(new Uint8Array(121), 11, 11, 5, 5, 3)).toBeNull();
  });
});
