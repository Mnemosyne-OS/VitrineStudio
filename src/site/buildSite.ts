/**
 * The website, built from the studio's records (doc 145 §10.3, lot 3).
 *
 * Only VALIDATED scenes go online. The grid's rows are the places (the
 * scene's `universe`), its columns the ambiances in that place, in the order
 * the scenes were made. Nothing is specific to one craftsperson: the brand,
 * the texts and the blog are data written next to the page (`data.json`).
 *
 * `buildSiteData` and `fillShell` are pure. `exportSite` runs the steps with
 * injected doors (read a picture, encode it, write a file), so it is tested
 * without a host.
 */
import { LOGO_ASSET, LOGO_CSS, siteIdentity, type Identity, type SiteIdentity } from './logo';
import type { Beat, Piece, Scene } from '../model/types';
import type { KitApplied } from '../model/kit';
import { JOST_WOFF2_BASE64 } from './fonts/jost';
import { defaultShow, formatSize, formatMass, inPieceOrder, type Category, measureRows, onCreationsPage, type CreationsHover, type PieceShow } from '../model/showcase';
import { approximations, DEFAULT_CURRENCY, formatMoney, type CurrencySettings } from '../model/currency';
import { captionLines, type CaptionLines } from '../model/caption';
import type { SceneMap } from '../model/sceneMap';
import { onPage, type FormField, type PageLayout, type SitePage } from '../model/pages';
import { normalizeSocials, socialLinks, type Socials } from '../model/socials';
import { creationZoomAsset, type ViewerSettings } from '../model/viewer';
import { EMPTY_LEGAL, type Legal } from '../model/legal';
import { layersCurrent, type LayerBox } from '../model/sceneLayers';
import { legalPages, type LegalSite, type SiteLegal } from './legalPages';
import { markdownToHtml, postExcerpt, postImages, postPieces, readingMinutes, sortPosts, type BlogPost } from '../model/blog';
import type { SitePost } from '../data/blogIO';
import { base64Bytes, dataUrlPayload, utf8Base64 } from '../data/bytes';
import type { Lang } from '../model/profiles';
import type { FilmStep } from '../model/film';
import { filmComplete, type Film } from '../model/filmRecord';

export const ABOUT_LAYOUTS = ['right', 'left', 'top'] as const;
export type AboutLayout = (typeof ABOUT_LAYOUTS)[number];
export const CONTACT_LAYOUTS = ['left', 'right'] as const;
export type ContactLayout = (typeof CONTACT_LAYOUTS)[number];

export interface Brand {
  /** The site's accent colour (#rrggbb). The person's choice, never one artisan's. */
  accent: string;
  /** The text colour (#rrggbb): titles, labels, the map. The soft text and the lines are derived from it. */
  ink: string;
  /** The background of the pages (#rrggbb). */
  paper: string;
  name: string;
  tagline: string;
  about: string;
  email: string;
  instagram: string;
  /** The film's sentence, beside it on the home page; its lines kept. */
  introLine: string;
  /** The person's portrait on the About page: a picture on disk, written as assets/portrait.webp (never its path online). */
  portrait?: string;
  /** The words under the portrait; its lines kept. */
  portraitCaption: string;
  /** A note beside the contact form (a newsletter, opening hours), as Markdown. */
  contactNote: string;
  /** Where the portrait stands on the About page; absent = right of the words. */
  aboutLayout?: AboutLayout;
  /** Which side the contact form stands; absent = left. */
  contactLayout?: ContactLayout;
  /** Her social networks, by network: her name there or its address (model/socials.ts). */
  socials?: Socials;
  /** The artisan's Formspree form (its id): the contact form sends there from the page. Empty = the visitor's mail app. */
  formspree: string;
}

export interface Market {
  id: string;
  name: string;
  place?: string;
  /** YYYY-MM-DD */
  startDate: string;
  endDate?: string;
}

export interface SiteSettings {
  /** The site folder declared in the host (`site.declareFolder`). Absent until chosen. */
  siteId?: string;
  siteName?: string;
  /** The Vercel project name: lowercase letters, digits, dashes. */
  projectName: string;
  brand: Brand;
  /** `analytics`: whether that publish carried the visit counter (a change since then waits for the next one). */
  lastPublish?: { url: string; aliases: string[]; readyState: string; at: string; analytics?: boolean };
  /** Visits counted by Vercel Web Analytics, without cookies (the Hosting tab); absent = off. */
  analytics?: boolean;
  /** How sharp the big screens' pictures are, and how heavy the site gets. */
  quality: ExportQuality;
  /** The most a large picture may weigh, in KB; null = no limit. Phones get 40 % of it. */
  imageKb: ImageKb;
  /** What the last export wrote, measured. */
  lastExport?: ExportSize & { at: string };
  /** The logo and how the header shows it (the Logo tab). */
  identity: Identity;
  /** The site kit in place (model/kit.ts): what it put in these settings. */
  kit?: KitApplied;
  /** On the kit maker's side: the folder of hand-made pages the kit carries. */
  kitSource?: string;
  /** How each piece shows on the Creations page (model/showcase.ts), by piece id. */
  showcase: Record<string, PieceShow>;
  /** What a creation does under the pointer. */
  creationsHover: CreationsHover;
  /** The site's currency, others shown as « ≈ », and their rates. */
  currency: CurrencySettings;
  /** The blog: Markdown files written in Notes (model/blog.ts). */
  posts: BlogPost[];
  /** The menu's names as she renamed them; an empty one keeps the site's own word. */
  menu: MenuNames;
  /** The menu's entries in the order she set; empty = the site's own order. */
  menuOrder: MenuKey[];
  /** The pieces in the order she set (the studio's tiles and the Creations page). */
  pieceOrder: string[];
  /** The scenes in the order she set, inside their places (studio and site). */
  sceneOrder: string[];
  /** The categories the creations are filed under, in her order. */
  categories: Category[];
  /** The little map of the places: its model and its own colour. */
  sceneMap: SceneMap;
  /** The pages she added, each with its own content (model/pages.ts), in her order. */
  pages: SitePage[];
  /** A creation opened large: its loupe and its frame (model/viewer.ts). */
  viewer: ViewerSettings;
  /** Who publishes the site, the notice and the credit (model/legal.ts). */
  legal: Legal;
}

/** Any weight the person wants (Tony: « si il veut des photos de 800 Ko, c'est son choix »). */
export type ImageKb = number | null;
export const IMAGE_KB_CHOICES: readonly ImageKb[] = [100, 200, 400, 800, null];
export const IMAGE_KB_MIN = 20;
export const IMAGE_KB_MAX = 5000;
/**
 * Bytes written by an export, by kind. `heavyClips`: clips sent as they are
 * because no lighter copy could be made (ffmpeg absent, or it failed); absent = none.
 */
export interface ExportSize { files: number; bytes: number; imageBytes: number; clipBytes: number; heavyClips?: number }

/**
 * The large pictures' width and the WebP quality, per choice. The small size
 * (phones) stays 800 px whatever is chosen: a phone never shows more. A
 * picture is never enlarged by the export, so a large width only helps a
 * picture that is that wide already (see the settings' enlargement).
 */
export type ExportQuality = 'standard' | 'high' | 'max';
export const EXPORT_QUALITIES: readonly ExportQuality[] = ['standard', 'high', 'max'];
export const EXPORT_QUALITY: Record<ExportQuality, { large: number; webp: number }> = {
  standard: { large: 1600, webp: 0.85 },
  high: { large: 2560, webp: 0.9 },
  max: { large: 3840, webp: 0.92 },
};

export const DEFAULT_ACCENT = '#5F5A53';
export const DEFAULT_INK = '#2B2926';
export const DEFAULT_PAPER = '#EEECE7';
/** The colours a site starts with, and the ones "Default" brings back. */
export const DEFAULT_COLOURS = { ink: DEFAULT_INK, paper: DEFAULT_PAPER, accent: DEFAULT_ACCENT } as const;
export const EMPTY_BRAND: Brand = { accent: DEFAULT_ACCENT, ink: DEFAULT_INK, paper: DEFAULT_PAPER, name: '', tagline: '', about: '', email: '', instagram: '', introLine: '', portraitCaption: '', contactNote: '', formspree: '' };
/**
 * A Formspree form's id, from what the person pasted (its address or the id
 * alone); null when it is neither. Only a Formspree address: a typo never
 * sends her visitors' messages somewhere else.
 */
export function formspreeId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return '';
  const m = /^(?:https?:\/\/)?(?:www\.)?formspree\.io\/f\/([A-Za-z0-9]{4,32})\/?$/.exec(s) ?? /^([A-Za-z0-9]{4,32})$/.exec(s);
  return m ? m[1]! : null;
}

/** The portrait's file on the site. */
export const PORTRAIT_ASSET = 'assets/portrait.webp';

/** A project name Vercel accepts, from a brand name: "Atelier Rosalie" → "atelier-rosalie". */
export function slugify(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export type Size = 's' | 'l';
/** Width of each size: the phone one and the computer one. */
export const SIZES: Record<Size, number> = { s: 800, l: 1600 };

export const sceneAsset = (sceneId: string, beat: Beat, size: Size) => `assets/${sceneId}-${beat}-${size}.webp`;
export const creationAsset = (pieceId: string) => `assets/creation-${pieceId}.webp`;
/** A creation's further photos: its own photo stays creationAsset. */
export const creationPhotoAsset = (pieceId: string, n: number) => `assets/creation-${pieceId}-${n + 1}.webp`;
/** A blog post's pictures, in the order the post shows them. */
export const blogImageAsset = (postId: string, n: number) => `assets/blog-${postId}-${n + 1}.webp`;

/**
 * The files a blog needs besides its words: each post's pictures, and the
 * photo of each piece it shows (the same file as on the Creations page).
 */
export function blogAssets(posts: Array<{ id: string; text: string }>, pieces: Piece[]): Array<{ name: string; path: string }> {
  const out: Array<{ name: string; path: string }> = [];
  for (const p of posts) {
    postImages(p.text).forEach((path, n) => out.push({ name: blogImageAsset(p.id, n), path }));
    for (const id of postPieces(p.text)) {
      const piece = pieces.find((x) => x.id === id);
      if (piece?.photoPath && !out.some((f) => f.name === creationAsset(id))) out.push({ name: creationAsset(id), path: piece.photoPath });
    }
  }
  return out;
}
export const clipAsset = (sceneId: string) => `assets/${sceneId}-clip.mp4`;
export const filmClipAsset = (stepId: string) => `assets/film-${stepId}.mp4`;
export const filmPosterAsset = (size: Size) => `assets/film-poster-${size}.webp`;

/** The menu entries she may rename. */
export const MENU_KEYS = ['creations', 'about', 'blog', 'contact'] as const;
export type MenuKey = (typeof MENU_KEYS)[number];
export type MenuNames = Partial<Record<MenuKey, string>>;

/** A menu read back: known entries only, one line each, short, never empty. */
export function normalizeMenu(raw: unknown): MenuNames {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: MenuNames = {};
  for (const k of MENU_KEYS) { const v = r[k]; if (typeof v === 'string' && v.replace(/\s+/g, ' ').trim()) out[k] = v.replace(/\s+/g, ' ').trim().slice(0, 40); }
  return out;
}

/** The menu's order read back: known entries, once each; the missing ones follow in the site's own order. */
export function normalizeMenuOrder(raw: unknown): MenuKey[] {
  const given = (Array.isArray(raw) ? raw : []).filter((k): k is MenuKey => MENU_KEYS.includes(k as MenuKey));
  const once = [...new Set(given)];
  return once.length ? [...once, ...MENU_KEYS.filter((k) => !once.includes(k))] : [];
}

/** The page each menu entry opens (the site's own ids). */
export const MENU_PAGE: Record<MenuKey, string> = { creations: 'creations', about: 'a-propos', blog: 'blog', contact: 'contact' };

/** What a preview may change in the menu: one entry's name, or the order of all. */
export type MenuChange = { key: MenuKey; name: string } | { order: MenuKey[] } | { pieces: string[] };

/** The site's own word for each menu entry, in its language (a renamed entry's hint). */
export function menuDefaults(lang: Lang): Record<MenuKey, string> {
  const t = TEXTS[lang];
  return { creations: t.creations!, about: t.about!, blog: t.blog!, contact: t.contact! };
}

const TEXTS: Record<Lang, Record<string, string>> = {
  fr: { menu: 'Menu', close: 'Fermer', formSending: 'Envoi…', formSent: 'Message envoyé, merci.', formFailed: 'Le message n’est pas parti. Réessayez, ou écrivez directement.', formVia: 'Envoyé par Formspree.', creations: 'Créations', about: 'À propos', blog: 'Blog', contact: 'Contact', back: 'Retour aux ambiances', empty: 'Bientôt.', generated: 'Décor généré · pièce réelle', enter: 'Entrer dans l’atelier', hint: 'Faites défiler · ↑ ↓ une pièce · ← → une ambiance', hintScroll: 'Faites défiler', hintRoom: 'une pièce', hintAmbiance: 'une ambiance', hintSwipe: 'Glissez ↑ ↓ une pièce · ← → une ambiance', allPosts: 'Tous les articles', allCats: 'Tout', readTime: '{n} min de lecture', formName: 'Nom', formEmail: 'E-mail', formMessage: 'Message', formSend: 'Envoyer', formSubject: 'Message du site', place: 'Le lieu', piece: 'La pièce', alive: 'Le vivant' },
  en: { menu: 'Menu', close: 'Close', formSending: 'Sending…', formSent: 'Message sent, thank you.', formFailed: 'The message did not go. Try again, or write directly.', formVia: 'Sent through Formspree.', creations: 'Creations', about: 'About', blog: 'Blog', contact: 'Contact', back: 'Back to the ambiances', empty: 'Coming soon.', generated: 'Generated setting · real piece', enter: 'Enter the workshop', hint: 'Scroll · ↑ ↓ a room · ← → an ambiance', hintScroll: 'Scroll', hintRoom: 'a room', hintAmbiance: 'an ambiance', hintSwipe: 'Swipe ↑ ↓ a room · ← → an ambiance', allPosts: 'All posts', allCats: 'All', readTime: '{n} min read', formName: 'Name', formEmail: 'Email', formMessage: 'Message', formSend: 'Send', formSubject: 'Message from the website', place: 'The place', piece: 'The piece', alive: 'The living' },
  es: { menu: 'Menú', close: 'Cerrar', formSending: 'Enviando…', formSent: 'Mensaje enviado, gracias.', formFailed: 'El mensaje no salió. Inténtalo de nuevo o escribe directamente.', formVia: 'Enviado por Formspree.', creations: 'Creaciones', about: 'Sobre mí', blog: 'Blog', contact: 'Contacto', back: 'Volver a los ambientes', empty: 'Muy pronto.', generated: 'Decorado generado · pieza real', enter: 'Entrar al taller', hint: 'Desplázate · ↑ ↓ una estancia · ← → un ambiente', hintScroll: 'Desplázate', hintRoom: 'una estancia', hintAmbiance: 'un ambiente', hintSwipe: 'Desliza ↑ ↓ una estancia · ← → un ambiente', allPosts: 'Todos los artículos', allCats: 'Todo', readTime: '{n} min de lectura', formName: 'Nombre', formEmail: 'Correo', formMessage: 'Mensaje', formSend: 'Enviar', formSubject: 'Mensaje del sitio', place: 'El lugar', piece: 'La pieza', alive: 'Lo vivo' },
};

/** A piece's measures named in the site's language, in the viewer's table. */
const SPEC_LABELS: Record<Lang, { l: string; h: string; w: string; weight: string }> = {
  fr: { l: 'Longueur', h: 'Hauteur', w: 'Largeur', weight: 'Poids' },
  en: { l: 'Length', h: 'Height', w: 'Width', weight: 'Weight' },
  es: { l: 'Largo', h: 'Alto', w: 'Ancho', weight: 'Peso' },
};

/**
 * A living scene on the site (doc 145 §10.18): over its place picture, each
 * layer's two sizes and its box in % of the picture, the sway map with the
 * life, and where the life leaves the piece.
 */
export interface SiteLayers {
  pot: SiteLayer;
  shadowPiece?: SiteLayer;
  potAlive: SiteLayer;
  shadowAlive?: SiteLayer;
  sway?: { s: string; l: string };
  /** The room under the layers (the last picture, subject erased); absent = the place picture. */
  room?: { s: string; l: string };
  pivot: { x: number; y: number };
}
export interface SiteLayer extends LayerBox { s: string; l: string }

/** The layers a living scene sends, by their name in the site's assets. */
export const LAYER_KEYS = ['pot', 'shadowPiece', 'potAlive', 'shadowAlive'] as const;
export const sceneLayerAsset = (sceneId: string, key: string, size: Size) => `assets/${sceneId}-layer-${key}-${size}.webp`;

/** Whether a scene goes on the site as layers: chosen, and made from the pictures it has now. */
/** A room of the site, as the page reads it. */
export type SiteCell = SiteData['rows'][number]['scenes'][number];

/**
 * Every file a room of the site names, with the scene's file behind it: its
 * pictures, its clip, and a living scene's room and layers. The light previews
 * (the Scenes page, the logo's card) read exactly these; they once read the
 * pictures and the clip only, and a living scene showed an empty room (field,
 * 2026-10-12).
 */
export function cellFiles(cell: SiteCell, scene: Scene): Array<{ name: string; path: string }> {
  const out: Array<{ name: string; path: string }> = [];
  const both = (names: { s: string; l: string } | undefined, path: string | undefined) => { if (names && path) out.push({ name: names.s, path }, { name: names.l, path }); };
  for (const b of Object.keys(cell.images) as Beat[]) both(cell.images[b], scene.images[b]);
  if (cell.clip && scene.clipPath) out.push({ name: cell.clip, path: scene.clipPath });
  const L = cell.layers, from = scene.layers;
  if (L && from) {
    both(L.room, from.room);
    for (const k of LAYER_KEYS) both(L[k], from[k]?.path);
    both(L.sway, from.swayMap);
  }
  return out;
}

export const livingOnSite = (s: Scene): boolean => s.motion === 'living' && layersCurrent(s.layers, s.images);
/** Scenes chosen Living whose layers are missing or stale: the site shows their pictures instead, and says how many. */
export const livingFallsBack = (scenes: Scene[]): number => scenes.filter((s) => s.motion === 'living' && !livingOnSite(s)).length;

export interface SiteData {
  brand: Brand;
  texts: Record<string, string>;
  rows: Array<{ name: string; scenes: Array<{ id: string; name: string; piece: string; images: Partial<Record<Beat, { s: string; l: string }>>; clip?: string; cut?: { in: number; out: number }; caption?: CaptionLines; layers?: SiteLayers }> }>;
  /** Each creation: `alt` always (it names the picture), the rest only when the artisan shows it. */
  /** The Creations page's filters, those that hold a creation on it. Absent = no filter. */
  categories?: Category[];
  /** The little map of the places, as she styled it; absent = the dots in the site's ink. */
  sceneMap?: SceneMap;
  /** A creation opened large: its loupe and its frame; absent = neither. */
  viewer?: ViewerSettings;
  /** The legal notice, the privacy page, the footer and the first visit's notice. */
  legal?: SiteLegal;
  /** The page loads Vercel's visit counter (no cookie). Absent = no counter. */
  analytics?: boolean;
  creations: Array<{ id: string; alt: string; zoom?: string[]; cats?: string[]; name?: string; description?: string; dimensions?: string; weight?: string; specs?: Array<[string, string]>; price?: string; priceAlso?: string[]; images: string[] }>;
  /** What a creation does under the pointer. */
  creationsHover?: CreationsHover;
  /** The blog, newest first: its HTML made at export from the post's Markdown. Absent when no post is online. */
  posts?: Array<{ id: string; title: string; when?: string; html: string; excerpt: string; minutes: number; cover?: string }>;
  /** The home film: its first picture while it loads, then its clips in order. Absent unless validated and complete. */
  film?: { poster: { s: string; l: string }; clips: string[]; cuts?: Array<{ in: number; out: number } | null> };
  /** The header's logo and name, and the tab icon (site/logo.ts). Absent = the name alone. */
  identity?: SiteIdentity;
  /** The portrait's file on the site (PORTRAIT_ASSET), when there is one. */
  portrait?: string;
  /** The menu's entries by page id, in the order she set. Absent = the site's own order. */
  menuOrder?: string[];
  /** Hand-made pages from the site kit (model/kit.ts), linked from the menu after the page's own sections. */
  links?: Array<{ title: string; href: string }>;
  /** The pages she added, each with its own content; only those with something to show. */
  pages?: AddedPageData[];
  /** The About and Contact words with their formatting, made from her Markdown at build. */
  aboutHtml?: string;
  contactHtml?: string;
  /** Her networks as icons and links on the Contact page. */
  socials?: ReturnType<typeof socialLinks>;
}

/** An added page on the site: its rooms, its catalogue (and its filters), or its posts. */
export interface AddedPageData {
  id: string;
  type: SitePage['type'];
  title: string;
  rows?: SiteData['rows'];
  creations?: SiteData['creations'];
  categories?: Category[];
  posts?: NonNullable<SiteData['posts']>;
  /** A text or a form page: its words, made from her Markdown. */
  html?: string;
  /** A text page's picture on the site. */
  photo?: string;
  layout?: PageLayout;
  /** A form page: what it asks. */
  fields?: FormField[];
}

/** An added text page's picture on the site. */
export const pagePhotoAsset = (pageId: string) => `assets/page-${pageId}.webp`;

/** Every room of the site, the home's and the added pages': the export writes them all. */
export const allRows = (d: SiteData): SiteData['rows'] => [...d.rows, ...(d.pages ?? []).flatMap((p) => p.rows ?? [])];
/** Every creation shown anywhere on the site. */
export const allCreations = (d: SiteData): SiteData['creations'] => [...d.creations, ...(d.pages ?? []).flatMap((p) => p.creations ?? [])];

/** Where the home film's files come from on disk, in the order the page plays them. Null unless it goes online. */
export function filmSources(film: Film | null, steps: FilmStep[]): { poster: string; clips: Array<{ name: string; path: string; cut?: { in: number; out: number } }> } | null {
  if (!film || !film.validated || !filmComplete(film, steps)) return null;
  return {
    poster: film.keyframes[steps[0]!.id]!,
    clips: steps.slice(1).map((s) => ({ name: filmClipAsset(s.id), path: film.clips[s.id]!, ...(film.cuts[s.id] ? { cut: film.cuts[s.id] } : {}) })),
  };
}

/**
 * The scenes the website shows: validated, with a first picture, of a piece
 * not sold (a sold piece leaves the website with its scenes, not only the
 * creations page). The studio counts THESE, never the validated ones, so
 * "1 scene online" is never said over an empty page.
 */
export function onlineScenes(scenes: Scene[], pieces: Piece[]): Scene[] {
  const sold = new Set(pieces.filter((p) => p.status === 'sold').map((p) => p.id));
  return scenes.filter((s) => s.validated && s.images.place && !sold.has(s.pieceId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The scenes that go online, grouped in rows by place, in the order she set (then the order they were made). */
export function siteRows(scenes: Scene[], pieces: Piece[], untitled: string, order: readonly string[] = []): SiteData['rows'] {
  const rows: SiteData['rows'] = [];
  const shown = inPieceOrder(onlineScenes(scenes, pieces), order);
  for (const s of shown) {
    const name = s.universe.trim() || untitled;
    let row = rows.find((r) => r.name === name);
    if (!row) rows.push((row = { name, scenes: [] }));
    const images: SiteData['rows'][number]['scenes'][number]['images'] = {};
    const living = livingOnSite(s);
    // A living scene's piece and life ARE its layers: its pictures 2 and 3 do not travel.
    for (const b of (living ? ['place'] : ['place', 'piece', 'alive']) as Beat[]) {
      if (s.images[b]) images[b] = { s: sceneAsset(s.id, b, 's'), l: sceneAsset(s.id, b, 'l') };
    }
    const clip = s.motion !== 'living' && s.motion !== 'images' && s.clipPath && images.piece && images.alive;
    row.scenes.push({
      id: s.id, name: s.variant.trim() || name, piece: pieces.find((p) => p.id === s.pieceId)?.name ?? '', images,
      ...(clip ? { clip: clipAsset(s.id), ...(s.clipCut ? { cut: s.clipCut } : {}) } : {}),
      ...(living ? { layers: siteLayersOf(s) } : {}),
    });
  }
  return rows;
}

/** A living scene's layers as the site names them. */
function siteLayersOf(s: Scene): SiteLayers {
  const l = s.layers!;
  const one = (key: string, b: LayerBox): SiteLayer => ({ s: sceneLayerAsset(s.id, key, 's'), l: sceneLayerAsset(s.id, key, 'l'), x: b.x, y: b.y, w: b.w, h: b.h });
  return {
    pot: one('pot', l.pot), potAlive: one('potAlive', l.potAlive),
    ...(l.shadowPiece ? { shadowPiece: one('shadowPiece', l.shadowPiece) } : {}),
    ...(l.shadowAlive ? { shadowAlive: one('shadowAlive', l.shadowAlive) } : {}),
    ...(l.swayMap ? { sway: { s: sceneLayerAsset(s.id, 'sway', 's'), l: sceneLayerAsset(s.id, 'sway', 'l') } } : {}),
    ...(l.room ? { room: { s: sceneLayerAsset(s.id, 'room', 's'), l: sceneLayerAsset(s.id, 'room', 'l') } } : {}),
    pivot: l.pivot,
  };
}

/** "12 juin 2026": a post's day in the site language. */
export function postWhen(day: string, lang: Lang): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function buildSiteData(input: { brand: Brand; lang: Lang; scenes: Scene[]; pieces: Piece[]; posts?: SitePost[]; today: string; untitled: string; film?: ReturnType<typeof filmSources>; identity?: Identity; links?: Array<{ title: string; href: string }>; beats?: Record<Beat, string>; showcase?: Record<string, PieceShow>; hover?: CreationsHover; currency?: CurrencySettings; menu?: MenuNames; menuOrder?: MenuKey[]; pieceOrder?: string[]; sceneOrder?: string[]; categories?: Category[]; sceneMap?: SceneMap; pages?: SitePage[]; viewer?: ViewerSettings; legal?: Legal; analytics?: boolean }): SiteData {
  const loupe = !!input.viewer && input.viewer.loupe !== 'none';
  const pages = input.pages ?? [];
  // The rooms of some scenes, with the words over each, read from its piece's record at build time.
  const sceneRows = (list: Scene[]) => {
    const rows = siteRows(list, input.pieces, input.untitled, input.sceneOrder);
    for (const row of rows) for (const cell of row.scenes) {
      const scene = input.scenes.find((x) => x.id === cell.id);
      const lines = scene ? captionLines(scene.caption, input.pieces.find((p) => p.id === scene.pieceId), input.showcase?.[scene.pieceId], input.lang, input.currency ?? DEFAULT_CURRENCY) : null;
      if (lines) cell.caption = lines;
    }
    return rows;
  };
  // The home's scenes; an added scenes page shows its own.
  const rows = sceneRows(onPage(input.scenes, null, pages));
  const pageRows = new Map(pages.filter((p) => p.type === 'scenes').map((p) => [p.id, sceneRows(onPage(input.scenes, p.id, pages))]));
  // The creations page shows the pieces that appear in the scenes online, and only those still for sale.
  const online = new Set([rows, ...pageRows.values()].flat().flatMap((r) => r.scenes.map((s) => input.scenes.find((x) => x.id === s.id)!.pieceId)));
  const cur = input.currency ?? DEFAULT_CURRENCY;
  const creationsOf = (list: Piece[]) => inPieceOrder(list, input.pieceOrder ?? [])
    .filter((p) => onCreationsPage(p, input.showcase?.[p.id], online))
    .map((p) => {
      // Only what the artisan chose to show; the name always names the picture.
      const sh = input.showcase?.[p.id] ?? defaultShow();
      const extra = sh.show.photos ? sh.photos.map((_, n) => creationPhotoAsset(p.id, n)) : [];
      return {
        id: p.id, alt: p.name,
        ...(sh.show.name ? { name: p.name } : {}),
        ...(sh.show.description && p.description ? { description: p.description } : {}),
        // The three measures when set, else what was written freely before them.
        ...(sh.show.dimensions && (formatSize(sh.size, input.lang) ?? sh.dimensions) ? { dimensions: (formatSize(sh.size, input.lang) ?? sh.dimensions)! } : {}),
        ...(sh.show.weight && sh.weight !== undefined ? { weight: formatMass(sh.weight, input.lang) } : {}),
        // The same measures as a table in the viewer, one row each.
        ...(measureRows(sh.size, sh.weight, input.lang, SPEC_LABELS[input.lang], sh.show).length ? { specs: measureRows(sh.size, sh.weight, input.lang, SPEC_LABELS[input.lang], sh.show) } : {}),
        ...(sh.show.price && p.price !== undefined ? { price: formatMoney(p.price, input.lang, cur.main) } : {}),
        // Other currencies only with a rate the person fetched or typed, always marked approximate.
        ...(sh.show.price && p.price !== undefined && approximations(p.price, input.lang, cur).length ? { priceAlso: approximations(p.price, input.lang, cur) } : {}),
        // Its categories that still exist: the page's filters.
        ...((sh.cats ?? []).filter((id) => (input.categories ?? []).some((c) => c.id === id)).length ? { cats: (sh.cats ?? []).filter((id) => (input.categories ?? []).some((c) => c.id === id)) } : {}),
        images: [creationAsset(p.id), ...extra],
        // A loupe reads a large copy of each picture.
        ...(loupe ? { zoom: [creationZoomAsset(p.id, 0), ...extra.map((_, n) => creationZoomAsset(p.id, n + 1))] } : {}),
      };
    });
  const creations = creationsOf(onPage(input.pieces, null, pages));
  // A post's pictures take its asset names in order; its pieces show their photo, and their name and
  // price as the Creations page does. A piece with no photo, or gone, is left out of the block.
  const postsOf = (list: SitePost[]) => sortPosts(list).map((p) => {
    let n = 0;
    const html = markdownToHtml(p.text, {
      image: (img) => `<figure class="post-img ${img.layout}"><img src="${blogImageAsset(p.id, n++)}" alt="${escapeHtml(img.alt)}" loading="lazy" decoding="async">${img.alt ? `<figcaption>${escapeHtml(img.alt)}</figcaption>` : ''}</figure>`,
      pieces: (block) => {
        const items = block.ids.map((id) => input.pieces.find((x) => x.id === id)).filter((x): x is Piece => !!x?.photoPath);
        if (!items.length) return '';
        const shape = items.length === 1 ? 'single' : block.layout;
        return `<div class="post-pieces ${shape}">${items.map((x) => {
          const sh = (input.showcase?.[x.id] ?? defaultShow()).show;
          const price = sh.price && x.price !== undefined ? formatMoney(x.price, input.lang, cur.main) : '';
          const cap = `${sh.name ? `<span>${escapeHtml(x.name)}</span>` : ''}${price ? `<span>${escapeHtml(price)}</span>` : ''}`;
          return `<figure><img src="${creationAsset(x.id)}" alt="${escapeHtml(x.name)}" loading="lazy" decoding="async">${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
        }).join('')}</div>`;
      },
    });
    // Its tile: its first photo, else the first creation it shows that has one.
    const coverPiece = postPieces(p.text).map((id) => input.pieces.find((x) => x.id === id)).find((x) => x?.photoPath);
    const cover = postImages(p.text).length ? blogImageAsset(p.id, 0) : coverPiece ? creationAsset(coverPiece.id) : undefined;
    return { id: p.id, title: p.title, ...(p.date ? { when: postWhen(p.date, input.lang) } : {}), html, excerpt: postExcerpt(p.text), minutes: readingMinutes(p.text), ...(cover ? { cover } : {}) };
  });
  const posts = postsOf(onPage(input.posts ?? [], null, pages));
  // The portrait's path is the person's disk: online it is the site's own file, never the path.
  const { portrait, ...brand } = input.brand;
  // The three beats are named by the trade (a lamp's third beat is its light, not the living).
  // The menu as she named it: the same words name each page's title.
  const texts = { ...TEXTS[input.lang], ...(input.beats ? { place: input.beats.place, piece: input.beats.piece, alive: input.beats.alive } : {}), ...normalizeMenu(input.menu) };
  const data: SiteData = { brand, texts, rows, creations };
  if (posts.length) data.posts = posts;
  if (input.hover && input.hover !== 'none') data.creationsHover = input.hover;
  if (portrait) data.portrait = PORTRAIT_ASSET;
  if (input.film) {
    data.film = { poster: { s: filmPosterAsset('s'), l: filmPosterAsset('l') }, clips: input.film.clips.map((c) => c.name) };
    // The parts played, only when one is cut: a film without cuts writes the same data as before.
    if (input.film.clips.some((c) => c.cut)) data.film.cuts = input.film.clips.map((c) => c.cut ?? null);
  }
  if (input.identity) data.identity = siteIdentity(input.identity, input.brand.name);
  if (input.links?.length) data.links = input.links;
  // The menu's order as page ids; absent, the site's own order.
  const order = normalizeMenuOrder(input.menuOrder);
  if (order.length) data.menuOrder = order.map((k) => MENU_PAGE[k]);
  // The page's filters: the categories that hold a creation on it, in her order.
  const used = (input.categories ?? []).filter((c) => creations.some((x) => x.cats?.includes(c.id)));
  if (used.length) data.categories = used;
  if (input.sceneMap && (input.sceneMap.style !== 'dots' || input.sceneMap.color || input.sceneMap.guide || input.sceneMap.edges || input.sceneMap.credit)) data.sceneMap = input.sceneMap;
  // Her added pages, in her order, each with its own content; an empty one stays off the site.
  const added = pages.flatMap((pg): AddedPageData[] => {
    const head = { id: pg.id, type: pg.type, title: pg.name };
    if (pg.type === 'scenes') { const r = pageRows.get(pg.id) ?? []; return r.length ? [{ ...head, rows: r }] : []; }
    if (pg.type === 'catalogue') {
      const c = creationsOf(onPage(input.pieces, pg.id, pages));
      const cats = (input.categories ?? []).filter((k) => c.some((x) => x.cats?.includes(k.id)));
      return c.length ? [{ ...head, creations: c, ...(cats.length ? { categories: cats } : {}) }] : [];
    }
    // A text or a form page holds its content itself; a text page with nothing to show stays off.
    if (pg.type === 'text' || pg.type === 'form') {
      const html = pg.text?.trim() ? markdownToHtml(pg.text, { keepTitle: true }) : '';
      const more = { ...(html ? { html } : {}), ...(pg.layout ? { layout: pg.layout } : {}) };
      if (pg.type === 'form') return (pg.fields ?? []).length ? [{ ...head, ...more, fields: pg.fields }] : [];
      return html || pg.photo ? [{ ...head, ...more, ...(pg.photo ? { photo: pagePhotoAsset(pg.id) } : {}) }] : [];
    }
    const p = postsOf(onPage(input.posts ?? [], pg.id, pages));
    return p.length ? [{ ...head, posts: p }] : [];
  });
  if (added.length) data.pages = added;
  if (input.viewer && (input.viewer.loupe !== 'none' || input.viewer.frame !== 'none')) data.viewer = input.viewer;
  // Her words with their formatting; every character escaped but the studio's own tags.
  if (input.brand.about?.trim()) data.aboutHtml = markdownToHtml(input.brand.about, { keepTitle: true });
  const socials = socialLinks(input.brand.socials ?? normalizeSocials(undefined, input.brand.instagram ?? ''));
  if (socials.length) data.socials = socials;
  if (input.brand.contactNote?.trim()) data.contactHtml = markdownToHtml(input.brand.contactNote, { keepTitle: true });
  if (input.analytics) data.analytics = true;
  // Every site carries its legal notice and privacy page, from her fields and what the site does.
  data.legal = legalPages(input.legal ?? EMPTY_LEGAL, legalSiteOf(input, data));
  return data;
}

/** What the legal pages need to know about the site: the same facts for the page and for the studio's editor. */
export function legalSiteOf(input: Pick<SiteInput, 'brand' | 'lang' | 'analytics'>, data: SiteData): LegalSite {
  const b = input.brand;
  return { name: b.name, email: b.email ?? '', formspree: !!b.formspree, form: !!(b.email || b.formspree), socials: (data.socials ?? []).length > 0 || !!b.instagram, lang: input.lang, staged: allRows(data).length > 0, measured: !!input.analytics };
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/**
 * The page with its title, description, accent and its data INLINE, so the
 * folder opens from the disk too (a fetch of data.json fails under file://).
 * Replacements are functions: a brand holding "$&" must stay "$&" (a string
 * replacement would read it as a pattern).
 */
/** Vercel Web Analytics' script, served by Vercel itself under the site's own address. */
export const ANALYTICS_SCRIPT = '<script defer src="/_vercel/insights/script.js"></script>';

export function fillShell(template: string, brand: Brand, lang: Lang, data?: SiteData): string {
  const hex = (c: string | undefined, fallback: string) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback);
  const accent = hex(brand.accent, DEFAULT_ACCENT);
  // "</" closes a script element whatever its type: escaped inside the JSON.
  const inline = data ? JSON.stringify(data).replace(/</g, '\\u003c') : 'null';
  return template
    .replace('__LANG__', () => lang)
    .replace('__TITLE__', () => escapeHtml(brand.tagline ? `${brand.name} · ${brand.tagline}` : brand.name))
    .replace('__DESCRIPTION__', () => escapeHtml(brand.tagline || brand.about.slice(0, 160)))
    .replace('__ACCENT__', () => accent)
    .replace(/__INK__/g, () => hex(brand.ink, DEFAULT_INK))
    .replace(/__PAPER__/g, () => hex(brand.paper, DEFAULT_PAPER))
    .replace('__LOGO_CSS__', () => LOGO_CSS)
    // Vercel's visit counter, only when she turned it on: it sets no cookie, and the privacy page says it is there.
    .replace('</head>', () => (data?.analytics ? `${ANALYTICS_SCRIPT}\n</head>` : '</head>'))
    // The font travels inside the page: the host writes no font file into a site folder.
    .replace('__FONT__', () => `data:font/woff2;base64,${JOST_WOFF2_BASE64}`)
    .replace('__DATA__', () => inline);
}

// ── The export ────────────────────────────────────────────────────────────

export interface ExportDeps {
  /** A picture on disk, as a data URL. */
  readImage: (path: string) => Promise<string>;
  /** A data URL re-encoded as WebP at most `width` wide, as base64. */
  toWebp: (dataUrl: string, width: number, quality?: number, maxBytes?: number) => Promise<string>;
  /** A clip on disk, as a data URL. */
  readMedia: (path: string) => Promise<string>;
  /**
   * A lighter copy of a clip for the web (Tony: « garder les rush full »): the
   * path of an MP4 written beside it, the clip itself untouched. Absent = every
   * clip travels as it is; null or a failure = this one does, and is counted.
   */
  webClip?: (path: string) => Promise<string | null>;
  /** Writes one file into the site folder by relative name. */
  save: (name: string, base64: string) => Promise<void>;
  /** Progress: files written so far, out of the total. */
  onProgress: (done: number, total: number) => void;
  /** Absent = 'standard', the sizes every site had before the choice existed. */
  quality?: ExportQuality;
  /** The most a large picture may weigh, in KB. Absent or null = no limit. */
  imageKb?: ImageKb;
  /** A picture logo's file, written as assets/logo.webp when the data asks for it. */
  logoPath?: string;
  /** The portrait's file, written as assets/portrait.webp when the data asks for it. */
  portraitPath?: string;
  /** Each creation's further photos on disk, in order (the data names their files). */
  creationPhotos?: Record<string, string[]>;
  /** The added text pages' pictures on disk, by their name on the site. */
  pagePhotos?: Array<{ name: string; path: string }>;
  /** The blog's pictures and the photos of the pieces it shows (blogAssets). */
  blogFiles?: Array<{ name: string; path: string }>;
  /** Files written as they are (the site kit's pages and their pictures), before the page that links to them. */
  extraFiles?: Array<{ rel: string; base64: string }>;
}

/**
 * Writes the whole site: every picture of every validated scene in two sizes,
 * the creations' photos, then data.json and index.html LAST, so a folder whose
 * export stopped half way never has a page pointing at missing pictures.
 */
export async function exportSite(data: SiteData, scenes: Scene[], pieces: Piece[], shell: string, deps: ExportDeps, film: ReturnType<typeof filmSources> = null): Promise<ExportSize> {
  const q = EXPORT_QUALITY[deps.quality ?? 'standard'];
  const width = (size: Size) => (size === 'l' ? q.large : SIZES.s);
  const kb = deps.imageKb ?? null;
  const budget = (w: number) => (kb === null ? undefined : Math.round((w === SIZES.s ? kb * 0.4 : kb) * 1000));
  // A loupe grows its copy about 2.5 times: held to the large images' weight it would be blurred
  // exactly where she looks closest, so it gets four times their budget.
  const zoomBudget = (w: number) => { const b = budget(w); return b === undefined ? undefined : b * 4; };
  let imageBytes = 0;
  let clipBytes = 0;
  let otherBytes = 0;
  const jobs: Array<{ name: string; path: string; width: number; layer?: boolean }> = [];
  for (const row of allRows(data)) {
    for (const s of row.scenes) {
      const scene = scenes.find((x) => x.id === s.id)!;
      for (const b of Object.keys(s.images) as Beat[]) {
        for (const size of ['s', 'l'] as Size[]) jobs.push({ name: sceneAsset(s.id, b, size), path: scene.images[b]!, width: width(size) });
      }
      if (s.layers && scene.layers) {
        const files: Array<[string, string, LayerBox]> = LAYER_KEYS.filter((k) => scene.layers![k]).map((k) => [k, scene.layers![k]!.path, scene.layers![k]!]);
        if (scene.layers.swayMap) files.push(['sway', scene.layers.swayMap, scene.layers.potAlive]);
        // The room is a whole picture: written like the scene's pictures, held to the weight she chose.
        if (scene.layers.room) for (const size of ['s', 'l'] as Size[]) jobs.push({ name: sceneLayerAsset(s.id, 'room', size), path: scene.layers.room, width: width(size) });
        for (const [key, path, box] of files) {
          // A layer is sharp, small and transparent: never squeezed to the pictures' weight limit.
          for (const size of ['s', 'l'] as Size[]) jobs.push({ name: sceneLayerAsset(s.id, key, size), path, width: Math.max(8, Math.round((width(size) * box.w) / 100)), layer: true });
        }
      }
    }
  }
  // A picture logo, sharp at any header size; never shrunk to the weight limit.
  if (data.identity?.logoSrc && deps.logoPath) jobs.push({ name: LOGO_ASSET, path: deps.logoPath, width: 800 });
  // The portrait, sharp as the logo: one picture, never shrunk to the weight limit.
  if (data.portrait && deps.portraitPath) jobs.push({ name: PORTRAIT_ASSET, path: deps.portraitPath, width: 800 });
  // An added text page's picture, as large as a page's.
  for (const pg of data.pages ?? []) {
    const f = pg.photo ? deps.pagePhotos?.find((x) => x.name === pg.photo) : undefined;
    if (f) jobs.push({ name: f.name, path: f.path, width: width('l') });
  }
  for (const c of allCreations(data)) {
    if (jobs.some((j) => j.name === c.images[0])) continue;
    jobs.push({ name: c.images[0]!, path: pieces.find((p) => p.id === c.id)!.photoPath!, width: SIZES.s });
    // Its further photos, as many as the data names (a missing path is a hole in the studio, never a broken picture).
    c.images.slice(1).forEach((name, n) => { const path = deps.creationPhotos?.[c.id]?.[n]; if (path) jobs.push({ name, path, width: SIZES.s }); });
    // The loupe's large copies, at the site's large width.
    (c.zoom ?? []).forEach((name, n) => { const path = n === 0 ? pieces.find((p) => p.id === c.id)?.photoPath : deps.creationPhotos?.[c.id]?.[n - 1]; if (path) jobs.push({ name, path, width: width('l') }); });
  }
  // The blog's pictures, large enough for one across the page; a piece already written for the Creations page is not written twice.
  for (const f of deps.blogFiles ?? []) {
    if (!jobs.some((j) => j.name === f.name)) jobs.push({ name: f.name, path: f.path, width: f.name.startsWith('assets/blog-') ? width('l') : SIZES.s });
  }
  const clips = allRows(data).flatMap((r) => r.scenes).filter((s) => s.clip).map((s) => ({ name: s.clip!, path: scenes.find((x) => x.id === s.id)!.clipPath! }));
  // The film goes with the page only when the data says so: never a clip the page does not play.
  if (film && data.film) {
    for (const size of ['s', 'l'] as Size[]) jobs.push({ name: filmPosterAsset(size), path: film.poster, width: width(size) });
    clips.push(...film.clips);
  }

  const extra = deps.extraFiles ?? [];
  const total = jobs.length + clips.length + extra.length + 2;
  let done = 0;
  // One read per picture, all its sizes encoded, then let it go: holding every
  // picture of a big site at once would be hundreds of MB of strings.
  const byPath = new Map<string, typeof jobs>();
  for (const job of jobs) byPath.set(job.path, [...(byPath.get(job.path) ?? []), job]);
  for (const [path, group] of byPath) {
    const dataUrl = await deps.readImage(path);
    for (const job of group) {
      const b64 = job.name === LOGO_ASSET || job.name === PORTRAIT_ASSET || job.layer ? await deps.toWebp(dataUrl, job.width, 0.92) : await deps.toWebp(dataUrl, job.width, q.webp, job.name.endsWith('-z.webp') ? zoomBudget(job.width) : budget(job.width));
      imageBytes += base64Bytes(b64);
      await deps.save(job.name, b64);
      deps.onProgress(++done, total);
    }
  }
  // A clip from the generator is far heavier than the web needs (2.5 Mbit/s): a lighter copy
  // goes on the site when one can be made, the rush stays as it is for a film or a big screen.
  let heavyClips = 0;
  for (const c of clips) {
    let light: string | null = null;
    if (deps.webClip) {
      try {
        const made = await deps.webClip(c.path);
        // The page names an .mp4: a WebM copy (no H.264 encoder) would not be found under it.
        if (made && /\.mp4$/i.test(made)) light = made;
        else heavyClips++;
      } catch (err) {
        console.warn('[vitrine-studio] a clip goes to the site as it is:', c.path, err);
        heavyClips++;
      }
    } else heavyClips++;
    // 🚨 A clip already light (a short one, measured at 379 KB) can come out HEAVIER at the web
    // bitrate (522 KB): the lighter of the two goes on the site, the copy is never assumed smaller.
    const original = await deps.readMedia(c.path);
    const copy = light ? await deps.readMedia(light) : null;
    const dataUrl = copy && copy.length < original.length ? copy : original;
    const b64 = dataUrlPayload(dataUrl);
    clipBytes += base64Bytes(b64);
    await deps.save(c.name, b64);
    deps.onProgress(++done, total);
  }
  for (const f of extra) {
    otherBytes += base64Bytes(f.base64);
    await deps.save(f.rel, f.base64);
    deps.onProgress(++done, total);
  }
  const json = utf8Base64(JSON.stringify(data, null, 2));
  otherBytes += base64Bytes(json);
  await deps.save('data.json', json);
  deps.onProgress(++done, total);
  const page = utf8Base64(shell);
  otherBytes += base64Bytes(page);
  await deps.save('index.html', page);
  deps.onProgress(++done, total);
  return { files: total, bytes: imageBytes + clipBytes + otherBytes, imageBytes, clipBytes, ...(heavyClips ? { heavyClips } : {}) };
}

/** Everything a build of the site reads. */
export type SiteInput = Parameters<typeof buildSiteData>[0];
