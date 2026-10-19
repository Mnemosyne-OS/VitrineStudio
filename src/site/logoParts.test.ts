import { canSplit, countParts, decorateParts, groupOutlines, normalizeParts, splitCompound, subpaths } from './logoParts';
import { brandMarkup, DEFAULT_IDENTITY, entranceSeconds, LOGO_CSS, normalizeIdentity, sanitizeSvg } from './logo';

// An O (outer square, its hole), a dot inside the hole, and a bar beside it: one traced path.
const O = 'M0 0L30 0L30 30L0 30Z';
const HOLE = 'M5 5L5 25L25 25L25 5Z';
const DOT = 'M12 12L18 12L18 18L12 18Z';
const BAR = 'M40 0L45 0L45 30L40 30Z';
const traced = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 30"><path d="${O}${HOLE}${DOT}${BAR}" fill="#333333" fill-rule="evenodd"/></svg>`;

describe('splitting a traced logo into its elements', () => {
  it('reads each outline of an absolute path, and refuses a relative one', () => {
    expect(subpaths(`${O}${BAR}`)!.map((s) => s.d)).toEqual(['M0 0L30 0L30 30L0 30Z', 'M40 0L45 0L45 30L40 30Z']);
    expect(subpaths('M0 0l10 0l0 10z')).toBeNull();
    expect(subpaths('M0 0Q5 5 10 0Q5 -5 0 0Z')).toHaveLength(1);
  });

  it('keeps the hole with its O, and makes the dot inside the hole an element of its own', () => {
    const groups = groupOutlines(subpaths(`${O}${HOLE}${DOT}${BAR}`)!);
    expect(groups).toEqual([`${O}${HOLE}`.replace(/Z/g, 'Z'), DOT, BAR]);
  });

  it('keeps a ring drawn inside the hole whole: its own hole goes with it, never with the O', () => {
    const RING = 'M8 8L22 8L22 22L8 22Z';
    const RING_HOLE = 'M11 11L11 19L19 19L19 11Z';
    expect(groupOutlines(subpaths(`${O}${HOLE}${RING}${RING_HOLE}`)!)).toEqual([`${O}${HOLE}`, `${RING}${RING_HOLE}`]);
  });

  it('leaves alone a path written in relative commands', () => {
    const rel = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 30"><path d="M0 0l30 0l0 30l-30 0zM40 0l5 0l0 30l-5 0z"/></svg>';
    expect(subpaths('M0 0l30 0l0 30l-30 0z')).toBeNull();
    expect(subpaths('M0 0l30 0l0 30L0 30')).toBeNull();
    expect(canSplit(rel)).toBe(false);
    expect(splitCompound(rel, 200_000)).toBeNull();
  });

  it('writes one path per element, each cutting its holes, with the colour kept', () => {
    const out = splitCompound(traced, 200_000)!;
    expect(countParts(traced)).toBe(1);
    expect(countParts(out)).toBe(3);
    expect(out.match(/fill="#333333"/g)).toHaveLength(3);
    expect(out.match(/fill-rule="evenodd"/g)).toHaveLength(3);
    expect(canSplit(traced)).toBe(true);
    expect(canSplit(out)).toBe(false);
  });

  it('leaves the logo whole when the split would weigh more than a logo may', () => {
    expect(splitCompound(traced, traced.length)).toBeNull();
  });
});

describe('animating each element', () => {
  const split = sanitizeSvg(splitCompound(traced, 200_000)!)!;

  it('wraps each element in what moves it, its own delay on it, draw lengths only where drawn', () => {
    const html = decorateParts(split, [{ anim: 'pop', delay: 0.5 }, { anim: 'draw', delay: 1 }, null]);
    expect(html.match(/<g class="lp lp-pop" style="--d:0.5s">/g)).toHaveLength(1);
    expect(html.match(/<g class="lp lp-draw" style="--d:1s"><path[^>]*pathLength="1"/g)).toHaveLength(1);
    // Nothing set: they come in one after the other.
    expect(html).toContain('<g class="lp lp-fade" style="--d:0.2s">');
    expect(html.match(/pathLength/g)).toHaveLength(1);
  });

  it('is the page markup when the entrance is per element, and a fade for a picture', () => {
    const id = { ...DEFAULT_IDENTITY, svg: split, anim: 'parts' as const, parts: [{ anim: 'spin' as const, delay: 0 }] };
    expect(brandMarkup(id, 'Atelier')).toContain('anim-parts');
    expect(brandMarkup(id, 'Atelier')).toContain('lp-spin');
    expect(brandMarkup({ ...DEFAULT_IDENTITY, logoPath: 'a.png', anim: 'parts' }, 'Atelier')).toContain('anim-fade');
  });

  it('reads back from site.json only known movements, bounded delays, no more than the logo has', () => {
    expect(normalizeParts([{ anim: 'spin', delay: 99 }, { anim: 'explode', delay: 1 }, { anim: 'fade', delay: -2 }, { anim: 'fade', delay: 0 }], 3))
      .toEqual([{ anim: 'spin', delay: 6 }, null, { anim: 'fade', delay: 0 }]);
    const id = normalizeIdentity({ svg: split, anim: 'parts', parts: [{ anim: 'swing', delay: 0.3 }] });
    expect(id.anim).toBe('parts');
    expect(id.parts).toEqual([{ anim: 'swing', delay: 0.3 }]);
  });
});

describe('the preview loop', () => {
  const split = sanitizeSvg(splitCompound(traced, 200_000)!)!;
  it('waits for the last element to come in, at the chosen speed, then a pause', () => {
    const id = { ...DEFAULT_IDENTITY, svg: split, anim: 'parts' as const, parts: [null, { anim: 'draw' as const, delay: 3 }, null] };
    expect(entranceSeconds(id, 'A')).toBe(6.7);
    expect(entranceSeconds({ ...id, speed: 'fast' }, 'A')).toBe(4.2);
    expect(entranceSeconds({ ...DEFAULT_IDENTITY, anim: 'none' }, 'A')).toBe(2);
    expect(entranceSeconds({ ...DEFAULT_IDENTITY, anim: 'letters' }, 'Atelier Rosalie')).toBe(2.9);
  });
});

describe('a tinted logo', () => {
  it('keeps its hollow shapes hollow: the colour goes to fills and strokes that exist', () => {
    expect(LOGO_CSS).toContain('.brand-logo.svg.tint svg :not([fill="none"]) { fill: currentColor; }');
    expect(LOGO_CSS).toContain('.brand-logo.svg.tint svg [stroke]:not([stroke="none"]) { stroke: currentColor; }');
    expect(LOGO_CSS).not.toMatch(/tint svg \* \{ fill/);
  });
});

describe('separating a logo drawn by hand', () => {
  it('leaves alone overlapping shapes under the default fill rule (their overlap would become a hole)', () => {
    const svgNonzero = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30"><path d="M0 0L20 0L20 20L0 20ZM10 10L30 10L30 30L10 30ZM40 0L50 0L50 10L40 10Z"/></svg>';
    expect(canSplit(svgNonzero)).toBe(false);
    expect(splitCompound(svgNonzero, 200_000)).toBeNull();
  });
});
