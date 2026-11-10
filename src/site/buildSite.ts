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
import { LOADER_CSS, loaderMarkup, type Loader } from './loader';
import type { SiteTranslation } from '../model/translation';
import { layersCurrent, type LayerBox } from '../model/sceneLayers';
import { legalPages, type LegalSite, type SiteLegal } from './legalPages';
import { markdownToHtml, postExcerpt, postImages, postPieces, readingMinutes, sortPosts, type BlogPost } from '../model/blog';
import type { SitePost } from '../data/blogIO';
import { base64Bytes, dataUrlPayload, utf8Base64 } from '../data/bytes';
import type { Lang } from '../model/profiles';
import type { SeoSettings } from '../model/seo';
import type { EffectsSettings } from '../model/effects';
import { activeEffects, EFFECTS } from './effects';
import { paletteOf, themeClasses, themeOf } from './themes';
import { tokensCss } from './themes/contract';
import { STARTING_THEME, type ThemeSettings } from '../model/theme';
import { fillPage, homeImage, seoFiles, type SiteSeo } from './seo';
import type { FilmStep } from '../model/film';
import { filmComplete, type Film } from '../model/filmRecord';

export const ABOUT_LAYOUTS = ['right', 'left', 'top', 'bottom'] as const;
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
  /** The About page's photos after the portrait, in her order; '' = a frame still to fill (never on the site). */
  aboutPhotos?: string[];
  /**
   * The pages of words (About, the blog, Contact…) turn dark for a visitor whose
   * system is dark: her two colours swapped. The scenes stay as they are: they
   * are photographs. Absent = always light.
   */
  dark?: 'auto';
  /** The screen shown while the site loads (site/loader.ts); absent = none. */
  loader?: Loader;
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
  /**
   * `analytics`: whether that publish carried the visit counter (a change since then waits for the next one).
   * `print`: the print of the site it sent (model/publish.ts), absent on a publish from before it existed.
   */
  lastPublish?: { url: string; aliases: string[]; readyState: string; at: string; analytics?: boolean; print?: string };
  /**
   * The last send Vercel refused (ERROR, CANCELED), kept apart: `lastPublish` stays the site
   * that is still online (its address, its print). Cleared by the next send Vercel takes.
   */
  lastRefusal?: { at: string; readyState: string };
  /** Visits counted by Vercel Web Analytics, without cookies (Site › Online); absent = off. */
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
  /**
   * How heavy the site's clips may be (the host's web copy: about 0.9, 1.8 or
   * 3.5 Mbit/s). Absent = light. The export still keeps the lighter of the copy
   * and the clip as made, so « sharp » never sends more than the original.
   */
  videoLevel?: VideoLevel;
  /** The site's second language and her read translations (model/translation.ts); absent = one language. */
  translation?: SiteTranslation;
  /** How the site is found: its addresses, what search engines and AI crawlers may read (model/seo.ts). */
  seo: SeoSettings;
  /** The effects she turned on or off, and the creations some play on (model/effects.ts). */
  effects: EffectsSettings;
  /** The site's theme (model/theme.ts); `{}` = the starting theme with her own colours. */
  theme: ThemeSettings;
}

/** Any weight the person wants (Tony: « si il veut des photos de 800 Ko, c'est son choix »). */
export type ImageKb = number | null;
export const VIDEO_LEVELS = ['light', 'balanced', 'sharp'] as const;
export type VideoLevel = Exclude<(typeof VIDEO_LEVELS)[number], 'light'>;
export const IMAGE_KB_CHOICES: readonly ImageKb[] = [100, 200, 400, 800, null];
export const IMAGE_KB_MIN = 20;
export const IMAGE_KB_MAX = 5000;
/**
 * Bytes written by an export, by kind. `heavyClips`: clips sent as they are
 * because no lighter copy could be made (ffmpeg absent, or it failed); absent = none.
 */
export interface ExportSize {
  files: number; bytes: number; imageBytes: number; clipBytes: number; heavyClips?: number;
  /** Clips made at the light level although a heavier one was chosen: this Mnemosyne is older than the choice. */
  lightOnly?: number;
}

/**
 * The large pictures' width and the WebP quality, per choice. The small size
 * (phones) stays 800 px whatever is chosen: a phone never shows more. A
 * picture is never enlarged by the export, so a large width only helps a
 * picture that is that wide already (see the settings' enlargement).
 *
 * Above « standard », a full-screen picture is written THREE times: 800 px,
 * 1 600 px, and the chosen width as a `-x` copy. The page loads the `-x` one
 * only on a screen that needs it (more than 1 800 real pixels across) with a
 * connection that is not slow: a laptop or a phone never pays for a 27-inch
 * screen, many megabytes for a small share of visitors.
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
/** The About page's further photos on the site, the filled ones in her order. */
export const aboutPhotoAsset = (n: number) => `assets/about-${n + 1}.webp`;
export const ABOUT_PHOTOS_MAX = 3;

/** A project name Vercel accepts, from a brand name: "Atelier Rosalie" → "atelier-rosalie". */
export function slugify(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export type Size = 's' | 'l';
/** Width of each size: the phone one and the computer one. */
export const SIZES: Record<Size, number> = { s: 800, l: 1600 };

/** The sharp copy of a large picture, for big screens: same name, `-x` for `-l`. */
export const sharpAsset = (largeName: string) => largeName.replace(/-l\.webp$/, '-x.webp');

/** The site's data with its sharp copies declared when the quality asks for them; the export writes exactly those. */
export function withSharpCopies(data: SiteData, quality: ExportQuality): SiteData {
  const w = EXPORT_QUALITY[quality].large;
  return w > SIZES.l ? { ...data, xl: w } : data;
}

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
  fr: { menu: 'Menu', close: 'Fermer', formSending: 'Envoi…', formSent: 'Merci, votre message a bien été envoyé.', formMissing: 'Il manque : {f}.', formBadEmail: 'Cette adresse e-mail ne semble pas complète.', formMailApp: 'Votre messagerie s’ouvre avec le message prêt : il reste à l’envoyer.', formFailed: 'Le message n’est pas parti. Réessayez, ou écrivez directement.', formVia: 'Envoyé par Formspree.', creations: 'Créations', about: 'À propos', blog: 'Blog', contact: 'Contact', back: 'Retour aux ambiances', empty: 'Bientôt.', generated: 'Décor généré · pièce réelle', enter: 'Entrer dans l’atelier', hint: 'Faites défiler · ↑ ↓ une pièce · ← → une ambiance', hintScroll: 'Faites défiler', hintRoom: 'une pièce', hintAmbiance: 'une ambiance', hintSwipe: 'Glissez ↑ ↓ une pièce · ← → une ambiance', allPosts: 'Tous les articles', allCats: 'Tout', readTime: '{n} min de lecture', formName: 'Nom', formEmail: 'E-mail', formMessage: 'Message', formSend: 'Envoyer', formSubject: 'Message du site', place: 'Le lieu', piece: 'La pièce', alive: 'Le vivant' },
  en: { menu: 'Menu', close: 'Close', formSending: 'Sending…', formSent: 'Thank you, your message has been sent.', formMissing: 'Missing: {f}.', formBadEmail: 'This e-mail address does not look complete.', formMailApp: 'Your mail app opens with the message ready: it only needs sending.', formFailed: 'The message did not go. Try again, or write directly.', formVia: 'Sent through Formspree.', creations: 'Creations', about: 'About', blog: 'Blog', contact: 'Contact', back: 'Back to the ambiances', empty: 'Coming soon.', generated: 'Generated setting · real piece', enter: 'Enter the workshop', hint: 'Scroll · ↑ ↓ a room · ← → an ambiance', hintScroll: 'Scroll', hintRoom: 'a room', hintAmbiance: 'an ambiance', hintSwipe: 'Swipe ↑ ↓ a room · ← → an ambiance', allPosts: 'All posts', allCats: 'All', readTime: '{n} min read', formName: 'Name', formEmail: 'Email', formMessage: 'Message', formSend: 'Send', formSubject: 'Message from the website', place: 'The place', piece: 'The piece', alive: 'The living' },
  es: { menu: 'Menú', close: 'Cerrar', formSending: 'Enviando…', formSent: 'Gracias, tu mensaje se ha enviado.', formMissing: 'Falta: {f}.', formBadEmail: 'Esta dirección de correo no parece completa.', formMailApp: 'Tu correo se abre con el mensaje listo: solo falta enviarlo.', formFailed: 'El mensaje no salió. Inténtalo de nuevo o escribe directamente.', formVia: 'Enviado por Formspree.', creations: 'Creaciones', about: 'Sobre mí', blog: 'Blog', contact: 'Contacto', back: 'Volver a los ambientes', empty: 'Muy pronto.', generated: 'Decorado generado · pieza real', enter: 'Entrar al taller', hint: 'Desplázate · ↑ ↓ una estancia · ← → un ambiente', hintScroll: 'Desplázate', hintRoom: 'una estancia', hintAmbiance: 'un ambiente', hintSwipe: 'Desliza ↑ ↓ una estancia · ← → un ambiente', allPosts: 'Todos los artículos', allCats: 'Todo', readTime: '{n} min de lectura', formName: 'Nombre', formEmail: 'Correo', formMessage: 'Mensaje', formSend: 'Enviar', formSubject: 'Mensaje del sitio', place: 'El lugar', piece: 'La pieza', alive: 'Lo vivo' },
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
  creations: Array<{ id: string; alt: string; zoom?: string[]; cats?: string[]; name?: string; description?: string; dimensions?: string; weight?: string; specs?: Array<[string, string]>; price?: string; priceAlso?: string[]; images: string[];
    /** The price as a number and its currency, for structured data; only with a price she shows. */
    amount?: [number, string];
    /** A sold piece: said on its page and in its structured data. */
    sold?: true;
    /** A piece she marked for sale: the only case its structured data says « in stock ». */
    available?: true;
    /** The clip of one of its scenes, already on the site: played over its photo by the effect that asked for it. */
    clip?: string }>;
  /** Sold pieces whose page stays online, marked sold (model/seo.ts); never in a gallery. */
  sold?: SiteData['creations'];
  /** The site's addresses and what its head says (site/seo.ts); absent on a preview. */
  seo?: SiteSeo;
  /**
   * The effects she turned on that the page cannot read from another setting, by id: `true` for the
   * whole site, or the creations each plays on. Absent when she turned none on (a site of before).
   */
  effects?: Record<string, true | string[]>;
  /** The theme she chose (src/site/themes) and whose colours paint the site. Absent = the starting theme, her colours. */
  theme?: ThemeSettings;
  /** What a creation does under the pointer. */
  creationsHover?: CreationsHover;
  /** The blog, newest first: its HTML made at export from the post's Markdown. Absent when no post is online. */
  posts?: Array<{ id: string; title: string; when?: string; date?: string; html: string; excerpt: string; minutes: number; cover?: string }>;
  /** The width of the sharp `-x` copies of the full-screen pictures (withSharpCopies); absent = none written. */
  xl?: number;
  /** The home film: its first picture while it loads, then its clips in order. Absent unless validated and complete. */
  film?: { poster: { s: string; l: string }; clips: string[]; cuts?: Array<{ in: number; out: number } | null> };
  /** The header's logo and name, and the tab icon (site/logo.ts). Absent = the name alone. */
  identity?: SiteIdentity;
  /** The About page's further photos on the site (aboutPhotoAsset), the filled ones only. */
  aboutPhotos?: string[];
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
  /** The same site in its second language, her read translations in place (model/translation.ts). */
  alt?: { lang: Lang; data: SiteData };
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
export function siteRows(scenes: Scene[], pieces: Piece[], untitled: string, order: readonly string[] = [], stillLife = false): SiteData['rows'] {
  const rows: SiteData['rows'] = [];
  const shown = inPieceOrder(onlineScenes(scenes, pieces), order);
  for (const s of shown) {
    const name = s.universe.trim() || untitled;
    let row = rows.find((r) => r.name === name);
    if (!row) rows.push((row = { name, scenes: [] }));
    const images: SiteData['rows'][number]['scenes'][number]['images'] = {};
    // The living scenes turned off for the whole site (Design › Effects) show their three pictures.
    const living = !stillLife && livingOnSite(s);
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

export function buildSiteData(input: { brand: Brand; lang: Lang; scenes: Scene[]; pieces: Piece[]; posts?: SitePost[]; today: string; untitled: string; film?: ReturnType<typeof filmSources>; identity?: Identity; links?: Array<{ title: string; href: string }>; beats?: Record<Beat, string>; showcase?: Record<string, PieceShow>; hover?: CreationsHover; currency?: CurrencySettings; menu?: MenuNames; menuOrder?: MenuKey[]; pieceOrder?: string[]; sceneOrder?: string[]; categories?: Category[]; sceneMap?: SceneMap; pages?: SitePage[]; viewer?: ViewerSettings; legal?: Legal; analytics?: boolean; seo?: SeoSettings; effects?: EffectsSettings; theme?: ThemeSettings }): SiteData {
  const loupe = !!input.viewer && input.viewer.loupe !== 'none';
  // The loupe on some creations only, when it is not on for the whole site.
  const loupeOnly = new Set(loupe ? [] : input.effects?.only?.loupe ?? []);
  const stillLife = input.effects?.state?.living === 'off';
  const pages = input.pages ?? [];
  // The rooms of some scenes, with the words over each, read from its piece's record at build time.
  const sceneRows = (list: Scene[]) => {
    const rows = siteRows(list, input.pieces, input.untitled, input.sceneOrder, stillLife);
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
    .map((p) => creationOf(p));
  const creationOf = (p: Piece) => {
      // Only what the artisan chose to show; the name always names the picture.
      const sh = input.showcase?.[p.id] ?? defaultShow();
      const extra = sh.show.photos ? sh.photos.map((_, n) => creationPhotoAsset(p.id, n)) : [];
      return {
        id: p.id, alt: p.name,
        ...(p.status === 'sold' ? { sold: true as const } : p.status === 'available' ? { available: true as const } : {}),
        ...(sh.show.name ? { name: p.name } : {}),
        ...(sh.show.description && p.description ? { description: p.description } : {}),
        // The three measures when set, else what was written freely before them.
        ...(sh.show.dimensions && (formatSize(sh.size, input.lang) ?? sh.dimensions) ? { dimensions: (formatSize(sh.size, input.lang) ?? sh.dimensions)! } : {}),
        ...(sh.show.weight && sh.weight !== undefined ? { weight: formatMass(sh.weight, input.lang) } : {}),
        // The same measures as a table in the viewer, one row each.
        ...(measureRows(sh.size, sh.weight, input.lang, SPEC_LABELS[input.lang], sh.show).length ? { specs: measureRows(sh.size, sh.weight, input.lang, SPEC_LABELS[input.lang], sh.show) } : {}),
        ...(sh.show.price && p.price !== undefined ? { price: formatMoney(p.price, input.lang, cur.main), amount: [p.price, cur.main] as [number, string] } : {}),
        // Other currencies only with a rate the person fetched or typed, always marked approximate.
        ...(sh.show.price && p.price !== undefined && approximations(p.price, input.lang, cur).length ? { priceAlso: approximations(p.price, input.lang, cur) } : {}),
        // Its categories that still exist: the page's filters.
        ...((sh.cats ?? []).filter((id) => (input.categories ?? []).some((c) => c.id === id)).length ? { cats: (sh.cats ?? []).filter((id) => (input.categories ?? []).some((c) => c.id === id)) } : {}),
        images: [creationAsset(p.id), ...extra],
        // A loupe reads a large copy of each picture.
        ...(loupe || loupeOnly.has(p.id) ? { zoom: [creationZoomAsset(p.id, 0), ...extra.map((_, n) => creationZoomAsset(p.id, n + 1))] } : {}),
      };
  };
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
    return { id: p.id, title: p.title, ...(p.date ? { when: postWhen(p.date, input.lang), date: p.date } : {}), html, excerpt: postExcerpt(p.text), minutes: readingMinutes(p.text), ...(cover ? { cover } : {}) };
  });
  const posts = postsOf(onPage(input.posts ?? [], null, pages));
  // The portrait's path is the person's disk: online it is the site's own file, never the path.
  const { portrait, aboutPhotos, ...brand } = input.brand;
  // The three beats are named by the trade (a lamp's third beat is its light, not the living).
  // The menu as she named it: the same words name each page's title.
  const texts = { ...TEXTS[input.lang], ...(input.beats ? { place: input.beats.place, piece: input.beats.piece, alive: input.beats.alive } : {}), ...normalizeMenu(input.menu) };
  const data: SiteData = { brand, texts, rows, creations };
  if (posts.length) data.posts = posts;
  if (input.hover && input.hover !== 'none') data.creationsHover = input.hover;
  if (portrait) data.portrait = PORTRAIT_ASSET;
  const filled = (aboutPhotos ?? []).filter(Boolean);
  if (filled.length) data.aboutPhotos = filled.map((_, i) => aboutPhotoAsset(i));
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
  if (input.sceneMap && (input.sceneMap.style !== 'dots' || input.sceneMap.color || input.sceneMap.guide || input.sceneMap.edges || input.sceneMap.credit || input.sceneMap.titles)) data.sceneMap = input.sceneMap;
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
  if (input.viewer && (input.viewer.loupe !== 'none' || input.viewer.frame !== 'none' || input.viewer.layout || input.viewer.parallax)) data.viewer = input.viewer;
  // Her words with their formatting; every character escaped but the studio's own tags.
  if (input.brand.about?.trim()) data.aboutHtml = markdownToHtml(input.brand.about, { keepTitle: true });
  const socials = socialLinks(input.brand.socials ?? normalizeSocials(undefined, input.brand.instagram ?? ''));
  if (socials.length) data.socials = socials;
  if (input.brand.contactNote?.trim()) data.contactHtml = markdownToHtml(input.brand.contactNote, { keepTitle: true });
  if (input.analytics) data.analytics = true;
  // A sold piece leaves the galleries; the page it had stays, marked sold, unless she chose otherwise.
  // « It had a page » is read from its kept slug: a piece sold before it was ever online gets none.
  const seo = input.seo;
  if (seo && seo.sold !== 'drop' && seo.addresses !== 'single' && seo.creationPages !== 'none') {
    // One she keeps in a gallery although sold is already on the site: never twice.
    const shown = new Set(allCreations(data).map((c) => c.id));
    const sold = input.pieces.filter((p) => p.status === 'sold' && p.photoPath && seo.slugs?.[`c:${p.id}`] && !shown.has(p.id)).map((p) => creationOf(p));
    if (sold.length) data.sold = sold;
  }
  // The effects she turned on: for the whole site, or on the creations of her list that the site shows.
  // An effect she never touched writes nothing here: a site of before keeps its data as it was.
  const plays: NonNullable<SiteData['effects']> = {};
  for (const [id, state] of Object.entries(input.effects?.state ?? {})) if (state === 'on') plays[id] = true;
  const onSite = new Set([...allCreations(data), ...(data.sold ?? [])].map((c) => c.id));
  for (const [id, ids] of Object.entries(input.effects?.only ?? {})) {
    if (plays[id] === true || (id === 'loupe' && loupe)) continue;
    const some = ids.filter((x) => onSite.has(x));
    if (some.length) plays[id] = some;
  }
  if (Object.keys(plays).length) data.effects = plays;
  // The theme she chose; the starting one with her own colours writes nothing (a site of before keeps its data).
  const theme: ThemeSettings = { ...(input.theme?.id && input.theme.id !== STARTING_THEME ? { id: input.theme.id } : {}), ...(input.theme?.colours === 'theme' ? { colours: 'theme' as const } : {}) };
  if (Object.keys(theme).length) data.theme = theme;
  // What an effect that is on needs in the data, beside its switch.
  for (const e of EFFECTS) if (e.prepare && e.on(data)) e.prepare(data, { scenes: input.scenes });
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

export function fillShell(template: string, brand: Brand, lang: Lang, data?: SiteData, made: { share?: string; icon?: string } = {}): string {
  const hex = (c: string | undefined, fallback: string) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback);
  // The theme's tokens on the one template; her colours, unless she asked for the theme's own.
  const theme = themeOf(data?.theme?.id);
  const palette = paletteOf(data?.theme, brand);
  const classes = themeClasses(theme);
  const accent = hex(palette.accent, DEFAULT_ACCENT);
  // "</" closes a script element whatever its type: escaped inside the JSON.
  const inline = data ? JSON.stringify(data).replace(/</g, '\\u003c') : 'null';
  // A data with no rooms' list is not a site's (a stub): it carries no effect.
  const fx = data && Array.isArray(data.rows) ? activeEffects(data) : [];
  const shell = template
    .replace('__LANG__', () => lang)
    .replace('__TITLE__', () => escapeHtml(brand.tagline ? `${brand.name} · ${brand.tagline}` : brand.name))
    .replace('__DESCRIPTION__', () => escapeHtml(brand.tagline || brand.about.slice(0, 160)))
    .replace('__THEME_CLASS__', () => (classes ? ` class="${classes}"` : ''))
    // The font file travels only with a theme that reads it (before `__FONT__` below, which this rule names).
    .replace('__FONT_FACE__', () => (theme.font === 'jost' ? '  @font-face { font-family: Jost; src: url("__FONT__") format("woff2"); font-weight: 300 500; font-style: normal; font-display: swap; }\n' : ''))
    .replace('__TOKENS__', () => tokensCss(theme.tokens))
    .replace('__ACCENT__', () => accent)
    .replace(/__INK__/g, () => hex(palette.ink, DEFAULT_INK))
    .replace(/__PAPER__/g, () => hex(palette.paper, DEFAULT_PAPER))
    .replace('__LOGO_CSS__', () => LOGO_CSS)
    .replace('__LOADER_CSS__', () => LOADER_CSS)
    // Only the effects the site has on: each one's CSS and script, in the catalogue's order. A shell
    // without its data carries none.
    .replace('/*__EFFECTS_CSS__*/', () => fx.map((e) => `/* ${e.id} */\n${e.css}`).join('\n'))
    .replace('/*__EFFECTS_JS__*/', () => fx.map((e) => e.js).join('\n'))
    // The loading screen is in the HTML itself: on the first paint, before any script runs.
    .replace('<body>', () => (brand.loader ? `<body>\n${loaderMarkup(brand.loader, brand.name)}` : '<body>'))
    // Vercel's visit counter, only when she turned it on: it sets no cookie, and the privacy page says it is there.
    .replace('</head>', () => (data?.analytics ? `${ANALYTICS_SCRIPT}\n</head>` : '</head>'))
    // The font travels inside the page: the host writes no font file into a site folder.
    .replace('__FONT__', () => `data:font/woff2;base64,${JOST_WOFF2_BASE64}`)
    .replace('__DATA__', () => inline);
  // The home's own head and words, when the site has its addresses (a preview has none).
  return homePage(shell, data, lang, made);
}

/** The home page's head and words in a filled shell; the shell as it is when the site has no addresses. */
function homePage(shell: string, data: SiteData | undefined, lang: Lang | undefined, made: { share?: string; icon?: string }): string {
  const home = data?.seo?.pages.find((p) => p.id === '');
  return home && lang ? fillPage(shell, { site: data!, d: data!, lang, mainLang: lang, ...made }, home) : shell;
}

/**
 * The two pictures the head names and the export writes: the shared link's
 * (a JPEG, read by every network) and the tab icon as a file a crawler can
 * fetch. Each only when the site has what it is made from.
 */
export const SHARE_ASSET = 'assets/share.jpg';
export const ICON_ASSET = 'favicon.png';
export function seoPictures(data: SiteData): { share?: string; icon?: string } {
  if (!data.seo) return {};
  return { ...(homeImage(data) ? { share: SHARE_ASSET } : {}), ...(data.identity?.favicon ? { icon: ICON_ASSET } : {}) };
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
  /** The About page's filled photos on disk, in the order of `data.aboutPhotos`. */
  aboutPhotoPaths?: string[];
  /** Each creation's further photos on disk, in order (the data names their files). */
  creationPhotos?: Record<string, string[]>;
  /** The added text pages' pictures on disk, by their name on the site. */
  pagePhotos?: Array<{ name: string; path: string }>;
  /** The blog's pictures and the photos of the pieces it shows (blogAssets). */
  blogFiles?: Array<{ name: string; path: string }>;
  /** Files written as they are (the site kit's pages and their pictures), before the page that links to them. */
  extraFiles?: Array<{ rel: string; base64: string }>;
  /** A picture as the JPEG of a shared link (1200 x 630, cropped to fill), as base64. Absent = none is written. */
  toShare?: (dataUrl: string) => Promise<string>;
  /** A picture or an SVG (a data URL) as a square PNG icon, as base64. Absent = none is written. */
  toIcon?: (dataUrl: string) => Promise<string>;
  /** The site's main language: the documents of its addresses are written in it. Absent = none is written. */
  lang?: Lang;
  /** Every address an earlier send wrote (model/seo.ts `written`): one gone since is written over. */
  writtenPaths?: readonly string[];
}

/**
 * Writes the whole site: every picture of every validated scene in two sizes,
 * the creations' photos, then data.json and index.html LAST, so a folder whose
 * export stopped half way never has a page pointing at missing pictures.
 */
export async function exportSite(data: SiteData, scenes: Scene[], pieces: Piece[], shell: string, deps: ExportDeps, film: ReturnType<typeof filmSources> = null): Promise<ExportSize> {
  const q = EXPORT_QUALITY[deps.quality ?? 'standard'];
  // The large size is the light one; what the quality adds goes to the sharp copies, for big screens only.
  const width = (size: Size) => (size === 'l' ? (data.xl ? SIZES.l : q.large) : SIZES.s);
  const kb = deps.imageKb ?? null;
  const budget = (w: number) => (kb === null ? undefined : Math.round((w === SIZES.s ? kb * 0.4 : kb) * 1000));
  // A loupe grows its copy about 2.5 times: held to the large images' weight it would be blurred
  // exactly where she looks closest, so it gets four times their budget.
  const zoomBudget = (w: number) => { const b = budget(w); return b === undefined ? undefined : b * 4; };
  // A sharp copy held to the large one's weight would be no sharper: its budget grows with its pixels, four times at most.
  const sharpBudget = (w: number) => { const b = budget(w); return b === undefined ? undefined : Math.round(b * Math.min(4, (w / SIZES.l) ** 2)); };
  let imageBytes = 0;
  let clipBytes = 0;
  let otherBytes = 0;
  const jobs: Array<{ name: string; path: string; width: number; layer?: boolean; sharp?: boolean }> = [];
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
  (data.aboutPhotos ?? []).forEach((name, i) => { const path = deps.aboutPhotoPaths?.[i]; if (path) jobs.push({ name, path, width: SIZES.l }); });
  // An added text page's picture, as large as a page's.
  for (const pg of data.pages ?? []) {
    const f = pg.photo ? deps.pagePhotos?.find((x) => x.name === pg.photo) : undefined;
    if (f) jobs.push({ name: f.name, path: f.path, width: width('l') });
  }
  for (const c of [...allCreations(data), ...(data.sold ?? [])]) {
    if (jobs.some((j) => j.name === c.images[0])) continue;
    // The strip shows one photo across the page: 800 px would be blurred there.
    const cw = data.viewer?.layout === 'strip' ? SIZES.l : SIZES.s;
    jobs.push({ name: c.images[0]!, path: pieces.find((p) => p.id === c.id)!.photoPath!, width: cw });
    // Its further photos, as many as the data names (a missing path is a hole in the studio, never a broken picture).
    c.images.slice(1).forEach((name, n) => { const path = deps.creationPhotos?.[c.id]?.[n]; if (path) jobs.push({ name, path, width: cw }); });
    // The loupe's large copies, at the site's large width.
    (c.zoom ?? []).forEach((name, n) => { const path = n === 0 ? pieces.find((p) => p.id === c.id)?.photoPath : deps.creationPhotos?.[c.id]?.[n - 1]; if (path) jobs.push({ name, path, width: q.large }); });
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

  // Every full-screen large picture (a scene's, a living room's and its layers, the film's poster) gets its sharp copy.
  const xl = data.xl;
  if (xl) {
    for (const j of [...jobs]) {
      if (/-l\.webp$/.test(j.name) && (j.name === filmPosterAsset('l') || /-(place|piece|alive)-l\.webp$|-layer-[^/]+-l\.webp$/.test(j.name))) {
        jobs.push({ ...j, name: sharpAsset(j.name), width: Math.round((j.width * xl) / SIZES.l), sharp: true });
      }
    }
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
      const b64 = job.name === LOGO_ASSET || job.name === PORTRAIT_ASSET || job.layer ? await deps.toWebp(dataUrl, job.width, 0.92) : await deps.toWebp(dataUrl, job.width, q.webp, job.name.endsWith('-z.webp') ? zoomBudget(job.width) : job.sharp ? sharpBudget(job.width) : budget(job.width));
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
  // The head's two pictures, each from a file the site already reads. One that cannot be made is
  // left out and no document names it: a head never points at a missing picture.
  const pictures: { share?: string; icon?: string } = {};
  const wanted = seoPictures(data);
  let seoCount = 0;
  if (wanted.share && deps.toShare) {
    const from = jobs.find((j) => j.name === homeImage(data))?.path;
    if (from) {
      try {
        const b64 = await deps.toShare(await deps.readImage(from));
        imageBytes += base64Bytes(b64);
        await deps.save(SHARE_ASSET, b64);
        pictures.share = SHARE_ASSET;
        seoCount++;
      } catch (err) {
        // The site goes without it: a shared link then shows the page's own picture.
        console.warn('[vitrine-studio] the shared-link picture was not made:', err);
      }
    }
  }
  if (wanted.icon && deps.toIcon) {
    const fav = data.identity!.favicon!;
    const src = fav.startsWith('data:') ? fav : deps.logoPath ? await deps.readImage(deps.logoPath) : null;
    if (src) {
      try {
        const b64 = await deps.toIcon(src);
        imageBytes += base64Bytes(b64);
        await deps.save(ICON_ASSET, b64);
        pictures.icon = ICON_ASSET;
        seoCount++;
      } catch (err) {
        // The tab icon stays the one the page's script sets; only the file for crawlers is missing.
        console.warn('[vitrine-studio] the icon file was not made:', err);
      }
    }
  }
  // One document per address, the sitemap, robots.txt and the 404: after every picture, before the home page.
  const home = homePage(shell, data, deps.lang, pictures);
  for (const f of data.seo && deps.lang ? seoFiles(home, data, deps.lang, pictures, deps.writtenPaths ?? []) : []) {
    const b64 = utf8Base64(f.text);
    otherBytes += base64Bytes(b64);
    await deps.save(f.rel, b64);
    seoCount++;
  }
  const json = utf8Base64(JSON.stringify(data, null, 2));
  otherBytes += base64Bytes(json);
  await deps.save('data.json', json);
  deps.onProgress(++done, total);
  const page = utf8Base64(home);
  otherBytes += base64Bytes(page);
  await deps.save('index.html', page);
  deps.onProgress(++done, total);
  return { files: total + seoCount, bytes: imageBytes + clipBytes + otherBytes, imageBytes, clipBytes, ...(heavyClips ? { heavyClips } : {}) };
}

/** Everything a build of the site reads. */
export type SiteInput = Parameters<typeof buildSiteData>[0];
