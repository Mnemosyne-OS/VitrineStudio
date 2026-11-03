import type { Lang } from './profiles';
import { MENU_KEYS, menuDefaults, type SiteData } from '../site/buildSite';

/** A menu entry's name is hers when it is none of the three languages' own: she renamed it. */
const renamed = (key: (typeof MENU_KEYS)[number], name: string) => !(['en', 'fr', 'es'] as const).some((l) => menuDefaults(l)[key] === name);

/**
 * The site in a second language (asked for on 02/11: an English version,
 * translated automatically and always read by a person before it is online).
 *
 * The second version is the same site built in the other language (its menus,
 * dates, prices and legal pages come out in that language by themselves), then
 * HER words replaced by their translation. A translation is a proposal until
 * she ticks it as read: only read ones go online, every other string stays in
 * her own words. Entries are keyed by the source string, so a sentence she
 * rewrites asks for a new translation instead of keeping a stale one; the old
 * one is kept beside it, found by its place (`at`), to be shown as stale.
 *
 * A long text (a post, About, Contact, a page, her legal pages) is one entry
 * PER BLOCK of its HTML (a paragraph, a heading, a list, a picture): a price
 * changed in one paragraph asks for that paragraph again, the others she read
 * stay read (doc 145 §10.22).
 */
export interface TranslationEntry {
  to: string;
  ok?: true;
  /** The model that wrote `to` (an id of `translator.models`); absent = written before models were named. */
  by?: string;
  /** She changed the model's words: `to` is hers. */
  ed?: true;
  /** Where the source sat on the site (`WordSlot.where`): how a rewritten sentence finds its old translation. */
  at?: string;
}
export interface SiteTranslation {
  lang: Lang;
  entries: Record<string, TranslationEntry>;
}

/** The parts of the site her words are grouped by in the translation room, in the order the site shows them. */
export const WORD_GROUPS = ['menu', 'scenes', 'creations', 'about', 'blog', 'contact', 'pages', 'legal'] as const;
export type WordGroup = (typeof WORD_GROUPS)[number];
/** Where one of her strings sits: its part of the site, and a path that stays put while the words change. */
export interface WordSlot { group: WordGroup; where: string }
/** One of her strings, once, at the first place the site shows it. */
export interface HerWord extends WordSlot { text: string }

/** Long enough for a post's HTML; a hand-edited file never makes a wall. */
const TEXT_MAX = 60_000;
const ENTRIES_MAX = 4000;
const TAG_MAX = 200;

/** Elements that never close: they open no depth. */
const VOID = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/** The elements a long text is cut at; inline ones (a link, a bold word) stay inside their sentence. */
const BLOCK = new Set(['address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'img', 'ol', 'p', 'pre', 'section', 'table', 'ul']);

/**
 * An HTML text cut at its top-level block elements, every character kept: the
 * pieces joined give the text back exactly. A piece is `ws` when it is only
 * whitespace (kept, never translated); words outside any block are one piece.
 */
export function htmlPieces(html: string): Array<{ s: string; ws: boolean }> {
  const raw: string[] = [];
  let start = 0, depth = 0, open = false;
  const cut = (end: number) => { if (end > start) raw.push(html.slice(start, end)); start = end; };
  for (const t of html.matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g)) {
    if (!t[2]) continue;
    const at = t.index, end = at + t[0].length;
    const name = t[2].toLowerCase(), closing = t[1] === '/', single = VOID.has(name) || t[3] === '/';
    if (closing) {
      if (depth > 0) depth--;
      if (depth === 0 && open) { cut(end); open = false; }
    } else if (depth === 0 && BLOCK.has(name)) {
      cut(at);
      if (single) cut(end); else { depth = 1; open = true; }
    } else if (!single) depth++;
  }
  cut(html.length);
  const out: Array<{ s: string; ws: boolean }> = [];
  for (const piece of raw) {
    const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(piece)!;
    if (lead) out.push({ s: lead, ws: true });
    if (core) out.push({ s: core, ws: false });
    if (trail) out.push({ s: trail, ws: true });
  }
  return out;
}

/** The blocks the site build writes inside a post (buildSite: `post-img`, `post-pieces`). */
const BUILT_BLOCK = /^<(figure class="post-img|div class="post-pieces)/;

/** The blocks of an HTML text, whitespace between them left out. */
export const htmlBlocks = (html: string) => htmlPieces(html).filter((p) => !p.ws).map((p) => p.s);

/**
 * Every string of the site that SHE wrote, passed through `f` with where it
 * sits, in a copy of the data. The site's own words (`texts`, the legal pages
 * made from her fields, dates, measures) are not hers: they are already in the
 * build's language. Her own legal text, once she rewrote it, is.
 */
export function mapHerWords(data: SiteData, f: (s: string, at: WordSlot) => string): SiteData {
  const m = (s: string | undefined, group: WordGroup, where: string) => (s && s.trim() ? f(s, { group, where }) : s);
  // A long text, block by block; the whitespace between its blocks kept as it is.
  // A post's picture and its grid of pieces are made by the build (paths, names, prices), not written by her: they stay as they are.
  const blocks = (html: string | undefined, group: WordGroup, where: string) => (html && html.trim()
    ? (() => { let n = 0; return htmlPieces(html).map((p) => (p.ws || BUILT_BLOCK.test(p.s) ? p.s : f(p.s, { group, where: `${where}#${n++}` }))).join(''); })()
    : html);
  const rows = (r: SiteData['rows'], at: string): SiteData['rows'] => r.map((row, i) => ({
    ...row, name: m(row.name, 'scenes', `${at}row${i}`)!,
    scenes: row.scenes.map((s) => {
      const w = `scene:${s.id}`;
      return {
        ...s, name: m(s.name, 'scenes', `${w}:name`)!, piece: m(s.piece, 'scenes', `${w}:piece`)!,
        ...(s.caption ? { caption: { ...s.caption, ...(s.caption.title ? { title: m(s.caption.title, 'scenes', `${w}:title`)! } : {}), lines: s.caption.lines.map((l, j) => m(l, 'scenes', `${w}:line${j}`)!) } } : {}),
      };
    }),
  }));
  const creations = (c: SiteData['creations'], at: string): SiteData['creations'] => c.map((x) => ({
    ...x, alt: m(x.alt, 'creations', `${at}piece:${x.id}:alt`)!,
    ...(x.name ? { name: m(x.name, 'creations', `${at}piece:${x.id}:name`)! } : {}),
    ...(x.description ? { description: m(x.description, 'creations', `${at}piece:${x.id}:description`)! } : {}),
  }));
  const cats = (c: SiteData['categories'], at: string) => c?.map((k) => ({ ...k, name: m(k.name, 'creations', `${at}cat:${k.id}`)! }));
  const posts = (p: SiteData['posts'], at: string) => p?.map((x) => ({
    ...x, title: m(x.title, 'blog', `${at}post:${x.id}:title`)!, html: blocks(x.html, 'blog', `${at}post:${x.id}`)!, excerpt: m(x.excerpt, 'blog', `${at}post:${x.id}:excerpt`)!,
  }));
  const b = data.brand;
  // The menu entries she renamed are her words too: the menu and the page's title read them.
  const texts = { ...data.texts };
  for (const k of MENU_KEYS) if (texts[k] && renamed(k, texts[k])) texts[k] = m(texts[k], 'menu', `menu:${k}`)!;
  return {
    ...data,
    texts,
    // About and Contact are read from their HTML when it is there: the Markdown would be the same words to read twice.
    brand: {
      ...b, tagline: m(b.tagline, 'about', 'tagline')!, introLine: m(b.introLine, 'about', 'intro')!, portraitCaption: m(b.portraitCaption, 'about', 'portrait')!,
      about: data.aboutHtml ? b.about : m(b.about, 'about', 'about')!, contactNote: data.contactHtml ? b.contactNote : m(b.contactNote, 'contact', 'contact')!,
    },
    rows: rows(data.rows, ''),
    creations: creations(data.creations, ''),
    ...(data.categories ? { categories: cats(data.categories, '')! } : {}),
    ...(data.posts ? { posts: posts(data.posts, '')! } : {}),
    ...(data.links ? { links: data.links.map((l, i) => ({ ...l, title: m(l.title, 'menu', `link${i}`)! })) } : {}),
    ...(data.aboutHtml ? { aboutHtml: blocks(data.aboutHtml, 'about', 'about')! } : {}),
    ...(data.contactHtml ? { contactHtml: blocks(data.contactHtml, 'contact', 'contact')! } : {}),
    ...(data.legal ? { legal: { ...data.legal, pages: data.legal.pages.map((p) => (p.own ? { ...p, html: blocks(p.html, 'legal', `legal:${p.id}`)! } : p)) } } : {}),
    ...(data.pages ? {
      pages: data.pages.map((p) => {
        const at = `page:${p.id}:`;
        return {
          ...p, title: m(p.title, 'pages', `${at}title`)!,
          ...(p.html ? { html: blocks(p.html, 'pages', `${at}text`)! } : {}),
          ...(p.rows ? { rows: rows(p.rows, at) } : {}),
          ...(p.creations ? { creations: creations(p.creations, at) } : {}),
          ...(p.categories ? { categories: cats(p.categories, at)! } : {}),
          ...(p.posts ? { posts: posts(p.posts, at)! } : {}),
          ...(p.fields ? { fields: p.fields.map((fl, i) => ({ ...fl, label: m(fl.label, 'pages', `${at}field${i}`)!, ...(fl.options ? { options: fl.options.map((o, j) => m(o, 'pages', `${at}field${i}.${j}`)!) } : {}) })) } : {}),
        };
      }),
    } : {}),
  };
}

/** Her strings, once each, where the site first shows them, in the order it shows them. */
export function herItems(data: SiteData): HerWord[] {
  const seen = new Map<string, HerWord>();
  mapHerWords(data, (s, at) => { if (!seen.has(s)) seen.set(s, { text: s, ...at }); return s; });
  return [...seen.values()];
}

/** Her strings, once each, in the order the site shows them. */
export const herWords = (data: SiteData): string[] => herItems(data).map((w) => w.text);

const tag = (v: unknown) => (typeof v === 'string' && v && v.length <= TAG_MAX ? v : undefined);

/**
 * The translation as read from site.json: a language other than the known
 * three, or the studio's own, is no second version; an empty translation is
 * never kept as read. A whole text translated before it was cut in blocks is
 * cut the same way, block against block, when both have as many blocks: what
 * she read stays read. With a different count nothing is paired (a block
 * matched to the wrong one would put a wrong sentence online as read).
 */
export function normalizeTranslation(raw: unknown, main?: Lang): SiteTranslation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const lang = r.lang === 'en' || r.lang === 'fr' || r.lang === 'es' ? r.lang : null;
  if (!lang || lang === main) return undefined;
  const entries: SiteTranslation['entries'] = {};
  const src = r.entries && typeof r.entries === 'object' ? (r.entries as Record<string, unknown>) : {};
  for (const [from, v] of Object.entries(src).slice(0, ENTRIES_MAX)) {
    if (!from || from.length > TEXT_MAX || !v || typeof v !== 'object') continue;
    const e = v as Record<string, unknown>;
    if (typeof e.to !== 'string' || e.to.length > TEXT_MAX) continue;
    const by = tag(e.by), at = tag(e.at);
    const entry: TranslationEntry = { to: e.to, ...(e.ok === true && e.to.trim() ? { ok: true as const } : {}), ...(by ? { by } : {}), ...(e.ed === true ? { ed: true as const } : {}), ...(at ? { at } : {}) };
    const fromBlocks = from.trimStart().startsWith('<') ? htmlBlocks(from) : [];
    const toBlocks = fromBlocks.length > 1 ? htmlBlocks(e.to) : [];
    if (fromBlocks.length > 1 && toBlocks.length === fromBlocks.length) {
      fromBlocks.forEach((fb, i) => { if (!entries[fb]) entries[fb] = { ...entry, to: toBlocks[i]!, ...(at ? { at: `${at}#${i}` } : {}) }; });
    } else entries[from] = entry;
  }
  return { lang, entries };
}

/**
 * The site as it is sent: the studio's language, and the second version only
 * when its language is another one and she has read at least one of its
 * translations. `build` makes the site in a language (the same records).
 */
export function withSecondLanguage(lang: Lang, build: (lang: Lang) => SiteData, tr: SiteTranslation | undefined): SiteData {
  const main = build(lang);
  if (!tr || tr.lang === lang || !Object.values(tr.entries).some((e) => e.ok)) return main;
  return { ...main, alt: { lang: tr.lang, data: translated(build(tr.lang), tr) } };
}

/** The second version: each string she has read replaced, every other one left in her words. */
export function translated(data: SiteData, tr: SiteTranslation): SiteData {
  return mapHerWords(data, (s) => { const e = tr.entries[s]; return e?.ok ? e.to : s; });
}

/** Where she stands: strings to translate, translated but not read, read. */
export function translationProgress(words: string[], tr: SiteTranslation | undefined): { total: number; proposed: number; read: number } {
  let proposed = 0, read = 0;
  for (const w of words) {
    const e = tr?.entries[w];
    if (e?.ok) read++;
    else if (e?.to.trim()) proposed++;
  }
  return { total: words.length, proposed, read };
}

/**
 * What a line of the room shows: `missing` (nothing yet), `stale` (nothing
 * for these words, but the words that sat here before had a translation),
 * `proposed` (a model's, not read), `read`, `edited` (read, in her words).
 */
export type LineState = 'missing' | 'stale' | 'proposed' | 'read' | 'edited';
export interface RoomLine extends HerWord { state: LineState; entry?: TranslationEntry; old?: { from: string; entry: TranslationEntry } }

/**
 * The room's lines: each of her strings with its state, and for a rewritten
 * one the translation of the words that sat at its place before (an entry no
 * current string uses, found by `at`).
 */
export function roomLines(words: HerWord[], tr: SiteTranslation | undefined): RoomLine[] {
  const current = new Set(words.map((w) => w.text));
  const orphans = new Map<string, { from: string; entry: TranslationEntry }>();
  for (const [from, entry] of Object.entries(tr?.entries ?? {})) {
    if (!current.has(from) && entry.at && entry.to.trim()) orphans.set(entry.at, { from, entry });
  }
  return words.map((w) => {
    const entry = tr?.entries[w.text];
    if (entry?.to.trim()) return { ...w, entry, state: entry.ok ? (entry.ed ? 'edited' : 'read') : 'proposed' };
    const old = orphans.get(w.where);
    return old ? { ...w, state: 'stale', old } : { ...w, state: 'missing' };
  });
}

/** A count of each state, for a widget's readout. */
export function lineCounts(lines: RoomLine[]): Record<LineState, number> & { total: number } {
  const out = { missing: 0, stale: 0, proposed: 0, read: 0, edited: 0, total: lines.length };
  for (const l of lines) out[l.state]++;
  return out;
}

/**
 * A model's proposal written in, never over what she read: read is hers.
 * `replaces` = the old words this line showed as stale (`RoomLine.old.from`):
 * once the words now there have a translation, that one has served and goes,
 * or old entries would pile up past ENTRIES_MAX. Only that key: two current
 * strings can share a place (a text is placed where the site first shows it),
 * and a sweep by place would delete a read line still in use.
 */
export function proposeEntry(cur: SiteTranslation, from: string, to: string, by: string | null, at: string, replaces?: string): SiteTranslation {
  const had = cur.entries[from];
  if (had?.ok || !to.trim()) return cur;
  return { ...cur, entries: { ...without(cur.entries, replaces), [from]: { to, ...(by ? { by } : {}), at } } };
}

const without = (entries: SiteTranslation['entries'], key: string | undefined) => {
  if (!key || !(key in entries)) return entries;
  const { [key]: _gone, ...rest } = entries;
  return rest;
};

/** Her own words for a line: she wrote them, so they are read, and marked as hers when they differ from the model's. */
export function editEntry(cur: SiteTranslation, from: string, to: string, at: string, replaces?: string): SiteTranslation {
  const had = cur.entries[from];
  if (!to.trim()) {
    const { [from]: _gone, ...rest } = cur.entries;
    return { ...cur, entries: rest };
  }
  if (had && had.to === to) return cur;
  return { ...cur, entries: { ...without(cur.entries, replaces), [from]: { to, ok: true, ed: true, at, ...(had?.by ? { by: had.by } : {}) } } };
}

/** Ticks or unticks one line; nothing to tick on an empty one. */
export function readEntry(cur: SiteTranslation, from: string, ok: boolean): SiteTranslation {
  const had = cur.entries[from];
  if (!had?.to.trim()) return cur;
  const { ok: _ok, ...rest } = had;
  return { ...cur, entries: { ...cur.entries, [from]: ok ? { ...rest, ok: true } : rest } };
}

/** Ticks every proposed line of a widget at once (an empty one stays unticked, readEntry refuses it). */
export function readAll(cur: SiteTranslation, froms: string[]): SiteTranslation {
  return froms.reduce((acc, f) => (acc.entries[f]?.ok ? acc : readEntry(acc, f, true)), cur);
}

/** A block that is one element around inline words (a paragraph, a heading, a list item): its tag and its inside. */
const WRAP = /^<(p|h[1-6]|li|blockquote)>([\s\S]*)<\/\1>$/;

/**
 * What the room's field shows for a translation: the words inside the
 * block's own element, never its `<p>` around them. A translation that is
 * not wrapped like its source is shown whole, nothing hidden.
 */
export function fieldText(source: string, to: string): string {
  const tag = WRAP.exec(source)?.[1];
  const inner = tag ? WRAP.exec(to.trim()) : null;
  return inner && inner[1] === tag ? inner[2]! : to;
}

/** Her field back into the block: wrapped in the source's element unless she wrote the element herself. */
export function fromField(source: string, text: string): string {
  const tag = WRAP.exec(source)?.[1];
  // Her own block element is kept; a bold word or a link at the start is still inside the source's element.
  if (!tag || !text.trim() || /^<(p|h[1-6]|li|blockquote|ul|ol|figure|div|table|pre)\b/i.test(text.trim())) return text;
  return `<${tag}>${text.trim()}</${tag}>`;
}
