/**
 * The studio's post editor, on the file's side (Tony: « récupère l'éditeur et
 * intègre-le dans Atelier Studio », its working name). Same principle as the Notes editor: an
 * editable page whose HTML is written back as Markdown, so the file stays a
 * note that Notes, or any editor, can still open.
 *
 * Only what the toolbar makes is kept: paragraphs, headings, lists, quotes,
 * bold, italic, struck, code, links, pictures and blocks of pieces. Anything
 * else is kept as its text.
 */

import { splitFrontMatter } from './blog';

/**
 * A post file split into the properties block it may open with (kept as it is,
 * the Notes app writes one), its title (first `#` line) and the body under it.
 */
export function splitPost(text: string): { front: string; title: string; body: string } {
  const { front, rest } = splitFrontMatter(text);
  const m = /^\s*#\s+(.+?)\s*#*\s*(\n|$)/.exec(rest);
  if (!m) return { front, title: '', body: rest.trim() };
  return { front, title: m[1]!.trim(), body: rest.slice(m[0].length).trim() };
}

/** The file written back: the properties block untouched, the title as the first heading, then the body. */
export function joinPost(title: string, body: string, front = ''): string {
  const t = title.replace(/\s+/g, ' ').trim();
  const b = body.trim();
  return `${front}${t ? `# ${t}\n\n` : ''}${b ? `${b}\n` : ''}`;
}

/** Characters that would turn plain words into Markdown, escaped. */
function plain(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/([\\*_`~[\]])/g, '\\$1');
}

function inline(node: Node): string {
  if (node.nodeType === 3) return plain(node.textContent ?? '');
  if (node.nodeType !== 1) return '';
  const el = node as HTMLElement;
  const inner = () => Array.from(el.childNodes).map(inline).join('');
  const wrap = (mark: string) => {
    const s = inner();
    // A mark around spaces is no mark: keep the spaces outside it.
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
    return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : s;
  };
  switch (el.tagName) {
    case 'BR': return '\n';
    case 'B': case 'STRONG': return wrap('**');
    case 'I': case 'EM': return wrap('*');
    case 'S': case 'STRIKE': case 'DEL': return wrap('~~');
    case 'CODE': return `\`${(el.textContent ?? '').replace(/`/g, '')}\``;
    case 'A': {
      const href = el.getAttribute('href') ?? '';
      const label = inner();
      return /^(https?:\/\/|mailto:)/i.test(href) && label ? `[${label}](${href})` : label;
    }
    default: return inner();
  }
}

const BLOCKS = new Set(['P', 'DIV', 'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'HR', 'PRE']);

/** The editor's content as Markdown, one blank line between blocks. */
export function domToMarkdown(root: HTMLElement): string {
  const blocks: string[] = [];
  let loose: Node[] = [];
  const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  // A paragraph line that opens like a list, a quote or a heading stays words.
  const guard = (l: string) => l.replace(/^(\d+)([.)])/, '$1\\$2').replace(/^([#>+-])/, '\\$1');
  const flushLoose = () => {
    const s = loose.map(inline).join('');
    loose = [];
    if (s.trim()) blocks.push(lines(s).map(guard).join('  \n'));
  };
  for (const node of Array.from(root.childNodes)) {
    const el = node.nodeType === 1 ? (node as HTMLElement) : null;
    if (!el || !BLOCKS.has(el.tagName)) { loose.push(node); continue; }
    flushLoose();
    const tag = el.tagName;
    if (tag === 'HR') { blocks.push('---'); continue; }
    // A picture or a block of pieces: written back from what it carries, never from its dressing.
    if (el.classList.contains('pe-img')) {
      const path = el.dataset.path ?? '';
      const layout = ['left', 'right', 'full'].includes(el.dataset.layout ?? '') ? el.dataset.layout! : 'full';
      if (path && !/[<>\n]/.test(path)) blocks.push(`![${(el.dataset.alt ?? '').replace(/[[\]\n]/g, '').trim()}](<${path}> "${layout}")`);
      continue;
    }
    if (el.classList.contains('pe-pieces')) {
      const ids = (el.dataset.ids ?? '').split(',').filter((s) => /^[A-Za-z0-9_-]{1,80}$/.test(s));
      if (ids.length) blocks.push(`::pieces{ids="${ids.join(',')}" layout="${el.dataset.layout === 'column' ? 'column' : 'row'}"}`);
      continue;
    }
    if (/^H[1-6]$/.test(tag)) {
      const text = inline(el).replace(/\s+/g, ' ').trim();
      if (text) blocks.push(`${'#'.repeat(Math.max(2, Math.min(Number(tag[1]), 3)))} ${text}`);
      continue;
    }
    if (tag === 'UL' || tag === 'OL') {
      const items = Array.from(el.children).filter((c) => c.tagName === 'LI').map((li) => inline(li).replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (items.length) blocks.push(items.map((it, i) => `${tag === 'OL' ? `${i + 1}.` : '-'} ${it}`).join('\n'));
      continue;
    }
    if (tag === 'BLOCKQUOTE') {
      const text = lines(Array.from(el.childNodes).map((c) => (c.nodeType === 1 && BLOCKS.has((c as HTMLElement).tagName) ? `${inline(c)}\n` : inline(c))).join(''));
      if (text.length) blocks.push(text.map((l) => `> ${l}`).join('\n'));
      continue;
    }
    // A paragraph (the editor makes DIVs on Enter): its lines kept as line breaks.
    const text = lines(inline(el)).map(guard);
    if (text.length) blocks.push(text.join('  \n'));
  }
  flushLoose();
  return blocks.join('\n\n');
}
