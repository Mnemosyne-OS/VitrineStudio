import { ANALYTICS_SCRIPT, blogAssets, buildSiteData, menuDefaults, normalizeMenu, normalizeMenuOrder, exportSite, cellFiles, filmSources, fillShell, livingFallsBack, onlineScenes, siteRows, slugify, type Brand } from './buildSite';
import { LAYERS_MADE } from '../model/sceneLayers';
import { defaultShow } from '../model/showcase';
import { formatMoney } from '../model/currency';
import { DEFAULT_IDENTITY } from './logo';
import { filmOf } from '../model/film';
import { profileById } from '../model/profiles';
import { newFilm, type Film } from '../model/filmRecord';
import type { Piece, Scene } from '../model/types';

const piece = (id: string, over: Partial<Piece> = {}): Piece => ({ schema: 1, id, name: `Piece ${id}`, kind: 'unique', tags: [], photoPath: `C:/p/${id}.jpg`, ...over });
const scene = (id: string, over: Partial<Scene> = {}): Scene => ({
  schema: 1, id, pieceId: 'p1', universe: 'Salon', variant: `V ${id}`, placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9',
  images: { place: `C:/g/${id}a.png`, piece: `C:/g/${id}b.png`, alive: `C:/g/${id}c.png` }, validated: true, createdAt: `2026-10-0${id}T00:00:00Z`, updatedAt: '', ...over,
});
const brand: Brand = { accent: '#5F5A53', ink: '#2B2926', paper: '#EEECE7', name: 'Atelier <Test>', tagline: '', about: '', email: '', instagram: '', introLine: '', portraitCaption: '', contactNote: '', formspree: '' };

describe('site rows', () => {
  it('puts only VALIDATED scenes online, one row per place, in the order they were made', () => {
    const rows = siteRows([scene('3', { universe: 'Jardin' }), scene('1'), scene('2', { validated: false }), scene('4')], [piece('p1')], 'Sans lieu');
    expect(rows.map((r) => [r.name, r.scenes.map((s) => s.id)])).toEqual([['Salon', ['1', '4']], ['Jardin', ['3']]]);
  });
  it('follows the order she set inside a place, the unplaced ones after', () => {
    const rows = siteRows([scene('1'), scene('4'), scene('5')], [piece('p1')], 'Sans lieu', ['5', '1']);
    expect(rows[0]!.scenes.map((s) => s.id)).toEqual(['5', '1', '4']);
  });
  it('carries the part of the clip she kept, and nothing when she kept all of it', () => {
    const full = { place: '/p.png', piece: '/q.png', alive: '/a.png' };
    const rows = siteRows([scene('1', { images: full, clipPath: '/c.mp4', clipCut: { in: 0.5, out: 5 } }), scene('2', { images: full, clipPath: '/d.mp4' })], [piece('p1')], 'x');
    expect(rows[0]!.scenes.map((s) => s.cut)).toEqual([{ in: 0.5, out: 5 }, undefined]);
  });
  it('takes a SOLD piece off the site with its scenes, and the studio counts what the site shows', () => {
    const scenes = [scene('1'), scene('2', { pieceId: 'p2' })];
    const pieces = [piece('p1'), piece('p2', { status: 'sold' })];
    expect(siteRows(scenes, pieces, 'x').flatMap((r) => r.scenes.map((s) => s.id))).toEqual(['1']);
    expect(onlineScenes(scenes, pieces).map((s) => s.id)).toEqual(['1']);
  });
  it('lists only the beats that exist, and never a scene with no place', () => {
    const rows = siteRows([scene('1', { images: { place: 'a', piece: 'b' } }), scene('2', { images: {} })], [piece('p1')], 'Sans lieu');
    expect(rows[0]!.scenes.map((s) => Object.keys(s.images))).toEqual([['place', 'piece']]);
  });
});

describe('site data', () => {
  it('shows the blog newest first, dated in the site language, and the creations of the scenes online still for sale', () => {
    const data = buildSiteData({
      brand, lang: 'fr', today: '2026-10-09', untitled: 'x',
      scenes: [scene('1'), scene('2', { pieceId: 'p2' }), scene('3', { pieceId: 'p3', validated: false })],
      pieces: [piece('p1'), piece('p2', { status: 'sold' }), piece('p3')],
      posts: [
        { id: 'a', title: 'Ancien', date: '2026-06-12', text: '# T\n\na' },
        { id: 'b', title: 'Récent', date: '2026-10-01', text: '# T\n\nb' },
        { id: 'c', title: 'Sans date', date: '', text: '# T\n\nc' },
      ],
    });
    expect(data.posts!.map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(data.posts![1]!.when).toBe('12 juin 2026');
    expect(data.posts![2]!.when).toBeUndefined();
    expect(data.posts![0]!.html).toBe('<p>b</p>');
    expect(data.creations.map((c) => c.id)).toEqual(['p1']);
    expect(buildSiteData({ brand, lang: 'fr', today: '2026-10-09', untitled: 'x', scenes: [], pieces: [] }).posts).toBeUndefined();
  });

  it('names the menu as she renamed it, an empty or unknown entry keeping the site\'s word', () => {
    const texts = (menu: unknown) => buildSiteData({ brand, lang: 'fr', today: '2026-10-09', untitled: 'x', scenes: [], pieces: [], menu: normalizeMenu(menu) }).texts;
    const t = texts({ creations: '  Mes   pièces ', about: '   ', blog: 'Journal', shop: 'Boutique' });
    expect([t.creations, t.about, t.blog, t.contact]).toEqual(['Mes pièces', 'À propos', 'Journal', 'Contact']);
    expect(t.shop).toBeUndefined();
    expect(normalizeMenu({ contact: 'x'.repeat(60) }).contact).toHaveLength(40);
    expect(menuDefaults('en')).toEqual({ creations: 'Creations', about: 'About', blog: 'Blog', contact: 'Contact' });
  });

  it('puts the menu in the order she dragged it, the entries she left out after', () => {
    expect(normalizeMenuOrder(['contact', 'blog', 'contact', 'shop'])).toEqual(['contact', 'blog', 'creations', 'about']);
    expect(normalizeMenuOrder('nope')).toEqual([]);
    const order = (menuOrder: unknown) => buildSiteData({ brand, lang: 'fr', today: '2026-10-09', untitled: 'x', scenes: [], pieces: [], menuOrder: normalizeMenuOrder(menuOrder) }).menuOrder;
    expect(order(['about', 'creations'])).toEqual(['a-propos', 'creations', 'blog', 'contact']);
    expect(order([])).toBeUndefined();
  });

  it('puts a post\'s pictures and pieces on the page, and names every file the export writes for them', () => {
    const text = '# T\n\n![four](<C:/D/a b/four.jpg> "left")\n\nÀ côté.\n\n![](C:/D/two.jpg)\n\n::pieces{ids="p1,gone" layout="column"}\n\n::pieces{ids="p1,p2" layout="row"}';
    const pieces = [piece('p1', { price: 45 }), piece('p2')];
    // The price shows where the piece shows it on the Creations page: p1 does, p2 keeps the default (hidden).
    const showcase = { p1: { photos: [], show: { name: true, description: true, dimensions: false, weight: false, price: true, photos: false } } };
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-10-09', untitled: 'x', scenes: [], pieces, showcase, posts: [{ id: 'post-1', title: 'T', date: '', text }] });
    const html = data.posts![0]!.html;
    expect(html.split(formatMoney(45, 'fr', 'EUR')).length).toBe(3);
    // Its tile: its first photo, its first words, at least a minute to read.
    expect(data.posts![0]).toMatchObject({ cover: 'assets/blog-post-1-1.webp', excerpt: 'À côté.', minutes: 1 });
    // No photo: the first creation it shows. Neither: no cover.
    const only = (t: string) => buildSiteData({ brand, lang: 'fr', today: '2026-10-09', untitled: 'x', scenes: [], pieces, posts: [{ id: 'q', title: 'T', date: '', text: t }] }).posts![0]!;
    expect(only('# T\n\n::pieces{ids="gone,p2" layout="row"}').cover).toBe('assets/creation-p2.webp');
    expect(only('# T\n\nMots.').cover).toBeUndefined();
    expect(html).toContain('<figure class="post-img left"><img src="assets/blog-post-1-1.webp" alt="four"');
    expect(html).toContain('<figure class="post-img full"><img src="assets/blog-post-1-2.webp"');
    // A piece that is gone leaves the block; one piece left is shown on its own.
    expect(html).toContain('<div class="post-pieces single"><figure><img src="assets/creation-p1.webp"');
    expect(html).toContain('<div class="post-pieces row">');
    expect(html).toContain(formatMoney(45, 'fr', 'EUR'));
    expect(blogAssets([{ id: 'post-1', text }], pieces)).toEqual([
      { name: 'assets/blog-post-1-1.webp', path: 'C:/D/a b/four.jpg' },
      { name: 'assets/blog-post-1-2.webp', path: 'C:/D/two.jpg' },
      { name: 'assets/creation-p1.webp', path: 'C:/p/p1.jpg' },
      { name: 'assets/creation-p2.webp', path: 'C:/p/p2.jpg' },
    ]);
  });
});

describe('shell', () => {
  it('escapes the brand in the title', () => {
    expect(fillShell('<title>__TITLE__</title>', brand, 'fr')).toBe('<title>Atelier &lt;Test&gt;</title>');
    // The person's colours, everywhere the template asks; a malformed one falls back, never reaches the CSS.
    expect(fillShell('__INK__ __PAPER__ __INK__', { ...brand, ink: '#112233', paper: '#fafafa' }, 'fr')).toBe('#112233 #fafafa #112233');
    expect(fillShell('__INK__ __PAPER__', { ...brand, ink: 'red;}', paper: '' }, 'fr')).toBe('#2B2926 #EEECE7');
  });
  it('loads the visit counter only when she turned it on', () => {
    const page = '<head><title>x</title></head><body></body>';
    expect(fillShell(page, brand, 'fr')).not.toContain('insights');
    expect(fillShell(page, brand, 'fr', { analytics: true } as never)).toContain(`${ANALYTICS_SCRIPT}
</head>`);
  });
  it('slugifies a brand into a project name', () => {
    expect(slugify('Atelier Rosalie — Céramique')).toBe('atelier-rosalie-ceramique');
  });
});

describe('export', () => {
  it('reads each picture once, writes both sizes, and the page LAST', async () => {
    const scenes = [scene('1')];
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')] });
    const read = vi.fn(async (p: string) => `data:${p}`);
    const saved: string[] = [];
    await exportSite(data, scenes, [piece('p1')], '<html>', { readImage: read, readMedia: async () => 'data:video/mp4;base64,AAAA', toWebp: async () => 'AAAA', save: async (n) => { saved.push(n); }, onProgress: () => {} });
    expect(read).toHaveBeenCalledTimes(4); // 3 beats + the creation photo
    expect(saved).toContain('assets/1-place-s.webp');
    expect(saved).toContain('assets/1-place-l.webp');
    expect(saved.slice(-2)).toEqual(['data.json', 'index.html']);
  });
  it('sends the large pictures at the width and quality chosen, the small ones always at 800 px', async () => {
    const scenes = [scene('1')];
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')] });
    const asked = async (quality?: 'standard' | 'high' | 'max') => {
      const calls: string[] = [];
      await exportSite(data, scenes, [piece('p1')], '<html>', {
        readImage: async (p) => `data:${p}`, readMedia: async () => 'd', save: async () => {}, onProgress: () => {},
        toWebp: async (_d, width, q) => { calls.push(`${width}@${q}`); return 'AAAA'; },
        ...(quality ? { quality } : {}),
      });
      return [...new Set(calls)].sort();
    };
    expect(await asked()).toEqual(['1600@0.85', '800@0.85']);
    expect(await asked('high')).toEqual(['2560@0.9', '800@0.9']);
    expect(await asked('max')).toEqual(['3840@0.92', '800@0.92']);
  });
  it('asks each picture to fit the weight chosen (phones 40 % of it) and measures what it wrote', async () => {
    const scenes = [scene('1')];
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')] });
    const budgets = new Set<number | undefined>();
    const res = await exportSite(data, scenes, [piece('p1')], '<html>', {
      readImage: async (p) => `data:${p}`, readMedia: async () => 'data:video/mp4;base64,AAAA', save: async () => {}, onProgress: () => {},
      toWebp: async (_d, _w, _q, max) => { budgets.add(max); return 'AAAA'; },
      imageKb: 100,
    });
    expect([...budgets].sort()).toEqual([100_000, 40_000]);
    // 3 beats x 2 sizes + 1 creation = 7 pictures of 3 bytes each.
    expect(res.imageBytes).toBe(21);
    expect(res.bytes).toBeGreaterThan(res.imageBytes);
  });
  it('writes a picture logo sharp, never shrunk to the weight limit', async () => {
    const scenes = [scene('1')];
    const identity = { ...DEFAULT_IDENTITY, logoPath: 'C:/logo.png' };
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')], identity });
    const calls: Record<string, [number | undefined, number | undefined]> = {};
    await exportSite(data, scenes, [piece('p1')], '<html>', {
      readImage: async (p) => p, readMedia: async () => 'd', save: async () => {}, onProgress: () => {}, imageKb: 50, logoPath: 'C:/logo.png',
      toWebp: async (src, _w, q, max) => { calls[src] = [q, max]; return 'AAAA'; },
    });
    expect(calls['C:/logo.png']).toEqual([0.92, undefined]);
  });
  it('never lets a text close the page script: "</" is escaped in the inline data', () => {
    const scenes = [scene('1')];
    const data = buildSiteData({ brand: { ...brand, about: '</script><script>alert(1)</script>' }, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')] });
    const page = fillShell('<script type="application/json">__DATA__</script>', brand, 'fr', data);
    expect(page).not.toContain('</script><script>alert(1)');
    expect(page.match(/<\/script>/g)).toHaveLength(1);
  });
  it('stops at the first refusal and never writes the page', async () => {
    const scenes = [scene('1')];
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')] });
    const saved: string[] = [];
    await expect(exportSite(data, scenes, [piece('p1')], '<html>', {
      readImage: async () => 'd', readMedia: async () => 'd', toWebp: async () => { throw new Error('WEBP_NOT_SUPPORTED'); }, save: async (n) => { saved.push(n); }, onProgress: () => {},
    })).rejects.toThrow('WEBP_NOT_SUPPORTED');
    expect(saved).not.toContain('index.html');
  });
});

describe('home film', () => {
  const steps = filmOf(profileById('ceramics-plants')).steps;
  const full = (over: Partial<Film> = {}): Film => ({
    ...newFilm('ceramics-plants', '16:9'),
    keyframes: Object.fromEntries(steps.map((s) => [s.id, `C:/k/${s.id}.png`])),
    clips: Object.fromEntries(steps.slice(1).map((s) => [s.id, `C:/v/${s.id}.mp4`])),
    validated: true,
    ...over,
  });

  it('goes online only validated and complete, clips in the order of the chain', () => {
    expect(filmSources(full({ validated: false }), steps)).toBeNull();
    expect(filmSources(full({ clips: {} }), steps)).toBeNull();
    expect(filmSources(null, steps)).toBeNull();
    const src = filmSources(full(), steps)!;
    expect(src.poster).toBe('C:/k/workshop.png');
    expect(src.clips.map((c) => c.path)).toEqual(steps.slice(1).map((s) => `C:/v/${s.id}.mp4`));
  });

  it('keeps the original when the web copy comes out heavier (a short clip already light)', async () => {
    const scenes = [scene('1')];
    const film = filmSources(full(), steps);
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')], film });
    const written = new Map<string, string>();
    // The copy of the first clip is heavier, the others lighter.
    const readMedia = async (p: string) => (p.endsWith('-web.mp4') ? (p.includes(film!.clips[0]!.path.replace('.mp4', '')) ? 'data:video/mp4;base64,BBBBBBBB' : 'data:video/mp4;base64,CC') : 'data:video/mp4;base64,AAAA');
    await exportSite(data, scenes, [piece('p1')], '<html>', { readImage: async (p) => `data:${p}`, readMedia, toWebp: async () => 'AAAA', save: async (n, b) => { written.set(n, b); }, onProgress: () => {}, webClip: async (p) => p.replace('.mp4', '-web.mp4') }, film);
    const clipFiles = data.film!.clips;
    expect(written.get(clipFiles[0]!)).toBe('AAAA');
    expect(written.get(clipFiles[1]!)).toBe('CC');
  });

  it('sends a lighter copy of each clip when one is made, the clip itself untouched, and counts the ones sent heavy', async () => {
    const scenes = [scene('1')];
    const film = filmSources(full(), steps);
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')], film });
    const read: string[] = [];
    const base = { readImage: async (p: string) => `data:${p}`, readMedia: async (p: string) => { read.push(p); return 'data:video/mp4;base64,AAAA'; }, toWebp: async () => 'AAAA', save: async () => {}, onProgress: () => {} };
    const clips = film!.clips.map((c) => c.path);
    // Every clip made lighter: the copies are read, never the rushes.
    let res = await exportSite(data, scenes, [piece('p1')], '<html>', { ...base, webClip: async (p) => p.replace('.mp4', '-web.mp4') }, film);
    // Both read, to keep the lighter one.
    expect(read).toEqual(clips.flatMap((p) => [p, p.replace('.mp4', '-web.mp4')]));
    expect(res.heavyClips).toBeUndefined();
    // One refused, one WebM (the page names an .mp4), one failing: those three go as they are, counted.
    read.length = 0;
    let n = 0;
    res = await exportSite(data, scenes, [piece('p1')], '<html>', { ...base, webClip: async (p) => { n++; if (n === 1) return null; if (n === 2) return p.replace('.mp4', '-web.webm'); if (n === 3) throw new Error('FFMPEG_FAILED'); return p.replace('.mp4', '-web.mp4'); } }, film);
    expect(read.slice(0, 3)).toEqual(clips.slice(0, 3));
    expect(res.heavyClips).toBe(3);
    // Without ffmpeg every clip goes as it is, and says so.
    res = await exportSite(data, scenes, [piece('p1')], '<html>', base, film);
    expect(res.heavyClips).toBe(clips.length);
  });

  it('writes the poster in both sizes and every clip before the page, and nothing without a film', async () => {
    const scenes = [scene('1')];
    const film = filmSources(full(), steps);
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')], film });
    expect(data.film!.clips).toEqual(steps.slice(1).map((s) => `assets/film-${s.id}.mp4`));
    const saved: string[] = [];
    const deps = { readImage: async (p: string) => `data:${p}`, readMedia: async () => 'data:video/mp4;base64,AAAA', toWebp: async () => 'AAAA', save: async (n: string) => { saved.push(n); }, onProgress: () => {} };
    await exportSite(data, scenes, [piece('p1')], '<html>', deps, film);
    expect(saved).toEqual(expect.arrayContaining(['assets/film-poster-s.webp', 'assets/film-poster-l.webp', ...data.film!.clips]));
    expect(saved.slice(-2)).toEqual(['data.json', 'index.html']);

    const plain = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')], film: null });
    expect(plain.film).toBeUndefined();
    saved.length = 0;
    // Sources passed without the data saying so: the page would not play them, so they are not written.
    await exportSite(plain, scenes, [piece('p1')], '<html>', deps, film);
    expect(saved.some((n) => n.includes('film'))).toBe(false);
  });
});

describe('the site kit in the website', () => {
  it('writes the kit pages as they are, before the page that links to them, and lists them in the menu data', async () => {
    const scenes = [scene('1')];
    const links = [{ title: 'L’atelier', href: 'pages/01-atelier.html' }];
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')], links });
    expect(data.links).toEqual(links);
    const saved: Array<[string, string]> = [];
    const res = await exportSite(data, scenes, [piece('p1')], '<html>', {
      readImage: async (p) => `data:${p}`, readMedia: async () => '', toWebp: async () => 'AAAA',
      save: async (n, b) => { saved.push([n, b]); }, onProgress: () => {},
      extraFiles: [{ rel: 'pages/01-atelier.html', base64: 'PGgxPg==' }, { rel: 'pages/img/a.webp', base64: 'UklGRg==' }],
    });
    const names = saved.map(([n]) => n);
    expect(names.slice(-4)).toEqual(['pages/01-atelier.html', 'pages/img/a.webp', 'data.json', 'index.html']);
    expect(saved.find(([n]) => n === 'pages/01-atelier.html')![1]).toBe('PGgxPg==');
    expect(res.files).toBe(names.length);
  });

  it('writes no menu entry when the kit has no page', () => {
    expect(buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes: [], pieces: [], links: [] }).links).toBeUndefined();
  });
});

describe('the page Atelier Rosalie made for every artisan', () => {
  it('never puts the portrait path online: the site gets its own file, written sharp', async () => {
    const scenes = [scene('1')];
    const b = { ...brand, portrait: 'C:/Users/tony/claire.jpg', introLine: 'Je façonne', portraitCaption: 'Claire', contactNote: 'Lettre' };
    const data = buildSiteData({ brand: b, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')] });
    expect(JSON.stringify(data)).not.toContain('C:/Users/tony');
    expect(data.portrait).toBe('assets/portrait.webp');
    expect(data.brand.introLine).toBe('Je façonne');
    const toWebp = vi.fn(async () => 'AAAA');
    const saved: string[] = [];
    await exportSite(data, scenes, [piece('p1')], '<html>', { readImage: async (p) => `data:${p}`, readMedia: async () => '', toWebp, save: async (n) => { saved.push(n); }, onProgress: () => {}, portraitPath: b.portrait, imageKb: 100 });
    expect(saved).toContain('assets/portrait.webp');
    expect(toWebp).toHaveBeenCalledWith('data:C:/Users/tony/claire.jpg', 800, 0.92);
  });

  it('names the three beats as the trade does, and keeps the default names otherwise', () => {
    const d = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes: [], pieces: [], beats: { place: 'Le lieu', piece: 'La lampe', alive: 'La lumière' } });
    expect([d.texts.place, d.texts.piece, d.texts.alive]).toEqual(['Le lieu', 'La lampe', 'La lumière']);
    expect(buildSiteData({ brand, lang: 'en', today: '2026-01-01', untitled: 'x', scenes: [], pieces: [] }).texts.alive).toBe('The living');
  });

  it('carries its font inside the page (a real woff2) and loads nothing from a third party', async () => {
    const tpl = (await import('./template.html?raw')).default;
    // The two addresses the page names are links a visitor follows or sends to: nothing is loaded from them.
    expect(tpl).not.toMatch(/fonts\.googleapis|fonts\.gstatic|https?:\/\/(?!instagram\.com|formspree\.io\/f\/\$\{)/);
    const page = fillShell(tpl, brand, 'fr');
    const font = /url\("data:font\/woff2;base64,([A-Za-z0-9+/=]+)"\)/.exec(page);
    expect(atob(font![1]!).slice(0, 4)).toBe('wOF2');
    const { SITE_FONT_FILES } = await import('./fonts');
    expect(atob(SITE_FONT_FILES.find((f) => f.rel === 'assets/jost-OFL.txt')!.base64)).toContain('SIL Open Font License');
  });
});

describe('what the export asks the host to write', () => {
  // The host's own list (main/site/siteAssets.ts): a name outside it is refused, and the
  // export stops before the page. A .woff2 sent with every export stopped every export once.
  it('is only files the host writes into a site folder', async () => {
    const { SITE_FONT_FILES } = await import('./fonts');
    const { KIT_EXTENSIONS } = await import('../model/kit');
    const scenes = [scene('1', { clipPath: 'C:/c/1.mp4' })];
    const data = buildSiteData({ brand: { ...brand, portrait: 'C:/p.jpg' }, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')], identity: { ...DEFAULT_IDENTITY, logoPath: 'C:/logo.png' } });
    const saved: string[] = [];
    await exportSite(data, scenes, [piece('p1')], '<html>', {
      readImage: async (p) => `data:${p}`, readMedia: async () => 'data:video/mp4;base64,AAAA', toWebp: async () => 'AAAA',
      save: async (n) => { saved.push(n); }, onProgress: () => {}, logoPath: 'C:/logo.png', portraitPath: 'C:/p.jpg',
      extraFiles: [...SITE_FONT_FILES, { rel: 'pages/a.html', base64: 'PA==' }],
    });
    expect(saved.length).toBeGreaterThan(6);
    for (const name of saved) expect(KIT_EXTENSIONS).toContain(name.slice(name.lastIndexOf('.') + 1));
  });
});

describe('the contact form through Formspree', () => {
  it('reads the id from the address or the id alone, and refuses anything else', async () => {
    const { formspreeId } = await import('./buildSite');
    expect(formspreeId('https://formspree.io/f/xyzabcd')).toBe('xyzabcd');
    expect(formspreeId(' formspree.io/f/xyzabcd/ ')).toBe('xyzabcd');
    expect(formspreeId('xyzabcd')).toBe('xyzabcd');
    expect(formspreeId('')).toBe('');
    for (const bad of ['https://evil.example/f/xyzabcd', 'https://formspree.io/f/../x', 'mailto:a@b.c', 'xyz']) expect(formspreeId(bad)).toBeNull();
  });

  it('keeps only a valid id in the settings and carries it in the kit', async () => {
    const { normalizeSiteSettings } = await import('../model/records');
    expect(normalizeSiteSettings({ brand: { formspree: 'https://formspree.io/f/xyzabcd' } }, 'x').brand.formspree).toBe('xyzabcd');
    expect(normalizeSiteSettings({ brand: { formspree: 'https://evil.example/x' } }, 'x').brand.formspree).toBe('');
    const { BRAND_FIELDS } = await import('../model/kit');
    expect(BRAND_FIELDS).toContain('formspree');
  });
});

describe('the pages she added', () => {
  const pages = [
    { id: 'bijoux', type: 'catalogue' as const, name: 'Bijoux' },
    { id: 'jardin', type: 'scenes' as const, name: 'Jardin' },
    { id: 'journal', type: 'blog' as const, name: 'Journal' },
    { id: 'vide', type: 'catalogue' as const, name: 'Vide' },
  ];
  const pieces = [piece('p1'), piece('p2', { pageId: 'bijoux' })];
  const scenes = [scene('1'), scene('2', { pageId: 'jardin' })];
  const posts = [{ id: 'a', title: 'A', date: '2026-10-01', text: 'x' }, { id: 'b', title: 'B', date: '2026-10-02', text: 'y', pageId: 'journal' }];
  const data = buildSiteData({ brand, lang: 'fr', today: '2026-10-09', untitled: 'x', scenes, pieces, posts, showcase: { p1: { ...defaultShow(), onPage: true }, p2: { ...defaultShow(), onPage: true } }, pages });

  it('keeps each page\'s own content on it, and an empty page off the site', () => {
    expect(data.rows.flatMap((r) => r.scenes.map((s) => s.id))).toEqual(['1']);
    expect(data.creations.map((c) => c.id)).toEqual(['p1']);
    expect(data.posts?.map((p) => p.id)).toEqual(['a']);
    expect(data.pages?.map((p) => [p.id, p.rows?.flatMap((r) => r.scenes.map((s) => s.id)) ?? p.creations?.map((c) => c.id) ?? p.posts?.map((x) => x.id)])).toEqual([['bijoux', ['p2']], ['jardin', ['2']], ['journal', ['b']]]);
  });

  it('writes every page\'s pictures and clips', async () => {
    const saved: string[] = [];
    await exportSite(data, scenes, pieces, '<html>', { readImage: async () => 'data:image/png;base64,AAAA', readMedia: async () => 'data:video/mp4;base64,AAAA', toWebp: async () => 'AAAA', save: async (n) => { saved.push(n); }, onProgress: () => {} });
    expect(saved).toEqual(expect.arrayContaining(['assets/creation-p2.webp', 'assets/2-place-l.webp']));
  });

  it('leaves a site without added pages as it was', () => {
    expect(buildSiteData({ brand, lang: 'fr', today: '2026-10-09', untitled: 'x', scenes, pieces: [piece('p1')] }).pages).toBeUndefined();
  });
});

describe('a text page and a form page on the site', () => {
  const pages = [
    { id: 'atelier', type: 'text' as const, name: 'L’atelier', text: '## Le lieu\n\nUn **four**.', photo: 'C:/p.jpg', layout: 'left' as const },
    { id: 'vide', type: 'text' as const, name: 'Vide' },
    { id: 'inscription', type: 'form' as const, name: 'Inscription', fields: [{ id: 'n', label: 'Nom', kind: 'text' as const, required: true }] },
    { id: 'sans', type: 'form' as const, name: 'Sans champ', fields: [] },
  ];
  const data = buildSiteData({ brand, lang: 'fr', today: '2026-10-09', untitled: 'x', scenes: [], pieces: [], pages });

  it('carries the words formatted, the picture by its site name, the fields; an empty page stays off', () => {
    expect(data.pages?.map((p) => p.id)).toEqual(['atelier', 'inscription']);
    expect(data.pages?.[0]).toMatchObject({ html: '<h3>Le lieu</h3><p>Un <strong>four</strong>.</p>', photo: 'assets/page-atelier.webp', layout: 'left' });
    expect(data.pages?.[1]?.fields?.[0]?.label).toBe('Nom');
  });

  it('writes a text page\'s picture', async () => {
    const saved: string[] = [];
    await exportSite(data, [], [], '<html>', { readImage: async () => 'data:image/png;base64,AAAA', readMedia: async () => '', toWebp: async () => 'AAAA', save: async (n) => { saved.push(n); }, onProgress: () => {}, pagePhotos: [{ name: 'assets/page-atelier.webp', path: 'C:/p.jpg' }] });
    expect(saved).toContain('assets/page-atelier.webp');
  });
});

describe('the loupe and the frame', () => {
  const shown = { p1: { ...defaultShow(), onPage: true } };
  it('gives each creation a large copy only with a loupe on, and writes it at the large width', async () => {
    const plain = buildSiteData({ brand, lang: 'fr', today: '2026-10-09', untitled: 'x', scenes: [], pieces: [piece('p1')], showcase: shown, viewer: { loupe: 'none', frame: 'none' } });
    expect(plain.viewer).toBeUndefined();
    expect(plain.creations[0]?.zoom).toBeUndefined();
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-10-09', untitled: 'x', scenes: [], pieces: [piece('p1')], showcase: shown, viewer: { loupe: 'lens', frame: 'shadow' } });
    expect(data.viewer).toEqual({ loupe: 'lens', frame: 'shadow' });
    expect(data.creations[0]?.zoom).toEqual(['assets/creation-p1-z.webp']);
    const jobs: Array<[string, number]> = [];
    let w = 0;
    await exportSite(data, [], [piece('p1')], '<html>', { readImage: async () => 'data:image/png;base64,AAAA', readMedia: async () => '', toWebp: async (_u, width) => { w = width; return 'AAAA'; }, save: async (n) => { if (n.endsWith('.webp')) jobs.push([n, w]); }, onProgress: () => {}, quality: 'high' });
    expect(jobs).toEqual(expect.arrayContaining([['assets/creation-p1-z.webp', 2560], ['assets/creation-p1.webp', 800]]));
  });
});
describe('the loupe copy and the added form', () => {
  it('weighs a loupe copy four times a large picture: grown 2.5 times, it must stay sharp', async () => {
    const shown = { p1: { ...defaultShow(), onPage: true } };
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-10-11', untitled: 'x', scenes: [], pieces: [piece('p1')], showcase: shown, viewer: { loupe: 'zoom', frame: 'none' } });
    const max: Record<string, number | undefined> = {};
    let m: number | undefined;
    await exportSite(data, [], [piece('p1')], '<html>', { readImage: async () => 'data:image/png;base64,AAAA', readMedia: async () => '', toWebp: async (_u, _w, _q, b) => { m = b; return 'AAAA'; }, save: async (n) => { max[n] = m; }, onProgress: () => {}, imageKb: 100 });
    expect(max['assets/creation-p1-z.webp']).toBe(400_000);
    expect(max['assets/creation-p1.webp']).toBe(40_000);
  });
  it('draws a form page only when its answers go somewhere (an e-mail or Formspree)', async () => {
    const tpl = (await import('./template.html?raw')).default;
    expect(tpl).toContain("else if (p.type === 'form') pages.push({ id: p.id, title: p.title, html: `<div class=\"cols contact-${esc(p.layout || 'left')}\">${B.email || B.formspree ? `<form class=\"mail\"");
  });
});

describe('a living scene on the site', () => {
  const box = (path: string, x: number) => ({ path, x, y: 40, w: 20, h: 30 });
  const layers = (id: string) => ({
    from: { place: `C:/g/${id}a.png`, piece: `C:/g/${id}b.png`, alive: `C:/g/${id}c.png` },
    pot: box('C:/l/pot.png', 40), potAlive: box('C:/l/pa.png', 30), shadowAlive: box('C:/l/sa.png', 35),
    swayMap: 'C:/l/map.png', room: 'C:/l/room.webp', pivot: { x: 50, y: 40 }, made: LAYERS_MADE, madeAt: '2026-10-12T00:00:00Z',
  });

  it('opens ON its life: no place-then-piece beats, which showed the cut (field, 2026-10-12)', async () => {
    const tpl = (await import('./template.html?raw')).default;
    const play = tpl.slice(tpl.indexOf('function play(el)'), tpl.indexOf("step(1, 'lit', 50);"));
    // The living branch sets every beat at once and returns before the timed steps.
    expect(play).toContain("el.classList.add('living', 'lit', 'piece', 'alive');");
    expect(play).toMatch(/el\.classList\.add\('living'[^]*return;\s*\}\s*$/);
    // Its layers appear without a fade: no empty room, no piece laid on it.
    expect(tpl).toContain('.cell.living .room .la, .cell.living .room .las { opacity: 1; transition: none; }');
    expect(tpl).toContain('.cell.living .room .lp, .cell.living .room .lps { opacity: 0; transition: none; }');
  });

  it('lays the shadows on the room and both depths at one scale, so nothing slides beside its place at rest', async () => {
    const tpl = (await import('./template.html?raw')).default;
    // The shadows are in the room's depth, the piece and the life in the other.
    expect(tpl).toMatch(/<div class="lb"><img class="lplace sa"[^`]*\$\{lay\(L\.shadowPiece, 'lps'\)\}\$\{lay\(L\.shadowAlive, 'las'\)\}<\/div>/);
    expect(tpl).toContain("`<div class=\"lg\">${lay(L.pot, 'lp')}`");
    expect(tpl).toContain('.room .lay .lb, .room .lay .lg { transform: scale(1.04);');
    // Moved by the pointer, each keeps that scale.
    expect(tpl).toContain("b.style.transform = `scale(1.04) translate(");
    expect(tpl).toContain("g.style.transform = `scale(1.04) translate(");
    // Arriving, before its picture is known: the room covers the cell, cropped like any picture, the layers hidden.
    expect(tpl).toContain('.room .lay { position: absolute; inset: 0; }');
    expect(tpl).toContain('.room .lay:not(.fit) .lb > .lplace { object-fit: cover; object-position: 50% 70%; }');
    expect(tpl).toContain('.room .lay:not(.fit) .lg { visibility: hidden; }');
    expect(tpl).toContain("box.classList.add('fit');");
    // The next rooms' own pictures are fetched ahead, a living room's room and layers included.
    expect(tpl).toContain('s.layers ? [s.layers.room, s.layers.potAlive');
  });

  it('names every file a living room needs, so a light preview never shows it empty', () => {
    const living = scene('1', { motion: 'living', layers: layers('1') });
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes: [living], pieces: [piece('p1')] });
    const files = cellFiles(data.rows[0]!.scenes[0]!, living);
    const byName = new Map(files.map((f) => [f.name, f.path]));
    expect(byName.get('assets/1-layer-room-l.webp')).toBe('C:/l/room.webp');
    expect(byName.get('assets/1-layer-potAlive-s.webp')).toBe('C:/l/pa.png');
    expect(byName.get('assets/1-layer-shadowAlive-l.webp')).toBe('C:/l/sa.png');
    expect(byName.get('assets/1-layer-sway-s.webp')).toBe('C:/l/map.png');
    expect(byName.get('assets/1-place-s.webp')).toBe(living.images.place);
    // Every name the page will ask for is there.
    const asked = JSON.stringify(data.rows[0]!.scenes[0]!).match(/assets\/[^"]+/g)!;
    for (const n of asked) expect(byName.has(n)).toBe(true);
  });

  it('counts the scenes chosen Living whose layers are stale or missing: they go as pictures', () => {
    const fresh = scene('1', { motion: 'living', layers: layers('1') });
    expect(livingFallsBack([fresh])).toBe(0);
    expect(livingFallsBack([fresh, scene('2', { motion: 'living', layers: { ...layers('2'), made: undefined } }), scene('3', { motion: 'living' }), scene('4', { motion: 'images' })])).toBe(2);
  });

  it('sends its place and its layers, not its pictures 2 and 3 nor its clip', async () => {
    const scenes = [scene('1', { motion: 'living', layers: layers('1'), clipPath: 'C:/c/1.mp4' })];
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')] });
    const cell = data.rows[0]!.scenes[0]!;
    expect(Object.keys(cell.images)).toEqual(['place']);
    expect(cell.clip).toBeUndefined();
    expect(cell.layers).toMatchObject({ pot: { s: 'assets/1-layer-pot-s.webp', x: 40 }, potAlive: { l: 'assets/1-layer-potAlive-l.webp' }, sway: { s: 'assets/1-layer-sway-s.webp' }, pivot: { x: 50, y: 40 } });
    expect(cell.layers!.shadowPiece).toBeUndefined();
    const written: Array<[string, number, number | undefined]> = [];
    await exportSite(data, scenes, [piece('p1')], '<html>', {
      readImage: async (p) => `data:${p}`, readMedia: async () => 'd', save: async () => {}, onProgress: () => {}, imageKb: 50,
      toWebp: async (d, w, _q, max) => { written.push([d, w, max]); return 'AAAA'; },
    });
    // Each layer at the width its box takes in a picture of that size, sharp, never held to the weight limit.
    expect(written).toContainEqual(['data:C:/l/pot.png', 160, undefined]);
    expect(written).toContainEqual(['data:C:/l/map.png', 320, undefined]);
    // The room under the layers is a whole picture, held to the weight she chose.
    expect(written).toContainEqual(['data:C:/l/room.webp', 800, 20_000]);
    expect(cell.layers!.room).toEqual({ s: 'assets/1-layer-room-s.webp', l: 'assets/1-layer-room-l.webp' });
    expect(written.some(([d]) => d === 'data:C:/g/1b.png')).toBe(false);
  });

  it('goes back to its pictures when a beat was redone after the layers, or when they were never made', () => {
    const stale = scene('1', { motion: 'living', layers: { ...layers('1'), from: { ...layers('1').from, piece: 'C:/g/old.png' } } });
    const never = scene('2', { motion: 'living' });
    const data = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes: [stale, never], pieces: [piece('p1')] });
    for (const cell of data.rows[0]!.scenes) {
      expect(cell.layers).toBeUndefined();
      expect(Object.keys(cell.images)).toEqual(['place', 'piece', 'alive']);
    }
  });

  it('keeps the clip for the video choice and for a scene that never chose, and drops it for « pictures »', () => {
    const rows = (motion?: Scene['motion']) => buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes: [scene('1', { clipPath: 'C:/c/1.mp4', ...(motion ? { motion } : {}) })], pieces: [piece('p1')] }).rows[0]!.scenes[0]!;
    expect(rows().clip).toBeDefined();
    expect(rows('video').clip).toBeDefined();
    expect(rows('images').clip).toBeUndefined();
  });
});
