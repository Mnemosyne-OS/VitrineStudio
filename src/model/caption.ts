/**
 * Words written over a scene (Tony: « imagine que je veux écrire quelque
 * chose : les dimensions, le nom du produit, la description »). They are
 * not typed again: they come from the piece's own record, chosen field by
 * field, plus a line of her own. Shown in the studio and on the site, never
 * burnt into the picture: the picture stays the same everywhere.
 */
import { formatMoney, type CurrencySettings } from './currency';
import type { PieceShow } from './showcase';
import type { Piece } from './types';

export const CAPTION_FIELDS = ['name', 'size', 'description', 'price'] as const;
export type CaptionField = (typeof CAPTION_FIELDS)[number];
export const CAPTION_PLACES = ['br', 'bl', 'tr'] as const;
export type CaptionPlace = (typeof CAPTION_PLACES)[number];

/** How the words come in when the scene shows. */
export const CAPTION_ANIMS = ['fade', 'rise', 'zoom', 'lines', 'none'] as const;
export type CaptionAnim = (typeof CAPTION_ANIMS)[number];

export const CAPTION_SCREENS = ['desktop', 'tablet', 'mobile'] as const;
export type CaptionScreen = (typeof CAPTION_SCREENS)[number];
/** Where the words' centre sits, in % of the frame (0 left/top, 100 right/bottom). */
export interface CaptionPos { x: number; y: number }

export interface SceneCaption {
  fields: CaptionField[];
  text?: string;
  place?: CaptionPlace;
  /** Absent = a rise. */
  anim?: CaptionAnim;
  /** Moved by hand, per screen (Tony: « drag move l'emplacement, desktop tab mobile »). Absent = the corner `place`. */
  pos?: Partial<Record<CaptionScreen, CaptionPos>>;
}

/** What the words say, read from the piece today: its name as the title, the rest as lines. */
export interface CaptionLines { title?: string; lines: string[]; place: CaptionPlace; anim: CaptionAnim; pos?: Partial<Record<CaptionScreen, CaptionPos>> }

/** A screen never set takes the next larger one's place: mobile ← tablet ← desktop. */
export function posFor(pos: SceneCaption['pos'], screen: CaptionScreen): CaptionPos | undefined {
  const order = CAPTION_SCREENS.slice(0, CAPTION_SCREENS.indexOf(screen) + 1).reverse();
  for (const s of order) if (pos?.[s]) return pos[s];
  return undefined;
}

const DESCRIPTION_MAX = 180;

/** The three measures written as one line (« 30 × 42 × 18 cm »), or her own free wording. */
export function sizeLine(show: PieceShow | undefined, lang: string): string | null {
  const num = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  const s = show?.size;
  const parts = s ? (['l', 'h', 'w'] as const).map((k) => s[k]).filter((v): v is number => typeof v === 'number') : [];
  if (parts.length) return `${parts.map((v) => num.format(v)).join(' × ')} cm`;
  return show?.dimensions?.trim() || null;
}

/** The caption's lines, or null when there is nothing to write (no field gives anything, no text). */
export function captionLines(caption: SceneCaption | undefined, piece: Piece | undefined, show: PieceShow | undefined, lang: string, currency: CurrencySettings): CaptionLines | null {
  if (!caption) return null;
  const has = (f: CaptionField) => caption.fields.includes(f);
  const lines: string[] = [];
  const title = has('name') && piece?.name.trim() ? piece.name.trim() : undefined;
  if (has('size')) {
    const size = sizeLine(show, lang);
    if (size) lines.push(size);
  }
  if (has('description') && piece?.description?.trim()) {
    const d = piece.description.trim();
    lines.push(d.length > DESCRIPTION_MAX ? `${d.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : d);
  }
  if (has('price') && typeof piece?.price === 'number') lines.push(formatMoney(piece.price, lang, currency.main));
  if (caption.text?.trim()) lines.push(caption.text.trim());
  if (!title && !lines.length) return null;
  return { ...(title ? { title } : {}), lines, place: caption.place ?? 'br', anim: caption.anim ?? 'rise', ...(caption.pos && Object.keys(caption.pos).length ? { pos: caption.pos } : {}) };
}

/** A caption read from disk: known fields only, a short text, a known place. */
export function normalizeCaption(raw: unknown): SceneCaption | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const fields = Array.isArray(r.fields) ? [...new Set(r.fields.filter((f): f is CaptionField => (CAPTION_FIELDS as readonly unknown[]).includes(f)))] : [];
  const text = typeof r.text === 'string' ? r.text.trim().slice(0, 200) : '';
  if (!fields.length && !text) return undefined;
  const out: SceneCaption = { fields };
  if (text) out.text = text;
  if ((CAPTION_PLACES as readonly unknown[]).includes(r.place)) out.place = r.place as CaptionPlace;
  if ((CAPTION_ANIMS as readonly unknown[]).includes(r.anim)) out.anim = r.anim as CaptionAnim;
  const posRaw = (r.pos && typeof r.pos === 'object' ? r.pos : {}) as Record<string, unknown>;
  const pos: Partial<Record<CaptionScreen, CaptionPos>> = {};
  for (const s of CAPTION_SCREENS) {
    const p = posRaw[s] as Record<string, unknown> | undefined;
    const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
    if (p && ok(p.x) && ok(p.y)) pos[s] = { x: p.x, y: p.y };
  }
  if (Object.keys(pos).length) out.pos = pos;
  return out;
}

/** The words a caption ends up with: defaults left out, nothing at all when it says nothing. */
export function captionToSave(draft: SceneCaption): SceneCaption | null {
  const text = draft.text?.trim();
  const pos = draft.pos && Object.keys(draft.pos).length ? draft.pos : undefined;
  const next: SceneCaption = { fields: draft.fields, ...(text ? { text } : {}), ...(draft.place && draft.place !== 'br' ? { place: draft.place } : {}), ...(draft.anim && draft.anim !== 'rise' ? { anim: draft.anim } : {}), ...(pos ? { pos } : {}) };
  return next.fields.length || next.text ? next : null;
}
