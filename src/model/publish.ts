import { allCreations, buildSiteData, onlineScenes, type SiteInput, type SiteSettings } from '../site/buildSite';
import type { Piece, Scene } from './types';

/** What the last publish left: Vercel's own answer, and the print of the site it sent. */
export type LastPublish = NonNullable<SiteSettings['lastPublish']>;

/**
 * Where the site stands, the one word the site bar shows (doc 145 §10.20).
 * - `unconnected`: the folder, the token or the address is missing; nothing can be sent.
 * - `incomplete`: connected, but the site has nothing to show yet (no scene online, no name).
 * - `never`: ready, never sent.
 * - `pending`: sent, and Vercel had not said READY when the host stopped waiting: not confirmed, never assumed online.
 * - `failed`: Vercel said the last one failed (ERROR, CANCELED).
 * - `current`: online, and what is online is what the studio holds now.
 * - `behind`: online, and the studio changed since.
 * - `unknown`: online, sent before the studio kept a print: whether it changed is not known.
 */
export type PublishStage = 'unconnected' | 'incomplete' | 'never' | 'pending' | 'failed' | 'current' | 'behind' | 'unknown';

export function publishStage(s: { connected: boolean; missing: readonly string[]; live?: LastPublish; printNow: string }): PublishStage {
  if (!s.connected) return 'unconnected';
  if (s.missing.length > 0) return 'incomplete';
  if (!s.live) return 'never';
  if (s.live.readyState === 'ERROR' || s.live.readyState === 'CANCELED') return 'failed';
  if (s.live.readyState !== 'READY') return 'pending';
  // A publish from before the print existed: never read as up to date, never as behind.
  if (!s.live.print) return 'unknown';
  return s.live.print === s.printNow ? 'current' : 'behind';
}

/**
 * The one address of the site online, the same on every screen. A domain of her
 * own once Vercel says it points there; else the project's `<name>.vercel.app`
 * when Vercel gave it; else the shortest `.vercel.app` alias Vercel gave (a name
 * already taken gets a longer one); else the deployment's own address. Never
 * made up: `<name>.vercel.app` built from the name alone may be someone else's
 * site, and a site never sent has no address.
 */
export function siteLink(live: LastPublish | undefined, projectName: string, liveDomains: readonly string[] = []): string | null {
  if (!live) return null;
  if (liveDomains[0]) return `https://${liveDomains[0]}`;
  const own = projectName ? `https://${projectName}.vercel.app` : '';
  if (own && live.aliases.includes(own)) return own;
  const vercel = live.aliases.filter((a) => a.endsWith('.vercel.app')).sort((a, b) => a.length - b.length)[0];
  return vercel ?? live.aliases[0] ?? (live.url || null);
}

/** An address as it reads in a sentence: no scheme, no trailing slash. */
export function bareAddress(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** What every build of the site reads from her site settings; each caller adds the language and the records. */
export function siteFields(site: SiteSettings) {
  return {
    brand: site.brand, identity: site.identity, showcase: site.showcase, hover: site.creationsHover, currency: site.currency, menu: site.menu,
    menuOrder: site.menuOrder, pieceOrder: site.pieceOrder, sceneOrder: site.sceneOrder, categories: site.categories, sceneMap: site.sceneMap,
    pages: site.pages, viewer: site.viewer, legal: site.legal, analytics: !!site.analytics,
  } satisfies Partial<SiteInput>;
}

/** JSON with its keys sorted at every level: the same value always gives the same text. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** cyrb53: a 53-bit hash of a text, as 14 hex digits. Not a secret, only "same or not". */
function hash53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/**
 * The print of the site the studio would send now: the page's own data, and
 * what the export reads beside it (the pictures behind each name, their size
 * and weight, the logo, the portrait, the film, the kit). Kept with a publish,
 * compared after: a different print is a site that changed since.
 *
 * What it cannot see: a blog post's words, written in Notes and read only when
 * the site is built. A post rewritten there leaves the print as it was; the
 * bar's « Republish » stays for that.
 */
export function sitePrint(input: Omit<SiteInput, 'today' | 'posts'>, site: Pick<SiteSettings, 'quality' | 'imageKb' | 'identity' | 'brand' | 'posts' | 'kit' | 'showcase'>, records: { scenes: Scene[]; pieces: Piece[] }): string {
  // buildSiteData does not read the date today (no test can see it); emptied so a later use of it
  // cannot make every print change at midnight and the bar cry « changes » for nothing.
  const data = buildSiteData({ ...input, today: '', posts: [] });
  // Only the pieces the site shows: a sold or hidden piece edited is not a change of the site.
  const shown = new Set(allCreations(data).map((c) => c.id));
  return hash53(stableJson({
    data,
    quality: site.quality,
    imageKb: site.imageKb,
    logo: site.identity.logoPath ?? null,
    portrait: site.brand.portrait ?? null,
    posts: site.posts,
    kit: site.kit ?? null,
    photos: Object.fromEntries(Object.entries(site.showcase).map(([id, s]) => [id, s.photos])),
    // A picture remade under the same name changes the record's date, not the page.
    scenes: onlineScenes(records.scenes, records.pieces).map((s) => [s.id, s.updatedAt ?? null]),
    pieces: records.pieces.filter((p) => shown.has(p.id)).map((p) => [p.id, p.photoPath ?? null, p.updatedAt ?? null]),
  }));
}
