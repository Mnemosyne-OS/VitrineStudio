/**
 * How each piece shows on the site's Creations page, and what the page does
 * under the pointer (Tony: « des interactions au choix au survol », « d'autres
 * photos sur le produit, nom, dimensions, prix, activable au choix par
 * produit »).
 *
 * Kept in the studio's site.json, never in the piece's own file: those files
 * are MnemoCRM's products too, and each app writes back only the fields it
 * knows, so a dimension written there would vanish the next time the CRM
 * saves the product.
 */

export type CreationsHover = 'none' | 'zoom' | 'swap' | 'lift' | 'info';
export const CREATIONS_HOVERS: readonly CreationsHover[] = ['none', 'zoom', 'swap', 'lift', 'info'];

/** What the site shows of one piece. */
export interface PieceShow {
  /** Written freely before the three measures existed: shown when they are not set. */
  dimensions?: string;
  /** Length, width, height, in centimetres; any of them may be missing. */
  size?: { l?: number; w?: number; h?: number };
  /** In grams. */
  weight?: number;
  /** More photos of the piece, after its own photo: absolute paths on this machine. */
  photos: string[];
  show: { name: boolean; description: boolean; dimensions: boolean; weight: boolean; price: boolean; photos: boolean };
  /**
   * On the Creations page or not, as she chose (Tony: « pouvoir dire lesquels j'affiche ou pas »).
   * Absent: the page decides as it always did (a scene online, not sold).
   */
  onPage?: boolean;
  /** The categories it is filed under, by id (SiteSettings.categories). */
  cats?: string[];
}

export const PHOTOS_MAX = 8;

/** A piece nobody set: its name and its words, as the page always showed. */
export function defaultShow(): PieceShow {
  return { photos: [], show: { name: true, description: true, dimensions: false, weight: false, price: false, photos: false } };
}

const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

/** One piece's settings read back (anything unreadable falls back to the default). */
export function normalizePieceShow(raw: unknown): PieceShow {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const s = (r.show && typeof r.show === 'object' ? r.show : {}) as Record<string, unknown>;
  const d = defaultShow().show;
  const out: PieceShow = {
    photos: (Array.isArray(r.photos) ? r.photos : []).filter((p): p is string => typeof p === 'string' && p.length > 0 && p.length <= 1000).slice(0, PHOTOS_MAX),
    show: { name: bool(s.name, d.name), description: bool(s.description, d.description), dimensions: bool(s.dimensions, d.dimensions), weight: bool(s.weight, d.weight), price: bool(s.price, d.price), photos: bool(s.photos, d.photos) },
  };
  if (typeof r.dimensions === 'string' && r.dimensions.trim()) out.dimensions = r.dimensions.trim().slice(0, 120);
  const z = (r.size && typeof r.size === 'object' ? r.size : {}) as Record<string, unknown>;
  const size: NonNullable<PieceShow['size']> = {};
  for (const k of ['l', 'w', 'h'] as const) { const v = measure(z[k], 10_000); if (v !== undefined) size[k] = v; }
  if (Object.keys(size).length) out.size = size;
  const weight = measure(r.weight, 1_000_000);
  if (weight !== undefined) out.weight = weight;
  if (typeof r.onPage === 'boolean') out.onPage = r.onPage;
  const cats = normalizePieceOrder(r.cats);
  if (cats.length) out.cats = cats;
  return out;
}

/**
 * Whether a piece is on the site's Creations page: never without a photo; else
 * as she chose; else as the page always decided, a scene of it online and the
 * piece not sold. `online` holds the pieces that have a scene online.
 */
export function onCreationsPage(piece: { id: string; photoPath?: string; status?: string }, show: PieceShow | undefined, online: ReadonlySet<string>): boolean {
  if (!piece.photoPath) return false;
  return show?.onPage ?? (online.has(piece.id) && piece.status !== 'sold');
}

/** Every piece's settings, by piece id. */
export function normalizeShowcase(raw: unknown): Record<string, PieceShow> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, PieceShow> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (/^[A-Za-z0-9_-]{1,80}$/.test(id)) out[id] = normalizePieceShow(v);
  }
  return out;
}

/** A measure as typed or stored: a positive number up to `max` ("12,5" reads as 12.5), else nothing. */
export function measure(v: unknown, max: number): number | undefined {
  const n = typeof v === 'string' ? Number(v.trim().replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 10) / 10 : undefined;
}

const LETTERS: Record<string, [string, string, string]> = { fr: ['L', 'l', 'H'], en: ['L', 'W', 'H'], es: ['L', 'A', 'H'] };

/**
 * The size as the site writes it: "12 × 8 × 18 cm" when all three are
 * known, each one named otherwise ("H 18 cm"), so a lone number is never
 * read as the wrong side. Null when none is set.
 */
export function formatSize(size: PieceShow['size'], lang: string): string | null {
  if (!size) return null;
  const num = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  const [L, W, H] = LETTERS[lang] ?? LETTERS.en!;
  const { l, w, h } = size;
  if (l !== undefined && w !== undefined && h !== undefined) return `${num.format(l)} × ${num.format(w)} × ${num.format(h)} cm`;
  const named = ([[L, l], [W, w], [H, h]] as const).filter(([, v]) => v !== undefined).map(([k, v]) => `${k} ${num.format(v!)}`);
  return named.length ? `${named.join(' × ')} cm` : null;
}

/**
 * A piece's measures as rows of a table, in the order Tony set (length, height,
 * width, weight): only those she gave, each with its unit. `labels` are the
 * site's words for them.
 */
export function measureRows(size: PieceShow['size'], grams: number | undefined, lang: string, labels: { l: string; h: string; w: string; weight: string }, show: { dimensions: boolean; weight: boolean }): Array<[string, string]> {
  const num = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  const rows: Array<[string, string]> = [];
  if (show.dimensions && size) for (const k of ['l', 'h', 'w'] as const) { const v = size[k]; if (v !== undefined) rows.push([labels[k], `${num.format(v)} cm`]); }
  if (show.weight && grams !== undefined) rows.push([labels.weight, formatMass(grams, lang)]);
  return rows;
}

/** A weight in grams, written in g under a kilo and in kg above. */
export function formatMass(grams: number, lang: string): string {
  return grams < 1000 ? `${new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(grams)} g` : `${new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(grams / 1000)} kg`;
}

/** A category the creations are filed under. */
export interface Category { id: string; name: string }

/** The categories read back: a plain id once each, a short name, in her order. */
export function normalizeCategories(raw: unknown): Category[] {
  const out: Category[] = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    const r = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    if (typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(r.id) || !name || out.some((x) => x.id === r.id)) continue;
    out.push({ id: r.id, name });
  }
  return out.slice(0, 40);
}

export const newCategoryId = () => `cat-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** The pieces' order read back: plain ids, once each. */
export function normalizePieceOrder(raw: unknown): string[] {
  return [...new Set((Array.isArray(raw) ? raw : []).filter((x): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(x)))];
}

/** Items in the order she set; one she never placed keeps its place after them, in the order it came. */
export function inPieceOrder<T extends { id: string }>(items: T[], order: readonly string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return items.map((x, i) => ({ x, i, r: rank.get(x.id) ?? order.length + i })).sort((a, b) => a.r - b.r || a.i - b.i).map((e) => e.x);
}

/**
 * A new order for some of the pieces (those a page shows) put back into the
 * whole list: the others keep their places, the moved ones fill theirs in turn.
 */
export function reorderSome(all: readonly string[], some: readonly string[]): string[] {
  const moved = new Set(some);
  const next = [...some];
  return all.map((id) => (moved.has(id) ? next.shift()! : id));
}

/** One piece moved before, or after, another. */
export function moveId(order: readonly string[], id: string, target: string, after: boolean): string[] {
  if (id === target || !order.includes(id) || !order.includes(target)) return [...order];
  const rest = order.filter((x) => x !== id);
  const at = rest.indexOf(target) + (after ? 1 : 0);
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

export function normalizeHover(raw: unknown): CreationsHover {
  return CREATIONS_HOVERS.includes(raw as CreationsHover) ? (raw as CreationsHover) : 'none';
}

/**
 * The piece's real size told to the image model, so a scene or a new
 * background keeps it at scale (Tony: « passer les dimensions au modèle pour
 * les bonnes proportions »). English, like every prompt. The everyday objects
 * named give the model something to measure against: it holds a scale far
 * better with a reference than with a number alone. Null when no side is set:
 * then nothing is added and the prompt is the one it always was.
 */
export function scaleLine(size: PieceShow['size']): string | null {
  if (!size) return null;
  const n = (v: number) => `${Math.round(v * 10) / 10} cm`;
  const sides = ([['long', size.l], ['wide', size.w], ['high', size.h]] as const)
    .filter(([, v]) => v !== undefined && v > 0)
    .map(([k, v]) => `${n(v!)} ${k}`);
  if (!sides.length) return null;
  const said = sides.length === 1 ? sides[0] : `${sides.slice(0, -1).join(', ')} and ${sides[sides.length - 1]}`;
  return `Real size of the product: ${said}. Keep it exactly at this scale against the furniture and the room (a table is about 75 cm high, a book about 24 cm, a hand about 18 cm).`;
}
