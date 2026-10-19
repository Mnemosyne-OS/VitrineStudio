/**
 * A site kit: the work someone prepares for an artisan's website (the name,
 * the texts, the colours, the logo and its entrance, pages made by hand),
 * handed over as ONE file the artisan drops into the studio (Tony: « elle
 * aura une sorte d'onboarding pour poser le zip du site que je lui aurais
 * donné, et plouf tout se met bien en place »).
 *
 * One `.kit.json`, not a zip: the cartridge has no door that writes a zip
 * (`site.saveAsset` refuses the extension, `dialog.writeFile` writes text),
 * and a JSON with its files in base64 carries the same thing.
 *
 * A kit can also carry the studio's work (scenes, creations, film, markets):
 * then it is a FOLDER, `kit.json` plus `media/` (85 MB for Atelier Rosalie,
 * past what one JSON can hold). Its records name their pictures and clips
 * `kit-media:<file>`; once the folder is chosen they point INTO it, nothing
 * is copied, so the folder stays where it was put.
 *
 * What the kit brings and what the artisan makes stay apart: a newer kit
 * replaces the pages and every setting she has NOT changed since the last
 * one (`applied` records what the kit put there); what she changed is kept
 * and named.
 */
import { DEFAULT_IDENTITY, normalizeIdentity, type Identity } from '../site/logo';
import { normalizeShowcase, type PieceShow } from './showcase';
import type { Brand } from '../site/buildSite';

export const KIT_SCHEMA = 'atelier-studio-kit/1';
/** A kit carries a few pages and their pictures, not a photo library. */
export const KIT_MAX_CHARS = 40 * 1024 * 1024;
/** Where the kit's files go in the website folder. */
export const KIT_PAGES_DIR = 'pages';

/**
 * What the host writes into a website folder (main/site/siteAssets), without
 * svg: the host refuses an svg as a site file (it can run script).
 */
export const KIT_EXTENSIONS = ['html', 'css', 'js', 'json', 'txt', 'xml', 'webp', 'png', 'jpg', 'jpeg', 'gif', 'avif', 'ico', 'mp4', 'webm'];
const TEXT_EXTENSIONS = new Set(['html', 'css', 'js', 'json', 'txt', 'xml']);

export const BRAND_FIELDS = ['name', 'tagline', 'about', 'email', 'instagram', 'accent', 'ink', 'paper', 'introLine', 'portraitCaption', 'contactNote', 'formspree'] as const;
export type BrandField = (typeof BRAND_FIELDS)[number];

export interface KitPage { rel: string; title: string }
export interface KitFile { rel: string; base64: string }

/** The kit's own file inside a kit folder. */
export const KIT_FOLDER_FILE = 'kit.json';
/** A picture or clip of the kit's work, in its `media/` folder. */
export const KIT_MEDIA = 'kit-media:';

/** The studio's work a kit carries (records as the studio writes them, read again by its loaders). */
export interface KitRecords {
  pieces: Array<Record<string, unknown> & { id: string }>;
  scenes: Array<Record<string, unknown> & { id: string }>;
  markets: Array<Record<string, unknown> & { id: string }>;
  film?: Record<string, unknown>;
}

export interface Kit {
  schema: typeof KIT_SCHEMA;
  /** What the kit is for, shown to the artisan ("Atelier Rosalie"). */
  name: string;
  /** When it was made (ISO): a newer one is recognised. */
  version: string;
  brand: Partial<Pick<Brand, BrandField>>;
  /** The logo and its entrance. A picture logo travels as `logoFile`. */
  identity?: Identity;
  /** A picture logo's bytes (the identity's `logoPath` is the maker's disk, never hers). */
  logoFile?: { ext: 'png' | 'jpg' | 'webp'; base64: string };
  /** The portrait's bytes, written on her machine like the logo. */
  portraitFile?: { ext: 'png' | 'jpg' | 'webp'; base64: string };
  /** The pages the website's menu links to, in menu order. */
  pages: KitPage[];
  /** Every file under `pages/`, pages and their pictures alike. */
  files: KitFile[];
  /** The studio's work, its media in the kit folder (see KIT_MEDIA). */
  records?: KitRecords;
  /** How the pieces show on the Creations page, by piece id; further photos as `kit-media:` names. */
  showcase?: Record<string, PieceShow>;
}

/** What the last kit put in the settings, to tell a field she changed from one she did not. */
export interface KitApplied {
  name: string;
  version: string;
  brand: Partial<Pick<Brand, BrandField>>;
  identity?: Identity;
  /** The portrait the kit wrote on this machine. */
  portrait?: string;
}

export class KitError extends Error {
  constructor(public readonly code: string, public readonly detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

/** A path inside the kit, or why it is refused (same rules as the host's site door). */
export function checkKitPath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) throw new KitError('KIT_BAD_PATH', String(raw));
  const rel = raw.replace(/\\/g, '/');
  // The host refuses a site file name over 200 characters: refused here, at the kit, not at her export.
  if (rel.length > 200) throw new KitError('KIT_BAD_PATH', rel.slice(0, 80));
  if (rel.startsWith('/') || /^[a-zA-Z]:/.test(rel)) throw new KitError('KIT_BAD_PATH', rel);
  const parts = rel.split('/');
  // pages/ + at most three levels: the host refuses deeper than four.
  if (parts[0] !== KIT_PAGES_DIR || parts.length < 2 || parts.length > 5) throw new KitError('KIT_BAD_PATH', rel);
  for (const seg of parts) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(seg) || seg.includes('..')) throw new KitError('KIT_BAD_PATH', rel);
  }
  const ext = rel.includes('.') ? rel.slice(rel.lastIndexOf('.') + 1).toLowerCase() : '';
  if (!KIT_EXTENSIONS.includes(ext)) throw new KitError('KIT_FILE_TYPE', rel);
  return rel;
}

export const isTextFile = (rel: string) => TEXT_EXTENSIONS.has(rel.slice(rel.lastIndexOf('.') + 1).toLowerCase());

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);
const HEX = /^#[0-9a-fA-F]{6}$/;

function readBrand(raw: unknown): Kit['brand'] {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Kit['brand'] = {};
  const limits: Record<BrandField, number> = { name: 80, tagline: 160, about: 4000, email: 200, instagram: 60, accent: 7, ink: 7, paper: 7, introLine: 300, portraitCaption: 300, contactNote: 400, formspree: 40 };
  for (const f of BRAND_FIELDS) {
    const v = str(b[f], limits[f]);
    if (v === undefined) continue;
    if ((f === 'accent' || f === 'ink' || f === 'paper') && !HEX.test(v)) continue;
    out[f] = v;
  }
  return out;
}

/** A kit as read from its file: anything it should not carry refuses the whole kit, by name. */
export function readKit(text: string): Kit {
  if (text.length > KIT_MAX_CHARS) throw new KitError('KIT_TOO_LARGE');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new KitError('KIT_NOT_JSON', err instanceof Error ? err.message : String(err));
  }
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (r.schema !== KIT_SCHEMA) throw new KitError('KIT_NOT_A_KIT');
  const name = str(r.name, 80)?.trim();
  const version = str(r.version, 40);
  if (!name || !version || Number.isNaN(Date.parse(version))) throw new KitError('KIT_NOT_A_KIT');

  const files: KitFile[] = (Array.isArray(r.files) ? r.files : []).map((f: unknown) => {
    const o = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
    const rel = checkKitPath(o.rel);
    if (typeof o.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(o.base64) || !o.base64) throw new KitError('KIT_BAD_FILE', rel);
    return { rel, base64: o.base64 };
  });
  const have = new Set(files.map((f) => f.rel));
  const pages: KitPage[] = (Array.isArray(r.pages) ? r.pages : []).map((p: unknown) => {
    const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    const rel = checkKitPath(o.rel);
    // A menu entry pointing at nothing would be a dead link on the site.
    if (!rel.endsWith('.html') || !have.has(rel)) throw new KitError('KIT_PAGE_MISSING', rel);
    return { rel, title: str(o.title, 80)?.trim() || rel.slice(rel.lastIndexOf('/') + 1, -5) };
  });

  const kit: Kit = { schema: KIT_SCHEMA, name, version, brand: readBrand(r.brand), pages, files };
  if (r.identity && typeof r.identity === 'object') {
    // Cleaned like a site.json identity: an svg is taken again to its shapes. A path from the maker's disk never travels.
    const { logoPath: _maker, vectorFrom: _makerPicture, ...identity } = normalizeIdentity(r.identity);
    kit.identity = identity;
  }
  if (r.records && typeof r.records === 'object') kit.records = readRecords(r.records);
  if (r.showcase && typeof r.showcase === 'object') {
    checkMedia(r.showcase);
    const showcase = normalizeShowcase(r.showcase);
    if (Object.keys(showcase).length) kit.showcase = showcase;
  }
  const picture = (v: unknown): Kit['logoFile'] => {
    const o = v as Record<string, unknown> | undefined;
    return o && (o.ext === 'png' || o.ext === 'jpg' || o.ext === 'webp') && typeof o.base64 === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(o.base64) ? { ext: o.ext, base64: o.base64 } : undefined;
  };
  const logoFile = picture(r.logoFile);
  if (logoFile) kit.logoFile = logoFile;
  const portraitFile = picture(r.portraitFile);
  if (portraitFile) kit.portraitFile = portraitFile;
  return kit;
}

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const MEDIA_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/;

/** Every media reference of a value, checked: a plain file name inside media/, never a way out. */
/** A path on someone's disk: it means nothing on hers. */
const ABSOLUTE = /^([A-Za-z]:[\\/]|\\\\|\/(Users|home|Volumes)\/)/;

function checkMedia(v: unknown): void {
  if (typeof v === 'string') {
    if (ABSOLUTE.test(v)) throw new KitError('KIT_BAD_RECORD', v.slice(0, 80));
    if (v.startsWith(KIT_MEDIA) && (!MEDIA_NAME.test(v.slice(KIT_MEDIA.length)) || v.includes('..'))) throw new KitError('KIT_BAD_PATH', v);
  } else if (Array.isArray(v)) v.forEach(checkMedia);
  else if (v && typeof v === 'object') Object.values(v).forEach(checkMedia);
}

function readRecords(raw: object): KitRecords {
  const r = raw as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v : []).map((x: unknown) => {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    if (typeof o.id !== 'string' || !ID.test(o.id)) throw new KitError('KIT_BAD_RECORD', String(o.id));
    checkMedia(o);
    return o as Record<string, unknown> & { id: string };
  });
  const out: KitRecords = { pieces: list(r.pieces), scenes: list(r.scenes), markets: list(r.markets) };
  if (r.film && typeof r.film === 'object') { checkMedia(r.film); out.film = r.film as Record<string, unknown>; }
  return out;
}

/** A value with its media references turned into files of the kit folder `dir`. */
export function resolveMedia<T>(v: T, dir: string, join: (...parts: string[]) => string): T {
  if (typeof v === 'string') return (v.startsWith(KIT_MEDIA) ? join(dir, 'media', v.slice(KIT_MEDIA.length)) : v) as T;
  if (Array.isArray(v)) return v.map((x: unknown) => resolveMedia(x, dir, join)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveMedia(x, dir, join)])) as T;
  return v;
}

/** True when the kit's work names media, which only a kit FOLDER can give. */
export function needsFolder(kit: Kit): boolean {
  let found = false;
  const look = (v: unknown) => {
    if (found) return;
    if (typeof v === 'string') found = v.startsWith(KIT_MEDIA);
    else if (Array.isArray(v)) v.forEach(look);
    else if (v && typeof v === 'object') Object.values(v).forEach(look);
  };
  look(kit.records);
  look(kit.showcase);
  return found;
}

/**
 * The menu entries of a folder of pages: every `.html` at its top, titled by
 * its `<title>` (its file name otherwise), in file-name order so the maker
 * orders the menu with a `01-` prefix.
 */
export function pageTitles(files: Array<{ rel: string; text?: string }>): KitPage[] {
  return files
    .filter((f) => /^pages\/[^/]+\.html$/i.test(f.rel))
    .sort((a, b) => a.rel.localeCompare(b.rel))
    .map((f) => {
      const m = f.text ? /<title[^>]*>([^<]*)<\/title>/i.exec(f.text) : null;
      const title = (m?.[1] ?? '').replace(/\s+/g, ' ').trim();
      const file = f.rel.slice(6, -5).replace(/^\d+[-_ ]*/, '');
      return { rel: f.rel, title: title || file || f.rel };
    });
}

/** An identity compared without what is measured on the machine (ratio) or lives on its disk (logoPath). */
function sameIdentity(a: Identity | undefined, b: Identity | undefined): boolean {
  if (!a || !b) return a === b;
  const key = ({ ratio: _r, logoPath: _p, ...rest }: Identity) => JSON.stringify(rest);
  return key(a) === key(b) && !!a.logoPath === !!b.logoPath;
}

export interface SiteLike { brand: Brand; identity: Identity }

/**
 * The settings once the kit is put in place. First kit (`applied` absent):
 * what the kit brings wins, what it leaves empty stays hers. A later kit:
 * a field still as the last kit left it takes the new value; one she changed
 * stays hers and is named in `kept`.
 */
export function applyKit<S extends SiteLike>(site: S, kit: Kit, applied: KitApplied | undefined, logoPath?: string, portraitPath?: string): { site: S; kept: string[]; applied: KitApplied } {
  const kept: string[] = [];
  const brand = { ...site.brand };
  for (const f of BRAND_FIELDS) {
    const next = kit.brand[f];
    if (next === undefined || next === '') continue;
    // Hers when it differs from what the last kit put there, or, for a field that kit left alone, when she filled it.
    const mine = applied !== undefined && (applied.brand[f] !== undefined ? site.brand[f] !== applied.brand[f] : site.brand[f] !== '');
    if (mine) { if (site.brand[f] !== next) kept.push(f); continue; }
    brand[f] = next;
  }
  // The portrait: hers when she chose one since the last kit (or before the first), the kit's otherwise.
  if (portraitPath !== undefined || kit.portraitFile) {
    // The brand's rule: a first kit wins; later, hers when changed since the last kit, or set when it brought none.
    const mine = applied !== undefined && (applied.portrait !== undefined ? brand.portrait !== applied.portrait : brand.portrait !== undefined);
    if (mine) kept.push('portrait'); else if (portraitPath) brand.portrait = portraitPath;
  }
  let identity = site.identity;
  let appliedIdentity = applied?.identity;
  if (kit.identity) {
    const fromKit: Identity = { ...DEFAULT_IDENTITY, ...kit.identity, ...(logoPath ? { logoPath, svg: undefined } : {}) };
    const mine = applied !== undefined && (applied.identity !== undefined ? !sameIdentity(site.identity, applied.identity) : !!(site.identity.svg || site.identity.logoPath));
    if (mine) {
      if (!sameIdentity(site.identity, fromKit)) kept.push('identity');
    } else {
      identity = fromKit;
      appliedIdentity = fromKit;
    }
  }
  const appliedPortrait = portraitPath && brand.portrait === portraitPath ? portraitPath : applied?.portrait;
  const next: KitApplied = { name: kit.name, version: kit.version, brand: { ...applied?.brand, ...kit.brand }, ...(appliedIdentity ? { identity: appliedIdentity } : {}), ...(appliedPortrait ? { portrait: appliedPortrait } : {}) };
  return { site: { ...site, brand, identity }, kept, applied: next };
}

/** The applied record read back from site.json (anything malformed is dropped: the next kit then counts as a first one). */
export function normalizeKitApplied(raw: unknown): KitApplied | undefined {
  const r = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  if (!r) return undefined;
  const name = str(r.name, 80);
  const version = str(r.version, 40);
  // A version that is no date is malformed: dropped, so the next kit counts as a first one.
  if (!name || !version || Number.isNaN(Date.parse(version))) return undefined;
  const out: KitApplied = { name, version, brand: readBrand(r.brand) };
  if (r.identity && typeof r.identity === 'object') out.identity = normalizeIdentity(r.identity);
  if (typeof r.portrait === 'string' && r.portrait) out.portrait = r.portrait.slice(0, 1000);
  return out;
}

/** The kit's file name, from its name: `atelier-rosalie.kit.json`. */
export function kitFileName(name: string): string {
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'site'}.kit.json`;
}

/** A newer kit than the one in place (or the first one). */
export function isNewer(kit: Kit, applied: KitApplied | undefined): boolean {
  return !applied || Date.parse(kit.version) > Date.parse(applied.version);
}

/**
 * The kit's showcase added to hers: a piece she already set keeps her
 * settings; the kit's photos point into the kit folder.
 */
export function mergeShowcase(mine: Record<string, PieceShow>, kit: Kit, kitDir: string | undefined, join: (...parts: string[]) => string): Record<string, PieceShow> {
  if (!kit.showcase) return mine;
  const theirs = kitDir ? resolveMedia(kit.showcase, kitDir, join) : kit.showcase;
  const out = { ...mine };
  for (const [id, show] of Object.entries(theirs)) if (!out[id]) out[id] = show;
  return out;
}
