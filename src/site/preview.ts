/**
 * The website as it will be, without writing a file: the export runs for real
 * (same pictures, same width, same quality, same weight per picture), but
 * every file it would save is kept in memory, and the page's asset names are
 * swapped for in-memory addresses. What the preview shows and weighs is what
 * the export would write.
 */
import { exportSite, type ExportDeps, type ExportSize, type SiteData } from './buildSite';
import type { Piece, Scene } from '../model/types';
import type { filmSources } from './buildSite';
import { base64ToBytes } from '../data/bytes';

const TYPES: Record<string, string> = { webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', png: 'image/png', jpg: 'image/jpeg', woff2: 'font/woff2', txt: 'text/plain', html: 'text/html', css: 'text/css' };

export interface Preview {
  html: string;
  /**
   * The page itself, at an in-memory address. Never `srcdoc`: a srcdoc page
   * resolves `#garden` against the STUDIO's address, so every link of its
   * navigation left the page (Tony: « la nav marche pas »).
   */
  pageUrl: string;
  size: ExportSize;
  /** The in-memory addresses to let go of when the preview closes. */
  urls: string[];
}

/**
 * One asset name of the page swapped for an address. Names appear quoted in
 * the inlined data: exactly those are swapped, never a partial match. Inside a
 * blog post's HTML they are an attribute of a JSON string: quoted `\"name\"`.
 */
export function swapAsset(html: string, name: string, url: string): string {
  return html.split(`"${name}"`).join(`"${url}"`).split(`\\"${name}\\"`).join(`\\"${url}\\"`);
}

/** The message a preview sends when a menu entry is renamed in it. */
export const MENU_RENAMED = 'atelier-studio:menu-renamed';
/** The message a preview sends when the Creations page's pieces are dragged into a new order. */
export const PIECES_ORDERED = 'atelier-studio:pieces-ordered';
/** The message a preview sends when the menu's entries are dragged into a new order. */
export const MENU_ORDERED = 'atelier-studio:menu-ordered';

/** The menu entries a preview lets her rename, by the page each opens. */
const MENU_PAGES: Record<string, string> = { creations: 'creations', 'a-propos': 'about', blog: 'blog', contact: 'contact' };

/**
 * Renaming in the preview itself (Tony: « au survol dans le menu, un petit
 * crayon et voilà »): a pencil beside each entry on hover; the name is typed in
 * place, Enter or leaving it keeps it, Escape puts it back. The studio is told
 * by a message and saves it. Only in a preview: the exported page never has it.
 */
const MENU_EDIT_SCRIPT = `<script>(() => {
  const PAGES = ${JSON.stringify(MENU_PAGES)};
  const css = document.createElement('style');
  // The pencil sits in the line, right after the name: never off the window's edge.
  css.textContent = 'nav a{display:inline-flex;align-items:center;gap:6px}nav a .mn-pen{display:inline-grid;place-items:center;width:20px;height:20px;padding:0;border:0;border-radius:50%;background:none;color:inherit;opacity:.25;cursor:pointer;transition:opacity .2s,background .2s}nav a:hover .mn-pen,nav a .mn-pen:focus-visible{opacity:1;background:color-mix(in srgb,currentColor 14%,transparent)}nav a[data-editing]{outline:1px dashed currentColor;outline-offset:4px;cursor:text}nav a[data-editing] .mn-pen{display:none}nav a[draggable=true]{cursor:grab}nav a.mn-dragging{opacity:.35}nav a.mn-before{box-shadow:-3px 0 0 currentColor}nav a.mn-after{box-shadow:3px 0 0 currentColor}.gallery figure[draggable=true]{cursor:grab}.gallery figure.mn-dragging{opacity:.35}.gallery figure.mn-before{box-shadow:-4px 0 0 var(--accent)}.gallery figure.mn-after{box-shadow:4px 0 0 var(--accent)}';
  document.head.appendChild(css);
  const pen = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const label = (a) => a.querySelector('.mn-text');
  const edit = (a) => {
    const t = label(a); const before = t.textContent;
    a.dataset.editing = '1'; t.contentEditable = 'plaintext-only'; t.focus();
    const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const done = (keep) => {
      t.removeEventListener('keydown', key); t.removeEventListener('blur', blur);
      t.contentEditable = 'false'; delete a.dataset.editing;
      const name = t.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40);
      if (!keep || !name) { t.textContent = before; return; }
      t.textContent = name;
      const page = a.hash.slice(1); const h = document.querySelector('#p-' + page + ' h1'); if (h) h.textContent = name;
      if (name !== before) parent.postMessage({ type: ${JSON.stringify(MENU_RENAMED)}, key: PAGES[page], name }, '*');
    };
    const key = (e) => { if (e.key === 'Enter') { e.preventDefault(); done(true); t.blur(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } };
    const blur = () => done(true);
    t.addEventListener('keydown', key); t.addEventListener('blur', blur);
  };
  const dress = () => {
    const links = [...document.querySelectorAll('nav a')].filter((a) => PAGES[a.hash.slice(1)] && !a.querySelector('.mn-pen'));
    for (const a of links) {
      const t = document.createElement('span'); t.className = 'mn-text'; t.textContent = a.textContent; a.textContent = ''; a.appendChild(t);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mn-pen'; b.title = '\\u270e'; b.innerHTML = pen;
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); edit(a); });
      a.appendChild(b);
      a.addEventListener('click', (e) => { if (a.dataset.editing) e.preventDefault(); });
      movable(a);
    }
    return links.length;
  };
  // The entries move by drag and drop: before the one under the pointer, or after it past its middle.
  let held = null;
  const entries = () => [...document.querySelectorAll('nav a')].filter((a) => PAGES[a.hash.slice(1)]);
  const clear = () => entries().forEach((a) => a.classList.remove('mn-before', 'mn-after'));
  const side = (a, e) => { const r = a.getBoundingClientRect(); return e.clientX > r.left + r.width / 2 ? 'after' : 'before'; };
  const movable = (a) => {
    a.draggable = true;
    a.addEventListener('dragstart', (e) => { if (a.dataset.editing) { e.preventDefault(); return; } held = a; a.classList.add('mn-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', a.hash); });
    a.addEventListener('dragend', () => { a.classList.remove('mn-dragging'); held = null; clear(); });
    a.addEventListener('dragover', (e) => { if (!held || held === a) return; e.preventDefault(); clear(); a.classList.add('mn-' + side(a, e)); });
    a.addEventListener('dragleave', () => a.classList.remove('mn-before', 'mn-after'));
    a.addEventListener('drop', (e) => {
      if (!held || held === a) return;
      e.preventDefault();
      if (side(a, e) === 'after') a.after(held); else a.before(held);
      clear();
      parent.postMessage({ type: ${JSON.stringify(MENU_ORDERED)}, order: entries().map((x) => PAGES[x.hash.slice(1)]) }, '*');
    });
  };
  // The Creations page's pieces move the same way: a click still opens one, a drag moves it.
  let piece = null;
  const figs = () => [...document.querySelectorAll('.gallery figure')];
  const clearFigs = () => figs().forEach((f) => f.classList.remove('mn-before', 'mn-after'));
  const sideOf = (f, e) => { const r = f.getBoundingClientRect(); return e.clientX > r.left + r.width / 2 ? 'after' : 'before'; };
  const movableFig = (f) => {
    f.draggable = true;
    f.addEventListener('dragstart', (e) => { piece = f; f.classList.add('mn-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', f.dataset.id || ''); });
    f.addEventListener('dragend', () => { f.classList.remove('mn-dragging'); piece = null; clearFigs(); });
    f.addEventListener('dragover', (e) => { if (!piece || piece === f) return; e.preventDefault(); clearFigs(); f.classList.add('mn-' + sideOf(f, e)); });
    f.addEventListener('dragleave', () => f.classList.remove('mn-before', 'mn-after'));
    f.addEventListener('drop', (e) => {
      if (!piece || piece === f) return;
      e.preventDefault();
      if (sideOf(f, e) === 'after') f.after(piece); else f.before(piece);
      clearFigs();
      parent.postMessage({ type: ${JSON.stringify(PIECES_ORDERED)}, order: figs().map((x) => x.dataset.id).filter(Boolean) }, '*');
    });
  };
  let figTries = 0; const figWait = setInterval(() => { const all = figs().filter((f) => !f.draggable); all.forEach(movableFig); if (all.length || ++figTries > 50) clearInterval(figWait); }, 100);
  // The menu is built once the page's data is read: wait for it, a few seconds at most.
  let tries = 0; const wait = setInterval(() => { if (dress() || ++tries > 50) clearInterval(wait); }, 100);
})();</script>`;

/** A preview's page with in-place menu renaming; the exported page never has it. */
export function withMenuEditing(html: string): string {
  const at = html.lastIndexOf('</body>');
  return at < 0 ? html + MENU_EDIT_SCRIPT : html.slice(0, at) + MENU_EDIT_SCRIPT + html.slice(at);
}

/**
 * What the page's own script threw, kept on the page (`__previewErrors`) for the
 * studio to read: a page whose script stops stays white and says nothing (field,
 * 2026-10-12: a network change cut the studio's own modules mid-update, and the
 * preview was a blank page). Script errors only: a missing picture is not one.
 */
const ERROR_WATCH_SCRIPT = '<script>window.__previewErrors=[];addEventListener("error",function(e){window.__previewErrors.push(String(e.message||e.error))});addEventListener("unhandledrejection",function(e){var r=e.reason;window.__previewErrors.push(String(r&&r.message||r))});</script>';

/** The page with its error watch first in <head>, before any of its own scripts run. */
export function withErrorWatch(html: string): string {
  const at = html.search(/<head[^>]*>/i);
  if (at < 0) return ERROR_WATCH_SCRIPT + html;
  const end = html.indexOf('>', at) + 1;
  return html.slice(0, end) + ERROR_WATCH_SCRIPT + html.slice(end);
}

export async function buildPreview(
  data: SiteData,
  scenes: Scene[],
  pieces: Piece[],
  shell: string,
  deps: Omit<ExportDeps, 'save'> & {
    /** An address for a file held in memory (URL.createObjectURL in the page). */
    toUrl: (bytes: Uint8Array, type: string) => string;
  },
  film: ReturnType<typeof filmSources> = null,
): Promise<Preview> {
  const assets = new Map<string, string>();
  const urls: string[] = [];
  const size = await exportSite(data, scenes, pieces, shell, {
    ...deps,
    save: (name, base64) => {
      // The page and its data are the shell itself: only the files it points at are kept.
      if (name === 'index.html' || name === 'data.json') return Promise.resolve();
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      const url = deps.toUrl(base64ToBytes(base64), TYPES[ext] ?? 'application/octet-stream');
      urls.push(url);
      assets.set(name, url);
      return Promise.resolve();
    },
  }, film);
  let html = shell;
  for (const [name, url] of assets) html = swapAsset(html, name, url);
  html = withErrorWatch(withMenuEditing(html));
  const pageUrl = deps.toUrl(new TextEncoder().encode(html), 'text/html');
  urls.push(pageUrl);
  return { html, pageUrl, size, urls };
}
