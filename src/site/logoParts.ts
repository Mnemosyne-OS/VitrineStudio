/**
 * A vector logo's ELEMENTS, each animated on its own (Tony: « extraire les
 * éléments vectoriels pour pouvoir les animer séparément comme on veut »).
 *
 * An element is a drawn shape (path, circle…) outside `defs` and `clipPath`,
 * numbered in document order. Nothing is stored inside the svg: the stored
 * logo stays the sanitized shapes, and the page markup wraps each animated
 * element in a `<g>` carrying its class and delay, at render time.
 *
 * A traced logo is ONE path of many outlines (`evenodd` cuts the holes), so it
 * has one element. `splitCompound` turns each outline, with the holes inside
 * it, into its own path: the inside of an O stays with the O, a dot drawn
 * inside that hole becomes an element of its own. Only absolute commands are
 * read (what the tracer writes); a path written otherwise is left whole.
 */

export type PartAnim = 'none' | 'fade' | 'rise' | 'drop' | 'zoom' | 'pop' | 'spin' | 'left' | 'right' | 'draw' | 'breathe' | 'float' | 'swing';
export const PART_ANIMS: readonly PartAnim[] = ['none', 'fade', 'rise', 'drop', 'zoom', 'pop', 'spin', 'left', 'right', 'draw', 'breathe', 'float', 'swing'];
/** These keep moving after they came in. */
const LOOPS = new Set<PartAnim>(['breathe', 'float', 'swing']);

export interface PartSetting {
  anim: PartAnim;
  /** Seconds before it starts (multiplied by the speed). */
  delay: number;
}

export const PART_DELAY_MAX = 6;
/** More elements than this are a texture, not a logo one animates piece by piece. */
export const PARTS_MAX = 300;

const SHAPES = 'path, circle, ellipse, rect, line, polyline, polygon';

/** The elements of a parsed svg, in document order. */
export function partElements(root: Element): Element[] {
  return Array.from(root.querySelectorAll(SHAPES)).filter((el) => !el.closest('defs, clipPath, clippath'));
}

function parse(svg: string): Element | null {
  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;
    return root && root.nodeName.toLowerCase() === 'svg' && !doc.getElementsByTagName('parsererror').length ? root : null;
  } catch (err) {
    console.warn('[vitrine-studio] logo not parsed for its elements:', err);
    return null;
  }
}

export function countParts(svg: string): number {
  const root = parse(svg);
  return root ? partElements(root).length : 0;
}

/** What an element does when the person set nothing: they come in one after the other. */
export function defaultPart(i: number): PartSetting {
  return { anim: 'fade', delay: Math.min(2, Math.round(i * 10) / 100) };
}

/** The settings as read from site.json: unknown anims dropped, delays bounded, at most PARTS_MAX. */
export function normalizeParts(raw: unknown, count: number): (PartSetting | null)[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.slice(0, Math.min(count, PARTS_MAX)).map((p): PartSetting | null => {
    const r = (p && typeof p === 'object' ? p : null) as Record<string, unknown> | null;
    if (!r || !PART_ANIMS.includes(r.anim as PartAnim)) return null;
    const delay = typeof r.delay === 'number' && Number.isFinite(r.delay) ? Math.min(PART_DELAY_MAX, Math.max(0, r.delay)) : 0;
    return { anim: r.anim as PartAnim, delay };
  });
  return out.length ? out : undefined;
}

/**
 * The logo with each element wrapped in `<g class="lp lp-<anim>" style="--d:…">`
 * (a `draw` element also gets `pathLength="1"`). The wrapper carries the
 * movement, so a shape's own `transform` is never overwritten by the CSS one.
 */
export function decorateParts(svg: string, parts: readonly (PartSetting | null)[] | undefined): string {
  const root = parse(svg);
  if (!root) return svg;
  const doc = root.ownerDocument;
  partElements(root).slice(0, PARTS_MAX).forEach((el, i) => {
    const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    const p = parts?.[i] ?? defaultPart(i);
    g.setAttribute('class', `lp lp-${p.anim}`);
    g.setAttribute('style', `--d:${p.delay}s`);
    if (p.anim === 'draw') el.setAttribute('pathLength', '1');
    el.parentNode!.insertBefore(g, el);
    g.appendChild(el);
  });
  return new XMLSerializer().serializeToString(root);
}

// ── Splitting a compound path ────────────────────────────────────────────────

type Pt = [number, number];
interface Sub { d: string; poly: Pt[]; area: number }

const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, Z: 0 };

/**
 * The outlines of a path, each with a polygon through its points (controls
 * included: close enough to tell what is inside what). Null when the path
 * uses anything but absolute commands.
 */
export function subpaths(d: string): Sub[] | null {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  if (!tokens || !/^M$/.test(tokens[0])) return null;
  const subs: Sub[] = [];
  let text = '', poly: Pt[] = [], x = 0, y = 0, k = 0;
  const flush = () => { if (poly.length >= 3) subs.push({ d: text.trim(), poly, area: Math.abs(polyArea(poly)) }); text = ''; poly = []; };
  while (k < tokens.length) {
    const cmd = tokens[k++]!;
    if (!(cmd in ARGS)) return null;
    if (cmd === 'M') flush();
    const n = ARGS[cmd]!;
    const nums: number[] = [];
    while (k < tokens.length && !/[a-zA-Z]/.test(tokens[k]!)) nums.push(Number(tokens[k++]));
    if (n === 0 ? nums.length : !nums.length || nums.length % n) return null;
    text += cmd + nums.join(' ');
    for (let j = 0; j < nums.length; j += n || 1) {
      const a = nums.slice(j, j + n);
      if (cmd === 'H') x = a[0]!;
      else if (cmd === 'V') y = a[0]!;
      else if (n) {
        for (let c = 0; c + 1 < a.length; c += 2) poly.push([a[c]!, a[c + 1]!]);
        x = a[n - 2]!; y = a[n - 1]!;
      }
      if (cmd === 'H' || cmd === 'V') poly.push([x, y]);
    }
    if (n === 0) text += ' ';
  }
  flush();
  return subs;
}

function polyArea(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function inside(pt: Pt, poly: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * The outlines grouped into elements: an outline inside an odd number of
 * others is a hole and goes with the smallest outline around it; one inside
 * an even number (none, or an island in a hole) starts an element.
 */
export function groupOutlines(subs: Sub[]): string[] {
  const containers = subs.map((s, i) => subs.map((_, j) => j).filter((j) => j !== i && subs[j]!.area > s.area && inside(s.poly[0]!, subs[j]!.poly)));
  const groups = new Map<number, string[]>();
  subs.forEach((s, i) => {
    const around = containers[i]!;
    if (around.length % 2 === 0) { groups.set(i, [...(groups.get(i) ?? []), s.d]); return; }
    const owner = around.reduce((best, j) => (subs[j]!.area < subs[best]!.area ? j : best), around[0]!);
    groups.set(owner, [...(groups.get(owner) ?? []), s.d]);
  });
  return Array.from(groups.keys()).sort((a, b) => a - b).map((i) => groups.get(i)!.join(''));
}

/**
 * The paths whose outlines can be told apart by containment: drawn with
 * `evenodd` (what the tracer writes). Under the default `nonzero`, two
 * overlapping shapes are a union, and splitting would turn their overlap
 * into a hole.
 */
function splittable(root: Element): Element[] {
  return Array.from(root.querySelectorAll('path')).filter((p) => !p.closest('defs, clipPath, clippath') && p.getAttribute('fill-rule') === 'evenodd');
}

/**
 * Every compound path of the logo split into its elements, or null when there
 * is nothing to split (or the result would be heavier than `maxChars`).
 */
export function splitCompound(svg: string, maxChars: number): string | null {
  const root = parse(svg);
  if (!root) return null;
  let changed = false;
  for (const path of splittable(root)) {
    const subs = subpaths(path.getAttribute('d') ?? '');
    if (!subs || subs.length < 2) continue;
    const pieces = groupOutlines(subs);
    if (pieces.length < 2) continue;
    for (const d of pieces) {
      const copy = path.cloneNode(false) as Element;
      copy.setAttribute('d', d);
      // Holes are cut whatever the drawing direction once the piece is alone.
      copy.setAttribute('fill-rule', 'evenodd');
      path.parentNode!.insertBefore(copy, path);
    }
    path.remove();
    changed = true;
  }
  if (!changed) return null;
  const out = new XMLSerializer().serializeToString(root);
  return out.length <= maxChars && partElements(root).length <= PARTS_MAX ? out : null;
}

/** True when `splitCompound` has something to do. */
export function canSplit(svg: string): boolean {
  const root = parse(svg);
  if (!root) return false;
  return splittable(root).some((p) => {
    const subs = subpaths(p.getAttribute('d') ?? '');
    return !!subs && subs.length > 1 && groupOutlines(subs).length > 1;
  });
}

export const isLoop = (a: PartAnim) => LOOPS.has(a);

/** Per element: the wrapper is what moves, around its own centre. */
export const PARTS_CSS = `
.brand-in.anim-parts svg .lp { transform-box: fill-box; transform-origin: 50% 50%; }
.brand-in.play.anim-parts .brand-name { animation: logo-fade calc(1s * var(--k)) ease calc(.4s * var(--k)) both; }
.brand-in.play.anim-parts .lp { animation-duration: calc(1s * var(--k)); animation-delay: calc(var(--d, 0s) * var(--k)); animation-fill-mode: both; animation-timing-function: cubic-bezier(.2,.7,.2,1); }
.brand-in.play.anim-parts .lp-fade { animation-name: logo-fade; }
.brand-in.play.anim-parts .lp-rise { animation-name: part-rise; }
.brand-in.play.anim-parts .lp-drop { animation-name: part-drop; }
.brand-in.play.anim-parts .lp-zoom { animation-name: logo-zoom; }
.brand-in.play.anim-parts .lp-pop { animation-name: part-pop; animation-timing-function: cubic-bezier(.3,1.6,.5,1); }
.brand-in.play.anim-parts .lp-spin { animation-name: logo-spin; animation-duration: calc(1.4s * var(--k)); }
.brand-in.play.anim-parts .lp-left { animation-name: part-left; }
.brand-in.play.anim-parts .lp-right { animation-name: part-right; }
.brand-in.play.anim-parts .lp-draw > * { stroke: currentColor; stroke-width: 1.5px; vector-effect: non-scaling-stroke; stroke-dasharray: 1; stroke-dashoffset: 1; fill-opacity: 0; animation: logo-draw calc(2s * var(--k)) ease calc(var(--d, 0s) * var(--k)) forwards, logo-fill calc(.8s * var(--k)) ease calc((var(--d, 0s) + 1.7s) * var(--k)) forwards; }
.brand-in.play.anim-parts .lp-breathe { animation: logo-fade calc(.8s * var(--k)) ease calc(var(--d, 0s) * var(--k)) both, logo-breathe calc(4s * var(--k)) ease-in-out calc((var(--d, 0s) + .8s) * var(--k)) infinite; }
.brand-in.play.anim-parts .lp-float { animation: logo-fade calc(.8s * var(--k)) ease calc(var(--d, 0s) * var(--k)) both, part-float calc(3s * var(--k)) ease-in-out calc((var(--d, 0s) + .8s) * var(--k)) infinite; }
.brand-in.play.anim-parts .lp-swing { animation: logo-fade calc(.8s * var(--k)) ease calc(var(--d, 0s) * var(--k)) both, part-swing calc(2.6s * var(--k)) ease-in-out calc((var(--d, 0s) + .8s) * var(--k)) infinite; }
@keyframes part-rise { from { opacity: 0; transform: translateY(30%); } to { opacity: 1; transform: none; } }
@keyframes part-drop { from { opacity: 0; transform: translateY(-60%); } to { opacity: 1; transform: none; } }
@keyframes part-pop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: none; } }
@keyframes part-left { from { opacity: 0; transform: translateX(-60%); } to { opacity: 1; transform: none; } }
@keyframes part-right { from { opacity: 0; transform: translateX(60%); } to { opacity: 1; transform: none; } }
@keyframes part-float { 0%, 100% { transform: none; } 50% { transform: translateY(-6%); } }
@keyframes part-swing { 0%, 100% { transform: none; } 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
@media (prefers-reduced-motion: reduce) { .brand-in.play.anim-parts .lp, .brand-in.play.anim-parts .lp > * { animation: none !important; stroke-dashoffset: 0; fill-opacity: 1; } }
`;
