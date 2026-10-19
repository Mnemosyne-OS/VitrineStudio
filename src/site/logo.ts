/**
 * The workshop's logo on its website: the picture, how the header shows it,
 * and how it comes in. One source for both sides: the studio's Logo tab
 * previews exactly the markup and the CSS the page will carry.
 *
 * 🚨 An SVG is a document that can run script. The host refuses one as a site
 * file, so it never travels as a file: the studio keeps ONLY its shapes
 * (closed list of elements and presentation attributes, no style, no script,
 * no event, no outside link) and writes that markup into the page. That is
 * also what lets a vector logo DRAW itself, stroke by stroke.
 */

export type LogoKind = 'svg' | 'raster';
export type LogoMode = 'logo' | 'both' | 'name';
export type LogoSize = 's' | 'm' | 'l';
/** Where the header puts the logo: left of the pages (the default), above them centred, or right of them. */
export type LogoPlace = 'left' | 'center' | 'right';
export const LOGO_PLACES: readonly LogoPlace[] = ['left', 'center', 'right'];
/** A free height, in px, chosen with the slider; bounded so a hand-edited file never makes a wall. */
export const LOGO_HEIGHT_MIN = 16;
export const LOGO_HEIGHT_MAX = 200;
import { countParts, decorateParts, defaultPart, normalizeParts, PARTS_CSS, type PartSetting } from './logoParts';

export type LogoAnim = 'none' | 'fade' | 'rise' | 'blur' | 'reveal' | 'zoom' | 'spin' | 'slide' | 'letters' | 'draw' | 'breathe' | 'parts';
export type LogoSpeed = 'slow' | 'normal' | 'fast';

export const LOGO_MODES: readonly LogoMode[] = ['logo', 'both', 'name'];
export const LOGO_SIZES: readonly LogoSize[] = ['s', 'm', 'l'];
export const LOGO_ANIMS: readonly LogoAnim[] = ['none', 'fade', 'rise', 'blur', 'reveal', 'zoom', 'spin', 'slide', 'letters', 'draw', 'breathe', 'parts'];
export const LOGO_SPEEDS: readonly LogoSpeed[] = ['slow', 'normal', 'fast'];
export const LOGO_HEIGHT: Record<LogoSize, number> = { s: 28, m: 44, l: 64 };

/** What the site settings keep about the logo. */
export interface Identity {
  /** A raster logo's file on disk (png, jpg, webp). */
  logoPath?: string;
  /** A vector logo, already reduced to its shapes (sanitizeSvg). */
  svg?: string;
  mode: LogoMode;
  size: LogoSize;
  /** Paint the logo in the site's text colour (for a one-colour logo). */
  tint: boolean;
  anim: LogoAnim;
  /** The logo's width / height, measured when it was taken (the tinted mask needs it). */
  ratio?: number;
  speed: LogoSpeed;
  /** The entrance plays again when the pointer comes over the logo. */
  hover: boolean;
  /** The picture a vector logo was traced from: "back to the picture" returns to it. */
  vectorFrom?: string;
  /** Per element of a vector logo (by document order), for the `parts` entrance; null = the default. */
  parts?: (PartSetting | null)[];
  /** A free height in px (the slider); absent = the size preset's. */
  height?: number;
  /** Where the header puts it; absent = left. */
  place?: LogoPlace;
}

export const DEFAULT_IDENTITY: Identity = { mode: 'both', size: 'm', tint: false, anim: 'fade', speed: 'normal', hover: false };

/** The identity as read from site.json: anything unknown falls back, an svg is cleaned again. */
export function normalizeIdentity(raw: unknown): Identity {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
  const out: Identity = {
    mode: pick(r.mode, LOGO_MODES, DEFAULT_IDENTITY.mode),
    size: pick(r.size, LOGO_SIZES, DEFAULT_IDENTITY.size),
    tint: r.tint === true,
    anim: pick(r.anim, LOGO_ANIMS, DEFAULT_IDENTITY.anim),
    speed: pick(r.speed, LOGO_SPEEDS, DEFAULT_IDENTITY.speed),
    hover: r.hover === true,
  };
  if (typeof r.vectorFrom === 'string' && r.vectorFrom) out.vectorFrom = r.vectorFrom.slice(0, 1000);
  // A hand-edited file never smuggles script into the page: the shapes are taken again.
  const svg = typeof r.svg === 'string' && r.svg.length <= LOGO_SVG_MAX_CHARS ? sanitizeSvg(r.svg) : null;
  if (svg) {
    out.svg = svg;
    const parts = normalizeParts(r.parts, countParts(svg));
    if (parts) out.parts = parts;
  }
  else if (typeof r.logoPath === 'string' && r.logoPath) out.logoPath = r.logoPath.slice(0, 1000);
  if (typeof r.ratio === 'number' && r.ratio > 0 && r.ratio < 50) out.ratio = r.ratio;
  if (typeof r.height === 'number' && Number.isFinite(r.height)) out.height = Math.round(Math.min(LOGO_HEIGHT_MAX, Math.max(LOGO_HEIGHT_MIN, r.height)));
  if (r.place === 'center' || r.place === 'right') out.place = r.place;
  return out;
}

/** What the page receives: the header's markup, a picture logo's address, and the tab icon. */
export interface SiteIdentity { html: string; logoSrc?: string; ratio?: number; favicon?: string; place?: LogoPlace }
export const LOGO_ASSET = 'assets/logo.webp';

export function siteIdentity(id: Identity, name: string): SiteIdentity {
  const kind = logoKind(id);
  const out: SiteIdentity = { html: brandMarkup(id, name) };
  if (kind === 'raster') { out.logoSrc = LOGO_ASSET; out.favicon = LOGO_ASSET; }
  if (kind === 'svg' && id.svg!.length <= FAVICON_MAX_CHARS) out.favicon = `data:image/svg+xml,${encodeURIComponent(id.svg!)}`;
  if (id.ratio) out.ratio = id.ratio;
  if (id.place && id.place !== 'left') out.place = id.place;
  return out;
}

export function logoKind(id: Identity): LogoKind | null {
  return id.svg ? 'svg' : id.logoPath ? 'raster' : null;
}

/** Drawing needs strokes to trace, elements need shapes: a vector logo only. */
export function animFits(anim: LogoAnim, kind: LogoKind | null): boolean {
  return (anim !== 'draw' && anim !== 'parts') || kind === 'svg';
}

const ELEMENTS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'title']);
const ATTRIBUTES = new Set([
  'viewbox', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'transform',
  'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity',
  'opacity', 'clip-rule', 'clip-path', 'id', 'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'fx', 'fy',
  'preserveaspectratio',
]);
/** The only references kept: to something inside the same logo (`url(#grad)`). */
const LOCAL_URL = /^url\(#([\w-]+)\)$/;
/**
 * The most a vector logo may weigh. It travels three times (site.json, the
 * page's inline data, the tab icon); a logo is a few KB, a traced photo can
 * be megabytes.
 */
export const LOGO_SVG_MAX_CHARS = 200_000;
/** Above this the tab icon is left to the browser's default: a data: URL that big slows every page load. */
const FAVICON_MAX_CHARS = 40_000;
/** Ids in the logo are prefixed: inlined in the page, a logo's `id="pages"` would shadow the page's own section. */
const ID_PREFIX = 'logo-';

/**
 * The shapes of an SVG and nothing else, or null when it is not one. Any
 * value that points outside (`url(http…)`, `javascript:`) is dropped with its
 * attribute; `width`/`height` of the root go (the page sizes it), and a root
 * without a viewBox gets one from them so it still scales.
 */
export function sanitizeSvg(text: string): string | null {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  } catch (err) {
    console.warn('[vitrine-studio] svg not parsed:', err);
    return null;
  }
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;

  const clean = (el: Element): Element | null => {
    const name = el.localName.toLowerCase();
    if (!ELEMENTS.has(name)) return null;
    const out = doc.createElementNS('http://www.w3.org/2000/svg', el.localName);
    for (const a of Array.from(el.attributes)) {
      const key = a.name.toLowerCase();
      if (!ATTRIBUTES.has(key)) continue;
      const v = a.value.trim();
      if (/url\(/i.test(v) && !LOCAL_URL.test(v)) continue;
      if (/javascript:|data:/i.test(v)) continue;
      // Prefixed once: a logo read back from site.json is cleaned again and must come out the same.
      const own = (id: string) => (id.startsWith(ID_PREFIX) ? id : ID_PREFIX + id);
      if (key === 'id') { out.setAttribute('id', own(v)); continue; }
      const ref = LOCAL_URL.exec(v);
      out.setAttribute(a.name, ref ? `url(#${own(ref[1]!)})` : v);
    }
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 1) {
        const c = clean(child as Element);
        if (c) out.appendChild(c);
      } else if (child.nodeType === 3 && name === 'title') {
        out.appendChild(doc.createTextNode(child.textContent ?? ''));
      }
    }
    return out;
  };
  const svg = clean(root)!;
  // A reference to something the list above did not keep (a pattern, a mask) would paint
  // nothing: the attribute goes, and the shape takes the default paint instead of vanishing.
  const kept = new Set(Array.from(svg.querySelectorAll('[id]')).map((e) => e.getAttribute('id')));
  for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
    for (const a of Array.from(el.attributes)) {
      const ref = /^url\(#([\w-]+)\)$/.exec(a.value);
      if (ref && !kept.has(ref[1]!)) el.removeAttribute(a.name);
    }
  }
  if (!svg.getAttribute('viewBox')) {
    const w = parseFloat(root.getAttribute('width') ?? '');
    const h = parseFloat(root.getAttribute('height') ?? '');
    if (w > 0 && h > 0) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  const shapes = svg.querySelectorAll('path, circle, ellipse, rect, line, polyline, polygon');
  if (!shapes.length) return null;
  return new XMLSerializer().serializeToString(svg);
}

/** The width/height of a vector logo, from its viewBox (null when it has none). */
export function svgRatio(svg: string): number | null {
  const m = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/i.exec(svg);
  return m && Number(m[2]) > 0 ? Number(m[1]) / Number(m[2]) : null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * The header's brand: the logo, the name, or both, with the classes the CSS
 * animates. A raster logo is an <img data-logo> (or a mask painted in the text
 * colour when `tint`); its address is set by whoever shows it, so the page and
 * the studio's preview share this markup.
 */
export function brandMarkup(id: Identity, name: string): string {
  const kind = logoKind(id);
  const showLogo = kind && id.mode !== 'name';
  const showName = !kind || id.mode !== 'logo';
  const anim = animFits(id.anim, kind) ? id.anim : 'fade';
  let logo = '';
  if (showLogo && kind === 'svg') {
    // Every shape gets pathLength 1 so "draw" traces any logo in the same time.
    const svg = anim === 'parts' ? decorateParts(id.svg!, id.parts) : id.anim === 'draw' ? id.svg!.replace(/<(path|circle|ellipse|rect|line|polyline|polygon)\b/g, '<$1 pathLength="1"') : id.svg!;
    logo = `<span class="brand-logo svg${id.tint ? ' tint' : ''}">${svg}</span>`;
  } else if (showLogo) {
    logo = id.tint ? '<span class="brand-logo mask" data-logo></span>' : '<img class="brand-logo" data-logo alt="">';
  }
  // Letter by letter: each character its own span, its rank in --i.
  const shown = anim === 'letters' ? [...name].map((c, i) => `<span class="ch" style="--i:${i}">${esc(c)}</span>`).join('') : esc(name);
  const text = showName ? `<span class="brand-name">${shown}</span>` : '';
  // A free height rides on the container as the variable the size presets set (never a transform: the entrances own those).
  const height = id.height ? ` style="--logo-h:${id.height}px"` : '';
  return `<span class="brand-in size-${id.size} anim-${anim} speed-${id.speed}${id.hover ? ' hover' : ''}"${height}>${logo}${text}</span>`;
}

const SPEED_K: Record<LogoSpeed, number> = { slow: 1.8, normal: 1, fast: 0.55 };
/** How long each entrance lasts at normal speed, from the CSS below. */
const ENTRANCE: Record<Exclude<LogoAnim, 'letters' | 'parts'>, number> = { none: 0, fade: 1.4, rise: 1.35, blur: 1.6, reveal: 1.7, zoom: 1.4, spin: 1.6, slide: 1.4, draw: 2.7, breathe: 1.4 };
const PART_ENTRANCE = (a: string) => (a === 'draw' ? 2.5 : a === 'spin' ? 1.4 : a === 'none' ? 0 : 1);

/**
 * Seconds between two plays of the preview's loop: the whole entrance (the
 * last element or letter included) at its speed, then a short pause to see it
 * standing. Never under 2 s.
 */
export function entranceSeconds(id: Identity, name: string): number {
  const anim = animFits(id.anim, logoKind(id)) ? id.anim : 'fade';
  let s: number;
  if (anim === 'letters') s = 0.9 + [...name].length * 0.055;
  else if (anim === 'parts') {
    const n = countParts(id.svg!);
    s = 1.4;
    for (let i = 0; i < n; i++) {
      const p = id.parts?.[i] ?? defaultPart(i);
      s = Math.max(s, p.delay + PART_ENTRANCE(p.anim));
    }
  } else s = ENTRANCE[anim];
  return Math.max(2, Math.round((s * SPEED_K[id.speed] + 1.2) * 10) / 10);
}

/** The animations, the sizes and the tint, shared by the page and the studio. */
export const LOGO_CSS = `
/* Where the header puts the logo (the Logo tab): above the pages and centred, or right of them. */
.logo-head.place-center { flex-direction: column; justify-content: flex-start; gap: 14px; }
.logo-head.place-right { flex-direction: row-reverse; }
.brand-in { display: inline-flex; align-items: center; gap: 12px; --k: 1; }
.brand-in.speed-slow { --k: 1.8; } .brand-in.speed-fast { --k: .55; }
.brand-logo { display: block; height: var(--logo-h); width: auto; }
.brand-logo.svg svg { height: 100%; width: auto; display: block; overflow: visible; }
.brand-logo.svg.tint svg :not([fill="none"]) { fill: currentColor; } .brand-logo.svg.tint svg [stroke]:not([stroke="none"]) { stroke: currentColor; }
.brand-logo.mask { aspect-ratio: var(--logo-ratio, 1); background: currentColor; -webkit-mask: var(--logo) center / contain no-repeat; mask: var(--logo) center / contain no-repeat; }
.brand-in.size-s { --logo-h: 28px; } .brand-in.size-m { --logo-h: 44px; } .brand-in.size-l { --logo-h: 64px; }
.brand-name .ch { display: inline-block; white-space: pre; }
.brand-in.play.anim-fade .brand-logo, .brand-in.play.anim-fade .brand-name { animation: logo-fade calc(1.4s * var(--k)) ease both; }
.brand-in.play.anim-rise .brand-logo, .brand-in.play.anim-rise .brand-name { animation: logo-rise calc(1.2s * var(--k)) cubic-bezier(.2,.7,.2,1) both; }
.brand-in.play.anim-rise .brand-name { animation-delay: calc(.15s * var(--k)); }
.brand-in.play.anim-blur .brand-logo, .brand-in.play.anim-blur .brand-name { animation: logo-blur calc(1.6s * var(--k)) ease both; }
.brand-in.play.anim-reveal .brand-logo, .brand-in.play.anim-reveal .brand-name { animation: logo-reveal calc(1.4s * var(--k)) cubic-bezier(.65,0,.2,1) both; }
.brand-in.play.anim-reveal .brand-name { animation-delay: calc(.3s * var(--k)); }
.brand-in.play.anim-zoom .brand-logo { animation: logo-zoom calc(1.2s * var(--k)) cubic-bezier(.2,.8,.2,1.1) both; }
.brand-in.play.anim-zoom .brand-name { animation: logo-fade calc(1s * var(--k)) ease calc(.4s * var(--k)) both; }
.brand-in.play.anim-spin .brand-logo { animation: logo-spin calc(1.6s * var(--k)) cubic-bezier(.2,.7,.2,1) both; }
.brand-in.play.anim-spin .brand-name { animation: logo-fade calc(1s * var(--k)) ease calc(.6s * var(--k)) both; }
.brand-in.play.anim-slide .brand-logo, .brand-in.play.anim-slide .brand-name { animation: logo-slide calc(1.2s * var(--k)) cubic-bezier(.2,.7,.2,1) both; }
.brand-in.play.anim-slide .brand-name { animation-delay: calc(.2s * var(--k)); }
.brand-in.play.anim-letters .brand-logo { animation: logo-fade calc(1s * var(--k)) ease both; }
.brand-in.play.anim-letters .ch { animation: logo-rise calc(.6s * var(--k)) ease both; animation-delay: calc((.3s + var(--i) * 55ms) * var(--k)); }
.brand-in.play.anim-draw svg * { stroke: currentColor; stroke-width: 1.5px; vector-effect: non-scaling-stroke; stroke-dasharray: 1; stroke-dashoffset: 1; fill-opacity: 0; animation: logo-draw calc(2.2s * var(--k)) ease forwards, logo-fill calc(.8s * var(--k)) ease calc(1.9s * var(--k)) forwards; }
.brand-in.play.anim-draw .brand-name { animation: logo-fade calc(1s * var(--k)) ease calc(1.8s * var(--k)) both; }
.brand-in.play.anim-breathe .brand-logo { animation: logo-fade calc(1.2s * var(--k)) ease both, logo-breathe calc(5s * var(--k)) ease-in-out calc(1.2s * var(--k)) infinite; }
.brand-in.play.anim-breathe .brand-name { animation: logo-fade calc(1.2s * var(--k)) ease calc(.2s * var(--k)) both; }
@keyframes logo-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes logo-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes logo-blur { from { opacity: 0; filter: blur(12px); } to { opacity: 1; filter: none; } }
@keyframes logo-reveal { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes logo-zoom { from { opacity: 0; transform: scale(.55); } to { opacity: 1; transform: none; } }
@keyframes logo-spin { from { opacity: 0; transform: rotate(-120deg) scale(.7); } to { opacity: 1; transform: none; } }
@keyframes logo-slide { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: none; } }
/* A shape drawn in lines only has no fill to take over: it keeps its stroke. */
.brand-in.play.anim-draw svg [fill="none"], .brand-in.play.anim-draw svg [fill="none"] * { animation: logo-draw calc(2.2s * var(--k)) ease forwards; }
@keyframes logo-draw { to { stroke-dashoffset: 0; } }
@keyframes logo-fill { to { fill-opacity: 1; stroke-opacity: 0; } }
@keyframes logo-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
@media (prefers-reduced-motion: reduce) { .brand-in.play * { animation: none !important; } .brand-in.play.anim-draw svg * { stroke-dashoffset: 0; fill-opacity: 1; } }
${PARTS_CSS}`;

/** Sets a raster logo's address on the markup's placeholders (page and studio alike). */
export function setLogoSource(root: ParentNode, src: string, ratio: number | null): void {
  root.querySelectorAll<HTMLElement>('[data-logo]').forEach((el) => {
    if (el instanceof HTMLImageElement) el.src = src;
    else {
      el.style.setProperty('--logo', `url("${src}")`);
      if (ratio) el.style.setProperty('--logo-ratio', String(ratio));
    }
  });
}

/**
 * Only what one gesture changed in the logo, laid on the identity as it is NOW: two gestures
 * close together (the height let go, then a drag to the right) never undo each other. A field
 * the gesture removed (a size preset clears the height) is removed.
 */
export function withIdentityChange(current: Identity, before: Identity, after: Identity): Identity {
  const next: Record<string, unknown> = { ...current };
  const b = before as unknown as Record<string, unknown>, a = after as unknown as Record<string, unknown>;
  for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (b[k] === a[k]) continue;
    if (k in a && a[k] !== undefined) next[k] = a[k];
    else delete next[k];
  }
  return next as unknown as Identity;
}
