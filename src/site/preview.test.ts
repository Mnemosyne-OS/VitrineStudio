import { blogAssets, buildSiteData, exportSite, fillShell, type Brand } from './buildSite';
import { buildPreview, MENU_RENAMED, withErrorWatch } from './preview';
import type { Piece, Scene } from '../model/types';

const piece = (id: string): Piece => ({ schema: 1, id, name: `Piece ${id}`, kind: 'unique', tags: [], photoPath: `C:/p/${id}.jpg` });
const scene = (id: string): Scene => ({
  schema: 1, id, pieceId: 'p1', universe: 'Salon', variant: 'Console', placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9',
  images: { place: `C:/s/${id}-a.png`, piece: `C:/s/${id}-b.png`, alive: `C:/s/${id}-c.png` }, validated: true,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
});
const brand: Brand = { accent: '#5F5A53', ink: '#2B2926', paper: '#EEECE7', name: 'Atelier', tagline: '', about: '', email: '', instagram: '', introLine: '', portraitCaption: '', contactNote: '', formspree: '' };

describe('buildPreview', () => {
  it('swaps every asset of the page for an in-memory address and weighs it like the export', async () => {
    const scenes = [scene('1')];
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')] });
    const shell = fillShell('<script>window.D=__DATA__</script>', brand, 'fr', data);
    let n = 0;
    const p = await buildPreview(data, scenes, [piece('p1')], shell, {
      readImage: async (x) => `data:${x}`, readMedia: async () => 'data:video/mp4;base64,AAAA', onProgress: () => {},
      toWebp: async () => 'AAAA', imageKb: 100,
      toUrl: (_b, type) => `blob:${type}#${++n}`,
    });
    // 7 pictures, then the page itself.
    expect(p.urls).toHaveLength(8);
    expect(p.pageUrl).toBe('blob:text/html#8');
    expect(p.html).not.toMatch(/"assets\//);
    expect(p.html).toContain('"blob:image/webp#1"');
    expect(p.size.imageBytes).toBe(21);
  });

  it('lets the preview rename the menu, and never the exported page', async () => {
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes: [scene('1')], pieces: [piece('p1')] });
    const shell = fillShell('<html><body><script>window.D=__DATA__</script></body></html>', brand, 'fr', data);
    const p = await buildPreview(data, [scene('1')], [piece('p1')], shell, {
      readImage: async (x) => `data:${x}`, readMedia: async () => 'data:video/mp4;base64,AAAA', onProgress: () => {},
      toWebp: async () => 'AAAA', imageKb: 100, toUrl: () => 'blob:x',
    });
    expect(p.html.split(MENU_RENAMED).length).toBe(2);
    expect(p.html.indexOf(MENU_RENAMED)).toBeLessThan(p.html.indexOf('</body>'));
    const saved: Record<string, string> = {};
    await exportSite(data, [scene('1')], [piece('p1')], shell, {
      readImage: async (x) => `data:${x}`, readMedia: async () => 'data:video/mp4;base64,AAAA', onProgress: () => {},
      toWebp: async () => 'AAAA', imageKb: 100, save: async (name, b64) => { saved[name] = b64; },
    });
    expect(Buffer.from(saved['index.html']!, 'base64').toString('utf8')).not.toContain(MENU_RENAMED);
  });

  it('swaps the pictures of a blog post too, written inside its HTML', async () => {
    const posts = [{ id: 'b1', title: 'T', date: '', text: '# T\n\n![four](<C:/b/four.jpg> "left")\n\n::pieces{ids="p1" layout="row"}' }];
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes: [], pieces: [piece('p1')], posts });
    const shell = fillShell('<script>window.D=__DATA__</script>', brand, 'fr', data);
    let n = 0;
    const p = await buildPreview(data, [], [piece('p1')], shell, {
      readImage: async (x) => `data:${x}`, readMedia: async () => 'data:video/mp4;base64,AAAA', onProgress: () => {},
      toWebp: async () => 'AAAA', imageKb: 100, blogFiles: blogAssets(posts, [piece('p1')]),
      toUrl: (_b, type) => `blob:${type}#${++n}`,
    });
    expect(p.html).not.toContain('assets/');
    expect(p.html).toContain('src=\\"blob:image/webp#1\\"');
    expect(p.html).toContain('src=\\"blob:image/webp#2\\"');
  });
});

describe('the preview page says when its script stops', () => {
  it('watches for errors first in <head>, before any script of the page runs', () => {
    const html = withErrorWatch('<!doctype html><html><head lang="fr"><script>boot()</script></head><body></body></html>');
    const watch = html.indexOf('__previewErrors'), own = html.indexOf('boot()');
    expect(watch).toBeGreaterThan(html.indexOf('<head lang="fr">'));
    expect(watch).toBeLessThan(own);
    expect(withErrorWatch('<p>x</p>').startsWith('<script>window.__previewErrors')).toBe(true);
  });
});
