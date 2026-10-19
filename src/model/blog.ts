/**
 * The site's blog (Tony: « remplace événement par blog, et on peut coupler
 * avec le widget note »).
 *
 * A post is a Markdown file on the person's disk: one she already wrote
 * somewhere, or a new one the studio creates in `<studio>/blog/` and opens in
 * the Notes editor, which has the formatting tools. The studio keeps only the
 * list (path, date, shown or not) in `site.json`; the words stay in the file,
 * read again at each preview and export.
 *
 * The page loads nothing from outside, so the Markdown becomes HTML here, at
 * export: everything is escaped first, and only the studio's own tags come out.
 * Pictures inside a note are not carried yet: their alt text stays.
 */

import { normalizePageId } from './pages';
export interface BlogPost {
  id: string;
  /** The Markdown file, where she keeps it. */
  path: string;
  /** The day shown on the site, YYYY-MM-DD. */
  date: string;
  /** On the site or kept aside. */
  published: boolean;
  /** An added blog page (model/pages.ts); absent = the Blog. */
  pageId?: string;
}

/** The extensions a post can be: what the Notes editor opens and the host reads. */
export const POST_EXTENSIONS = ['md', 'markdown', 'txt'];
const POST_FILE = /\.(md|markdown|txt)$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function normalizePosts(raw: unknown): BlogPost[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: BlogPost[] = [];
  for (const r of raw as Array<Record<string, unknown>>) {
    if (!r || typeof r !== 'object') continue;
    const { id, path, date } = r;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id) || seen.has(id)) continue;
    if (typeof path !== 'string' || !POST_FILE.test(path.trim())) continue;
    seen.add(id);
    const pageId = normalizePageId(r.pageId);
    out.push({ id, path: path.trim(), date: typeof date === 'string' && DAY.test(date) ? date : '', published: r.published !== false, ...(pageId ? { pageId } : {}) });
  }
  return out;
}

/** The newest first; a post without a date last. */
export function sortPosts<T extends { date: string }>(posts: T[]): T[] {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date));
}

/** A file name for a new post, from its title: plain, short, never empty. */
export function postFileName(title: string, taken: (name: string) => boolean): string {
  const base = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'article';
  let name = `${base}.md`;
  for (let i = 2; taken(name); i++) name = `${base}-${i}.md`;
  return name;
}

/**
 * The properties block a note may open with (`---` … `---`, the Notes app
 * writes one), and the text under it. The block is kept as it is in the file
 * and never shown: not in the editor, not on the site.
 */
export function splitFrontMatter(text: string): { front: string; rest: string } {
  const src = text.replace(/\r\n?/g, '\n');
  const m = /^---\n[\s\S]*?\n---[ \t]*(\n|$)/.exec(src);
  return m ? { front: m[0], rest: src.slice(m[0].length) } : { front: '', rest: src };
}

/** Where a picture sits beside the paragraph after it, or across the page. */
export type ImageLayout = 'left' | 'right' | 'full';
/** How a block of pieces is laid out: side by side, or one under the other. */
export type PiecesLayout = 'row' | 'column';

/** A picture on its own line: `![alt](<path> "left")`, the angle brackets letting a path hold spaces. */
const IMAGE_LINE = /^\s*!\[([^\]]*)\]\((?:<([^>]+)>|(\S+))(?:\s+"(left|right|full)")?\)\s*$/;
/** Pieces of the studio on their own line: `::pieces{ids="a,b" layout="row"}`. */
const PIECES_LINE = /^\s*::pieces\{ids="([^"]*)"(?:\s+layout="(row|column)")?\}\s*$/;

export function imageLine(line: string): { alt: string; path: string; layout: ImageLayout } | null {
  const m = IMAGE_LINE.exec(line);
  return m ? { alt: m[1]!, path: (m[2] ?? m[3])!, layout: (m[4] as ImageLayout | undefined) ?? 'full' } : null;
}

export function piecesLine(line: string): { ids: string[]; layout: PiecesLayout } | null {
  const m = PIECES_LINE.exec(line);
  if (!m) return null;
  const ids = m[1]!.split(',').map((s) => s.trim()).filter((s) => /^[A-Za-z0-9_-]{1,80}$/.test(s));
  return ids.length ? { ids, layout: (m[2] as PiecesLayout | undefined) ?? 'row' } : null;
}

/** The pictures of a post, in the order the page shows them (the export writes them under this order). */
export function postImages(text: string): string[] {
  return splitFrontMatter(text).rest.split('\n').map(imageLine).filter((x) => x !== null).map((x) => x.path);
}

/** The pieces a post shows, once each. */
export function postPieces(text: string): string[] {
  return [...new Set(splitFrontMatter(text).rest.split('\n').map(piecesLine).filter((x) => x !== null).flatMap((x) => x.ids))];
}

/** A post's title: its first `#` heading, else its file name without extension. */
export function postTitle(text: string, path: string): string {
  const h = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m.exec(splitFrontMatter(text).rest);
  if (h) return h[1]!.trim();
  return (path.split(/[\\/]/).pop() ?? path).replace(POST_FILE, '');
}

/** A post's words as plain text: no title, no pictures or pieces, no markup. */
function plainBody(text: string): string {
  const body = splitFrontMatter(text).rest.replace(/^\s{0,3}#{1,6}\s+.*$/m, '');
  return body
    .split('\n').filter((l) => !imageLine(l) && !piecesLine(l)).join('\n')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/[*_`~\\]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The minutes a post takes to read, at 200 words a minute; at least one. */
export function readingMinutes(text: string): number {
  const words = plainBody(text).split(' ').filter((w) => /\p{L}|\p{N}/u.test(w)).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** The opening words of a post as plain text, for its tile: no title, no markup, cut on a word. */
export function postExcerpt(text: string, max = 160): string {
  const plain = plainBody(text);
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).trimEnd()}…`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A link the site may carry: the web or a mail address, nothing that runs. */
function safeHref(href: string): string | null {
  const h = href.trim();
  return /^(https?:\/\/|mailto:)/i.test(h) ? h : null;
}

/** Bold, italic, code and links inside a line, on text already escaped. */
function inline(text: string): string {
  // A character written `\*` is the character itself, never markup: set aside, put back at the end.
  const kept: string[] = [];
  let s = esc(text.replace(/\\([\\*_`~[\]#>+.)-])/g, (_m: string, c: string) => `\u0001${kept.push(c) - 1}\u0002`));
  // A picture keeps its alt text; the file itself is not on the site.
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_m: string, label: string, href: string) => {
    const ok = safeHref(href.replace(/&amp;/g, '&'));
    return ok ? `<a href="${esc(ok)}" rel="noopener">${label}</a>` : label;
  });
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/(\*\*\*|___)(?=\S)(.+?)(?<=\S)\1/g, '<strong><em>$2</em></strong>');
  s = s.replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '<strong>$2</strong>');
  s = s.replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '<s>$1</s>');
  s = s.replace(/(^|[^*\w])([*_])(?=\S)(.+?)(?<=\S)\2(?![*\w])/g, '$1<em>$3</em>');
  return s.replace(/\u0001(\d+)\u0002/g, (_m: string, i: string) => esc(kept[Number(i)] ?? ''));
}

/**
 * A post's body as HTML: paragraphs, headings (the first one is the title and
 * is left out), lists, quotes, bold, italic, links. Nothing from the file
 * reaches the page unescaped.
 *
 * `editor`: the body alone (its title is in its own field), headings at their
 * own level, pictures and pieces as blocks the editor dresses (model/blogEdit).
 * On the site, `image` and `pieces` say what a picture or a block of pieces
 * becomes; without them they are left out.
 */
export function markdownToHtml(md: string, opts: {
  editor?: boolean;
  /** A page's text, not a post: a first heading is kept (a post's is its title, shown apart). */
  keepTitle?: boolean;
  image?: (img: { alt: string; path: string; layout: ImageLayout }) => string | null;
  pieces?: (block: { ids: string[]; layout: PiecesLayout }) => string;
} = {}): string {
  const lines = splitFrontMatter(md).rest.split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
  let quote: string[] = [];
  let titleSkipped = opts.editor === true || opts.keepTitle === true;
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    list = null;
    if (quote.length) out.push(`<blockquote><p>${quote.map(inline).join('<br>')}</p></blockquote>`);
    quote = [];
  };
  for (const line of lines) {
    const h = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (!line.trim()) { flush(); continue; }
    const img = imageLine(line);
    const pcs = img ? null : piecesLine(line);
    if (img || pcs) {
      flush();
      titleSkipped = true;
      if (img) {
        const html = opts.editor
          ? `<figure class="pe-img ${img.layout}" contenteditable="false" data-path="${esc(img.path)}" data-layout="${img.layout}" data-alt="${esc(img.alt)}"><img alt="${esc(img.alt)}"></figure>`
          : opts.image?.(img);
        if (html) out.push(html);
      } else if (pcs) {
        const html = opts.editor
          ? `<div class="pe-pieces ${pcs.layout}" contenteditable="false" data-ids="${esc(pcs.ids.join(','))}" data-layout="${pcs.layout}"></div>`
          : opts.pieces?.(pcs);
        if (html) out.push(html);
      }
      continue;
    }
    if (h) {
      flush();
      if (!titleSkipped) { titleSkipped = true; continue; }
      // The post's title is the page's h2: its own headings start one level down.
      const level = opts.editor ? Math.min(h[1]!.length, 3) : Math.min(h[1]!.length + 1, 4);
      out.push(`<h${level}>${inline(h[2]!)}</h${level}>`);
      titleSkipped = true;
      continue;
    }
    titleSkipped = true;
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }
    if (ul || ol) {
      const tag = ul ? 'ul' : 'ol';
      if (para.length || quote.length || (list && list.tag !== tag)) flush();
      list ??= { tag, items: [] };
      list.items.push((ul ?? ol)![1]!);
      continue;
    }
    if (q) {
      if (para.length || list) flush();
      quote.push(q[1]!);
      continue;
    }
    if (list || quote.length) flush();
    para.push(line.trim());
  }
  flush();
  return out.join('');
}
