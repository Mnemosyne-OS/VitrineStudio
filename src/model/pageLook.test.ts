import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BALANCED_LOOK, lookClasses, normalizeLook } from './pageLook';
import { normalizePages } from './pages';
import { normalizeSiteSettings } from './records';
import { buildSiteData } from '../site/buildSite';

describe('a page look read from a file', () => {
  it('keeps what it knows and takes the balanced value for a part it does not', () => {
    expect(normalizeLook({ margin: 'l', split: 'third', align: 'bottom', shape: 'square' })).toEqual({ margin: 'l', split: 'third', align: 'bottom', shape: 'square' });
    expect(normalizeLook({ margin: 'huge', split: 'third' })).toEqual({ ...BALANCED_LOOK, split: 'third' });
  });

  it('is no look at all when it is not an object: the page keeps its layout of before', () => {
    for (const raw of [undefined, null, 'm', 3, ['m']]) expect(normalizeLook(raw)).toBeUndefined();
  });

  it('is kept on a text page only, and on the About page', () => {
    const pages = normalizePages([
      { id: 'atelier', type: 'text', name: 'Atelier', look: { margin: 's' } },
      { id: 'inscription', type: 'form', name: 'Inscription', look: { margin: 's' } },
    ]);
    expect(pages[0]?.look?.margin).toBe('s');
    expect(pages[1]?.look).toBeUndefined();
    expect(normalizeSiteSettings({ brand: { aboutLook: { margin: 'l' } } }, '').brand.aboutLook?.margin).toBe('l');
    expect(normalizeSiteSettings({ brand: {} }, '').brand.aboutLook).toBeUndefined();
  });
});

describe('a page look on the site', () => {
  const brand = { name: 'A', tagline: '', about: 'Bonjour', email: '', instagram: '', introLine: '', portraitCaption: '', contactNote: '', formspree: '', accent: '#5F5A53', ink: '#2B2926', paper: '#EEECE7' };
  const base = { lang: 'fr' as const, today: '2026-11-10', untitled: 'x', scenes: [], pieces: [] };

  it('writes one class per part, and nothing for a page without a look', () => {
    expect(lookClasses(undefined)).toBe('');
    expect(lookClasses({ margin: 'l', split: 'twothirds', align: 'center', shape: 'portrait' })).toBe('looked m-l s-twothirds a-center sh-portrait');
    const data = buildSiteData({ ...base, brand, pages: [
      { id: 'a', type: 'text', name: 'A', text: 'x', look: { ...BALANCED_LOOK, margin: 's' } },
      { id: 'b', type: 'text', name: 'B', text: 'x' },
    ] });
    expect(data.pages?.[0]?.look).toBe('looked m-s s-half a-center sh-natural');
    expect(data.pages?.[1]).not.toHaveProperty('look');
    expect(data.aboutLook).toBeUndefined();
    expect(buildSiteData({ ...base, brand: { ...brand, aboutLook: BALANCED_LOOK } }).aboutLook).toBe('looked m-m s-half a-center sh-natural');
  });

  it('is laid out on a large screen only: phones keep the words and the picture stacked', () => {
    const tpl = readFileSync(join(__dirname, '..', 'site', 'template.html'), 'utf8');
    // Every rule of the look sits inside the large-screen block, none outside it.
    const block = /@media \(min-width: 761px\) \{\n((?: {4}.*\n)+) {2}\}/.exec(tpl)?.[1] ?? '';
    expect(block).toContain('.page .cols.looked {');
    expect(tpl.split('\n').filter((l) => l.includes('.cols.looked') && !block.includes(l))).toEqual([]);
    // A look with no picture: the words take the whole width, not half of it beside an empty column.
    expect(block).toContain('.page .cols.looked:not(:has(> .side)) { grid-template-columns: minmax(0, 1fr); }');
    // The margins grow from a tablet's width, nothing at 760px; the lines keep a ceiling.
    expect(block).toMatch(/\.m-l \{ --look-m: max\(0px, \(100vw - 760px\) \* \.3\); \}/);
    expect(block).toContain('.page .cols.looked .lead p, .page .cols.looked .lead li { max-width: 70ch; }');
    // Both pages of words carry the look's classes on their columns.
    expect(tpl).toContain("about-${esc(B.aboutLayout || 'right')}${D.aboutLook ? ` ${esc(D.aboutLook)}` : ''}");
    expect(tpl).toContain("about-${esc(p.layout || 'right')}${p.look ? ` ${esc(p.look)}` : ''}");
  });
});
