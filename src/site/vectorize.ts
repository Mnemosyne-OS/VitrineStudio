/**
 * A picture logo turned into a vector one, in the studio, with no library and
 * nothing downloaded (Tony: « c'est un PNG que j'ai, faudrait la passe
 * vectorisation »). Made for what an artisan's logo usually is: one colour on
 * a plain or transparent background.
 *
 * 1. Ink or not, per pixel: the alpha when the picture is transparent, else
 *    the brightness against a threshold (Otsu's, unless the person sets one).
 * 2. The outline of every ink region, following the pixel edges with the ink
 *    always on the same side, so holes come out reversed and `evenodd` cuts
 *    them (the inside of an O stays empty).
 * 3. Each outline simplified (Ramer-Douglas-Peucker, `detail` in pixels) and,
 *    when asked, smoothed into curves through the midpoints of its sides.
 *
 * Pure: it takes the pixels and returns the SVG text. The studio reads the
 * pixels from a canvas; the tests feed hand-made grids.
 */

export interface Pixels { width: number; height: number; data: Uint8ClampedArray }

export interface VectorizeOptions {
  /** 0-255; null = Otsu's threshold (ignored on a transparent picture). */
  threshold: number | null;
  /** Ink is the LIGHT part (a light logo on a dark ground). */
  invert: boolean;
  /** How far, in pixels, an outline may move when simplified. */
  detail: number;
  /** Curves instead of straight segments. */
  smooth: boolean;
  /** Regions smaller than this many pixels are dust, dropped. */
  minArea: number;
  /**
   * Lines the person drew across the ink, in the picture's pixels: the ink
   * under them is removed before tracing, so shapes that touch (a circle and
   * the bar that meets it) come out as separate elements.
   */
  cuts?: Cut[];
}

/** A cut from (x1, y1) to (x2, y2), in the traced picture's pixels. */
export type Cut = [number, number, number, number];
/** How wide a cut is, in pixels of the traced picture (at most 900 px wide: a hair on the page). */
export const CUT_WIDTH = 2.5;

export const DEFAULT_VECTORIZE: VectorizeOptions = { threshold: null, invert: false, detail: 1, smooth: true, minArea: 6 };

type Pt = [number, number];

const lum = (d: Uint8ClampedArray, i: number) => 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;

/** Otsu's threshold over the brightness of the opaque pixels. */
export function otsu(p: Pixels): number {
  const hist = new Array<number>(256).fill(0);
  let n = 0;
  for (let i = 0; i < p.data.length; i += 4) {
    if (p.data[i + 3]! < 128) continue;
    hist[Math.round(lum(p.data, i))]!++;
    n++;
  }
  if (!n) return 128;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t]!;
  let sumB = 0, wB = 0, best = 0, at = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; at = t; }
  }
  return at;
}

/** Which pixels are ink. A picture with a real transparent part is read by its alpha. */
export function inkMask(p: Pixels, o: VectorizeOptions): Uint8Array {
  const { width: w, height: h, data } = p;
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 20) clear++;
  const byAlpha = clear > (w * h) * 0.05 && o.threshold === null;
  const t = o.threshold ?? otsu(p);
  const out = new Uint8Array(w * h);
  for (let j = 0, i = 0; j < w * h; j++, i += 4) {
    if (data[i + 3]! < 128) continue;
    if (byAlpha) { out[j] = o.invert ? 0 : 1; continue; }
    // Otsu's threshold is the last value of the dark class: it belongs to the ink.
    const dark = lum(data, i) <= t;
    out[j] = (o.invert ? !dark : dark) ? 1 : 0;
  }
  return out;
}

/**
 * A snip where the person tapped: the shortest way across the ink through
 * that point (tried every 5 degrees), a little longer on both sides so it
 * goes right through. Tapped on a bar near the circle it meets, that is the
 * bar's own width: the bar comes off and the circle stays whole. A tap
 * beside the ink snaps to the nearest ink within `reach` pixels; null when
 * there is none.
 */
export function snipAt(mask: Uint8Array, w: number, h: number, x: number, y: number, reach = 8): Cut | null {
  const ink = (px: number, py: number) => {
    const ix = Math.floor(px), iy = Math.floor(py);
    return ix >= 0 && iy >= 0 && ix < w && iy < h && mask[iy * w + ix] === 1;
  };
  let cx = x, cy = y;
  if (!ink(cx, cy)) {
    let best = Infinity;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const d = Math.hypot(dx, dy);
        if (d < best && ink(x + dx, y + dy)) { best = d; cx = Math.floor(x + dx) + 0.5; cy = Math.floor(y + dy) + 0.5; }
      }
    }
    if (best === Infinity) return null;
  }
  const limit = Math.max(w, h);
  const run = (ux: number, uy: number) => {
    let s = 0;
    while (s < limit && ink(cx + ux * (s + 0.5), cy + uy * (s + 0.5))) s += 0.5;
    return s;
  };
  let pick: Cut | null = null, shortest = Infinity;
  for (let deg = 0; deg < 180; deg += 5) {
    const ux = Math.cos((deg * Math.PI) / 180), uy = Math.sin((deg * Math.PI) / 180);
    const a = run(ux, uy), b = run(-ux, -uy);
    if (a + b < shortest) {
      shortest = a + b;
      const ea = a + 1.5, eb = b + 1.5;
      pick = [cx - ux * eb, cy - uy * eb, cx + ux * ea, cy + uy * ea];
    }
  }
  return pick;
}

/** Clears the ink within `width / 2` of each cut (in place). */
export function cutMask(mask: Uint8Array, w: number, h: number, cuts: readonly Cut[], width: number): void {
  const r = width / 2;
  for (const [x1, y1, x2, y2] of cuts) {
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy || 1;
    const x0 = Math.max(0, Math.floor(Math.min(x1, x2) - r)), xe = Math.min(w - 1, Math.ceil(Math.max(x1, x2) + r));
    const y0 = Math.max(0, Math.floor(Math.min(y1, y2) - r)), ye = Math.min(h - 1, Math.ceil(Math.max(y1, y2) + r));
    for (let y = y0; y <= ye; y++) {
      for (let x = x0; x <= xe; x++) {
        // The pixel's centre against the segment.
        const px = x + 0.5, py = y + 0.5;
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
        if (Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)) <= r) mask[y * w + x] = 0;
      }
    }
  }
}

/**
 * The outlines of the ink, as closed loops of pixel corners. Every boundary
 * edge is directed with the ink on its right; at a corner where two loops
 * touch diagonally the walk turns right, so they stay two loops.
 */
export function traceOutlines(mask: Uint8Array, w: number, h: number): Pt[][] {
  const ink = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const W = w + 1;
  // Outgoing edges per corner: target corner index, and its direction.
  const out = new Map<number, Array<{ to: number; dx: number; dy: number; used: boolean }>>();
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const k = y0 * W + x0;
    const list = out.get(k) ?? [];
    list.push({ to: y1 * W + x1, dx: x1 - x0, dy: y1 - y0, used: false });
    out.set(k, list);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!ink(x, y)) continue;
      if (!ink(x, y - 1)) add(x, y, x + 1, y);
      if (!ink(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!ink(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!ink(x - 1, y)) add(x, y + 1, x, y);
    }
  }
  const loops: Pt[][] = [];
  for (const [start, list] of out) {
    for (const first of list) {
      if (first.used) continue;
      const loop: Pt[] = [];
      let at = start, edge = first;
      for (;;) {
        edge.used = true;
        const prev = loop[loop.length - 1];
        const pt: Pt = [at % W, Math.floor(at / W)];
        // Only the corners where the direction changes.
        if (!prev || loop.length < 2 || !collinear(loop[loop.length - 2]!, prev, pt)) loop.push(pt);
        else loop[loop.length - 1] = pt;
        at = edge.to;
        const next = (out.get(at) ?? []).filter((e) => !e.used);
        if (!next.length) break;
        // Right turn first (screen y down): (dx, dy) → (-dy, dx).
        const right = next.find((e) => e.dx === -edge.dy && e.dy === edge.dx);
        edge = right ?? next[0]!;
      }
      const clean = dropCollinear(loop);
      if (clean.length >= 3) loops.push(clean);
    }
  }
  return loops;
}

/** The corners of a closed loop only: a point in line with both its neighbours goes (the start included). */
function dropCollinear(loop: Pt[]): Pt[] {
  let pts = loop;
  for (let changed = true; changed && pts.length > 3;) {
    changed = false;
    const keep = pts.filter((p, i) => !collinear(pts[(i - 1 + pts.length) % pts.length]!, p, pts[(i + 1) % pts.length]!));
    if (keep.length !== pts.length) { pts = keep; changed = true; }
  }
  return pts;
}

function collinear(a: Pt, b: Pt, c: Pt): boolean {
  return (b[0] - a[0]) * (c[1] - b[1]) === (b[1] - a[1]) * (c[0] - b[0]);
}

function area(loop: Pt[]): number {
  let s = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!, b = loop[(i + 1) % loop.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/** Ramer-Douglas-Peucker on an open polyline. */
function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0]!, pts[pts.length - 1]!];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  let far = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const d = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > far) { far = d; at = i; }
  }
  if (far <= eps) return [a, b];
  return [...rdp(pts.slice(0, at + 1), eps).slice(0, -1), ...rdp(pts.slice(at), eps)];
}

/** A closed loop simplified: split at its farthest point so both halves keep their ends. */
export function simplify(loop: Pt[], eps: number): Pt[] {
  if (eps <= 0 || loop.length < 4) return loop;
  const a = loop[0]!;
  let far = 0, at = 0;
  loop.forEach((p, i) => { const d = Math.hypot(p[0] - a[0], p[1] - a[1]); if (d > far) { far = d; at = i; } });
  const one = rdp(loop.slice(0, at + 1), eps);
  const two = rdp([...loop.slice(at), a], eps);
  const out = [...one.slice(0, -1), ...two.slice(0, -1)];
  // A small shape (the hole of an o) is never simplified away: it keeps its corners.
  return out.length >= 3 ? out : loop;
}

const f = (n: number) => String(Math.round(n * 100) / 100);

function pathOf(loop: Pt[], smooth: boolean): string {
  if (!smooth || loop.length < 4) return `M${loop.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z`;
  // Quadratic curves through the midpoints, the corners as control points.
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const n = loop.length;
  const start = mid(loop[n - 1]!, loop[0]!);
  let d = `M${f(start[0])} ${f(start[1])}`;
  for (let i = 0; i < n; i++) {
    const c = loop[i]!, m = mid(c, loop[(i + 1) % n]!);
    d += `Q${f(c[0])} ${f(c[1])} ${f(m[0])} ${f(m[1])}`;
  }
  return `${d}Z`;
}

/** The average colour of the ink, as #rrggbb (what the logo was drawn in). */
export function inkColour(p: Pixels, mask: Uint8Array): string {
  let r = 0, g = 0, b = 0, n = 0;
  for (let j = 0; j < mask.length; j++) {
    if (!mask[j]) continue;
    r += p.data[j * 4]!; g += p.data[j * 4 + 1]!; b += p.data[j * 4 + 2]!; n++;
  }
  if (!n) return '#000000';
  const h = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** The whole pass: pixels in, an SVG out (null when nothing was found to trace). */
export function vectorize(p: Pixels, o: VectorizeOptions = DEFAULT_VECTORIZE): { svg: string; shapes: number } | null {
  const mask = inkMask(p, o);
  if (o.cuts?.length) cutMask(mask, p.width, p.height, o.cuts, CUT_WIDTH);
  const loops = traceOutlines(mask, p.width, p.height)
    .filter((l) => Math.abs(area(l)) >= o.minArea)
    .map((l) => simplify(l, o.detail))
    .filter((l) => l.length >= 3);
  if (!loops.length) return null;
  const d = loops.map((l) => pathOf(l, o.smooth)).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.width} ${p.height}"><path d="${d}" fill="${inkColour(p, mask)}" fill-rule="evenodd"/></svg>`;
  return { svg, shapes: loops.length };
}
