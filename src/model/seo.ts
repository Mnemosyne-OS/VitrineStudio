/**
 * How the site is found (doc 145 §10.24): every choice is the person's, each
 * with a starting value. Stored sparse: a field she never touched is ABSENT,
 * so a site from before these settings reads as `{}` and keeps every starting
 * value, and its print does not move.
 */
import type { Lang } from './profiles';

/** The menu pages whose address word she may change. */
export const ADDRESS_WORDS = ['creations', 'about', 'blog', 'contact'] as const;
export type AddressWord = (typeof ADDRESS_WORDS)[number];

export interface SeoSettings {
  /** One address per page, creation and post. `single` = the one page of before. Absent = real pages. */
  addresses?: 'single';
  /** Search engines. `closed` = every page says noindex (a site not ready). Absent = open. */
  engines?: 'closed';
  /** The AI crawlers named in robots.txt. `closed` = each one refused. Absent = open. */
  aiBots?: 'closed';
  /** A sold piece that had its page. `drop` = the page goes. Absent = it stays, marked sold. */
  sold?: 'drop';
  /** Which creations get their own page. Absent = all. */
  creationPages?: 'described' | 'none';
  /** Structured data, by kind. Only `false` is stored. */
  structured?: { business?: false; products?: false; articles?: false };
  /** The legal pages in the sitemap. Absent = left out. */
  legalInSitemap?: true;
  /**
   * A visitor who chose the second language before, or whose browser speaks it, is sent to it,
   * as the site always did. `address` = the address alone decides. Absent = sent.
   */
  visitorLanguage?: 'address';
  /** Her own word in the address of a menu page (main language). Absent = the language's word. */
  words?: Partial<Record<AddressWord, string>>;
  /** The address word of each creation (`c:<id>`), post (`blog-<id>`) and added page (its id): kept once sent, or hers. */
  slugs?: Record<string, string>;
  /** Addresses that moved: the old path and the page id it belonged to. */
  redirects?: Array<{ from: string; id: string }>;
  /** Her own title and description, by page id ('' = the home). */
  meta?: Record<string, { title?: string; description?: string }>;
  /** Google Search Console's verification code (the content of its meta tag). */
  verification?: string;
  /** Every address a send ever wrote: one the site no longer has is written over, never left as a stale page. */
  written?: string[];
  /** The site's one address, as last read from the host, or hers when `originOwn`. */
  origin?: string;
  /** She wrote the address herself: the host's reading no longer replaces it. */
  originOwn?: true;
}

export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 200;
export const SEO_SLUG_MAX = 60;
const REDIRECTS_MAX = 200;
const WRITTEN_MAX = 1000;

/**
 * Folder names the host refuses at the root of a site folder (its RECORD_FOLDERS, main/site/vercelDeploy.ts:
 * a folder that holds one is taken for a work folder and the whole send is refused). An address never
 * starts with one of them.
 */
export const RESERVED_FOLDERS = ['clients', 'deals', 'journal', 'products', 'scenes', 'markets', 'studio'] as const;

/** The addresses a site has written, old and new, each once. */
export function writtenPaths(before: readonly string[] | undefined, now: readonly string[]): string[] {
  return [...new Set([...(before ?? []), ...now])].slice(-WRITTEN_MAX);
}

/** A word of an address: lowercase letters, digits and dashes. '' when nothing is left. */
export function slugOf(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, SEO_SLUG_MAX).replace(/-+$/, '');
}

/** An address read back: https (or http) and a host, no path, no query. Null when it is not one. */
export function originOf(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return `${u.protocol}//${u.host}`;
  } catch (err) {
    // Not an address: the caller says so on screen, nothing is kept.
    console.debug('[vitrine-studio] not a site address:', s, err);
    return null;
  }
}

/** Google's verification code: what its meta tag carries, or the whole tag pasted. '' when it is neither. */
export function verificationOf(raw: string): string {
  const s = raw.trim();
  const tag = /content\s*=\s*["']([^"']+)["']/i.exec(s);
  const code = tag ? tag[1]! : s;
  return /^[A-Za-z0-9_-]{10,100}$/.test(code) ? code : '';
}

export function normalizeSeo(raw: unknown): SeoSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: SeoSettings = {};
  if (r.addresses === 'single') out.addresses = 'single';
  if (r.engines === 'closed') out.engines = 'closed';
  if (r.aiBots === 'closed') out.aiBots = 'closed';
  if (r.sold === 'drop') out.sold = 'drop';
  if (r.creationPages === 'described' || r.creationPages === 'none') out.creationPages = r.creationPages;
  if (r.structured && typeof r.structured === 'object') {
    const s = r.structured as Record<string, unknown>;
    const st: NonNullable<SeoSettings['structured']> = {};
    if (s.business === false) st.business = false;
    if (s.products === false) st.products = false;
    if (s.articles === false) st.articles = false;
    if (Object.keys(st).length) out.structured = st;
  }
  if (r.legalInSitemap === true) out.legalInSitemap = true;
  if (r.visitorLanguage === 'address') out.visitorLanguage = 'address';
  if (r.words && typeof r.words === 'object') {
    const w: NonNullable<SeoSettings['words']> = {};
    for (const k of ADDRESS_WORDS) { const v = (r.words as Record<string, unknown>)[k]; if (typeof v === 'string' && slugOf(v)) w[k] = slugOf(v); }
    if (Object.keys(w).length) out.words = w;
  }
  if (r.slugs && typeof r.slugs === 'object') {
    const s: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.slugs as Record<string, unknown>)) if (typeof v === 'string' && slugOf(v) && k.length <= 120) s[k] = slugOf(v);
    if (Object.keys(s).length) out.slugs = s;
  }
  if (Array.isArray(r.redirects)) {
    const list = r.redirects.flatMap((x): Array<{ from: string; id: string }> => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      return typeof o.from === 'string' && /^[a-z0-9/-]{1,200}$/.test(o.from) && typeof o.id === 'string' && o.id.length <= 120 ? [{ from: o.from, id: o.id }] : [];
    }).slice(-REDIRECTS_MAX);
    if (list.length) out.redirects = list;
  }
  if (r.meta && typeof r.meta === 'object') {
    const m: NonNullable<SeoSettings['meta']> = {};
    for (const [k, v] of Object.entries(r.meta as Record<string, unknown>)) {
      const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
      const title = typeof o.title === 'string' ? o.title.replace(/\s+/g, ' ').trim().slice(0, SEO_TITLE_MAX) : '';
      const description = typeof o.description === 'string' ? o.description.replace(/\s+/g, ' ').trim().slice(0, SEO_DESCRIPTION_MAX) : '';
      if ((title || description) && k.length <= 120) m[k] = { ...(title ? { title } : {}), ...(description ? { description } : {}) };
    }
    if (Object.keys(m).length) out.meta = m;
  }
  if (Array.isArray(r.written)) {
    const w = [...new Set(r.written.filter((x): x is string => typeof x === 'string' && /^[a-z0-9/-]{1,200}\/$/.test(x)))].slice(-WRITTEN_MAX);
    if (w.length) out.written = w;
  }
  if (typeof r.verification === 'string' && verificationOf(r.verification)) out.verification = verificationOf(r.verification);
  const origin = originOf(r.origin);
  if (origin) { out.origin = origin; if (r.originOwn === true) out.originOwn = true; }
  return out;
}

/** The address word of each menu page, in the site's language. */
export const WORD_DEFAULTS: Record<Lang, Record<AddressWord, string>> = {
  fr: { creations: 'creations', about: 'a-propos', blog: 'blog', contact: 'contact' },
  en: { creations: 'creations', about: 'about', blog: 'blog', contact: 'contact' },
  es: { creations: 'creaciones', about: 'sobre-mi', blog: 'blog', contact: 'contacto' },
};

/**
 * The crawlers that feed AI models and answers, as their makers name them
 * (read 2026-11-09). A closed site refuses each by name: robots.txt has no
 * word for « every AI ». A crawler that ignores robots.txt is not stopped by it.
 */
export const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'anthropic-ai', 'Google-Extended', 'Applebot-Extended', 'PerplexityBot', 'Perplexity-User', 'CCBot', 'Bytespider', 'Amazonbot', 'meta-externalagent', 'FacebookBot', 'cohere-ai', 'Diffbot', 'Omgilibot', 'YouBot', 'DuckAssistBot', 'MistralAI-User'] as const;

/**
 * One slug per key, never two alike: a slug she already has is kept as it is
 * (kept slugs first, so a new name can never take a sent address), a new one
 * comes from the name, and a clash takes -2, -3…
 */
export function slugsFor(items: ReadonlyArray<{ key: string; name: string }>, kept: Readonly<Record<string, string>> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  const taken = new Set<string>();
  for (const it of items) { const s = kept[it.key]; if (s && !taken.has(s)) { out[it.key] = s; taken.add(s); } }
  for (const it of items) {
    if (out[it.key]) continue;
    const base = slugOf(it.name);
    if (!base) continue;
    let s = base;
    for (let n = 2; taken.has(s); n++) s = `${base.slice(0, SEO_SLUG_MAX - 4)}-${n}`;
    out[it.key] = s;
    taken.add(s);
  }
  return out;
}
