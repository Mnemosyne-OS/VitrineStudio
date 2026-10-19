import { defaultShow, formatSize, formatMass, inPieceOrder, measure, measureRows, moveId, normalizeCategories, normalizePieceOrder, reorderSome, normalizeHover, normalizeShowcase, onCreationsPage, PHOTOS_MAX, scaleLine } from './showcase';
import { formatMoney } from './currency';
import { buildSiteData, exportSite, type Brand } from '../site/buildSite';
import { backdropPrompt } from '../data/photoEdit';
import { mergeShowcase, readKit, KIT_SCHEMA, needsFolder } from './kit';
import { normalizeSiteSettings } from './records';
import type { Piece, Scene } from './types';

const brand: Brand = { accent: '#5F5A53', ink: '#2B2926', paper: '#EEECE7', name: 'Atelier', tagline: '', about: '', email: '', instagram: '', introLine: '', portraitCaption: '', contactNote: '', formspree: '' };
const piece = (id: string, over: Partial<Piece> = {}): Piece => ({ schema: 1, id, name: `Vase ${id}`, kind: 'unique', tags: [], photoPath: `C:/p/${id}.jpg`, description: 'Grès brut', price: 45, ...over });
const scene = (id: string, pieceId: string): Scene => ({
  schema: 1, id, pieceId, universe: 'Salon', variant: 'V', placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9',
  images: { place: `C:/g/${id}a.png` }, validated: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '',
});
const site = (showcase: Record<string, unknown>, hover?: string) => normalizeSiteSettings({ showcase, creationsHover: hover }, 'x');

describe('the Creations page, piece by piece', () => {
  const scenes = [scene('1', 'p1'), scene('2', 'p2')];
  const pieces = [piece('p1'), piece('p2')];
  const data = (showcase: Record<string, unknown>, hover?: string) => {
    const s = site(showcase, hover);
    return buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces, showcase: s.showcase, hover: s.creationsHover });
  };

  it('puts on the page the pieces she chose, else those with a scene online and not sold, never one without a photo', () => {
    const all = [piece('p1'), piece('p2'), piece('p3'), piece('p4', { status: 'sold' }), piece('p5', { photoPath: undefined })];
    const scenes4 = [scene('1', 'p1'), scene('2', 'p2'), scene('4', 'p4'), scene('5', 'p5')];
    const page = (showcase: Record<string, unknown>) => buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes: scenes4, pieces: all, showcase: site(showcase).showcase }).creations.map((c) => c.id);
    // Untouched: as the page always decided (p3 has no scene, p4 is sold, p5 has no photo).
    expect(page({})).toEqual(['p1', 'p2']);
    // Her choice wins both ways: a piece without a scene, a sold one, one taken off.
    expect(page({ p2: { onPage: false }, p3: { onPage: true }, p4: { onPage: true }, p5: { onPage: true } })).toEqual(['p1', 'p3', 'p4']);
    expect(onCreationsPage(piece('p9'), undefined, new Set(['p9']))).toBe(true);
    expect(onCreationsPage(piece('p9', { photoPath: undefined }), { ...defaultShow(), onPage: true }, new Set())).toBe(false);
    // Read back: only a real choice is kept.
    expect(site({ a: { onPage: 'yes' }, b: { onPage: false } }).showcase).toMatchObject({ a: { photos: [] }, b: { onPage: false } });
    expect(site({ a: { onPage: 'yes' } }).showcase.a!.onPage).toBeUndefined();
  });

  it('files the creations under her categories; the page filters on those that hold one', () => {
    expect(normalizeCategories([{ id: 'vases', name: '  Vases ' }, { id: 'vases', name: 'Bis' }, { id: '../x', name: 'X' }, { id: 'pots', name: ' ' }, { id: 'new', name: 'Nouveautés' }]))
      .toEqual([{ id: 'vases', name: 'Vases' }, { id: 'new', name: 'Nouveautés' }]);
    const categories = [{ id: 'vases', name: 'Vases' }, { id: 'empty', name: 'Vide' }, { id: 'new', name: 'Nouveautés' }];
    const s = site({ p1: { cats: ['new', 'vases', 'gone'] }, p2: { cats: ['vases'] } });
    const d = buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces, showcase: s.showcase, categories });
    // In her order, only those that hold a creation; a piece keeps only the categories that exist.
    expect(d.categories).toEqual([{ id: 'vases', name: 'Vases' }, { id: 'new', name: 'Nouveautés' }]);
    expect(d.creations.map((c) => c.cats)).toEqual([['new', 'vases'], ['vases']]);
    expect(d.texts.allCats).toBe('Tout');
    expect(buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces, showcase: s.showcase }).categories).toBeUndefined();
  });

  it('puts the pieces in the order she set, here and on the page', () => {
    const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
    // Placed ones first, in her order; the others after, as they came.
    expect(inPieceOrder(items, ['c', 'a', 'gone']).map((x) => x.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(moveId(['a', 'b', 'c', 'd'], 'd', 'b', false)).toEqual(['a', 'd', 'b', 'c']);
    expect(moveId(['a', 'b', 'c', 'd'], 'a', 'c', true)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveId(['a', 'b'], 'a', 'a', true)).toEqual(['a', 'b']);
    // The page shows b and d only: their new order fills their places, a and c stay put.
    expect(reorderSome(['a', 'b', 'c', 'd'], ['d', 'b'])).toEqual(['a', 'd', 'c', 'b']);
    expect(normalizePieceOrder(['a', 'a', '../x', 3, 'b'])).toEqual(['a', 'b']);
    const page = (order: string[]) => buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces, pieceOrder: order }).creations.map((c) => c.id);
    expect(page(['p2', 'p1'])).toEqual(['p2', 'p1']);
    expect(page([])).toEqual(['p1', 'p2']);
  });

  it('gives the viewer its measures as rows: length, height, width, weight, only those given and shown', () => {
    const labels = { l: 'Longueur', h: 'Hauteur', w: 'Largeur', weight: 'Poids' };
    const both = { dimensions: true, weight: true };
    expect(measureRows({ l: 9, w: 9.5, h: 28 }, 1250, 'fr', labels, both)).toEqual([['Longueur', '9 cm'], ['Hauteur', '28 cm'], ['Largeur', '9,5 cm'], ['Poids', formatMass(1250, 'fr')]]);
    expect(measureRows({ h: 28 }, undefined, 'fr', labels, both)).toEqual([['Hauteur', '28 cm']]);
    expect(measureRows({ l: 9 }, 780, 'fr', labels, { dimensions: false, weight: true })).toEqual([['Poids', '780 g']]);
    expect(measureRows(undefined, 780, 'fr', labels, { dimensions: true, weight: false })).toEqual([]);
    const c = data({ p1: { size: { l: 9, w: 9, h: 28 }, weight: 780, show: { dimensions: true, weight: true } } }).creations[0]!;
    expect(c.specs).toEqual([['Longueur', '9 cm'], ['Hauteur', '28 cm'], ['Largeur', '9 cm'], ['Poids', '780 g']]);
    expect(data({}).creations[0]!.specs).toBeUndefined();
  });

  it('shows by default what the page always showed: the name and the words, never the price', () => {
    const c = data({}).creations[0]!;
    expect(c).toEqual({ id: 'p1', alt: 'Vase p1', name: 'Vase p1', description: 'Grès brut', images: ['assets/creation-p1.webp'] });
  });

  it('shows each thing only when chosen for that piece, the price in the page language', () => {
    const d = data({ p1: { dimensions: 'Ø 12 cm', photos: ['C:/p/p1b.jpg', 'C:/p/p1c.jpg'], show: { name: false, description: false, dimensions: true, price: true, photos: true } } });
    const [a, b] = d.creations;
    expect(a).toEqual({ id: 'p1', alt: 'Vase p1', dimensions: 'Ø 12 cm', price: formatMoney(45, 'fr', 'EUR'), images: ['assets/creation-p1.webp', 'assets/creation-p1-1.webp', 'assets/creation-p1-2.webp'] });
    expect(b!.price).toBeUndefined();
    expect(JSON.stringify(d)).not.toContain('C:/p/p1b.jpg');
  });

  it('keeps the photos and the size, but not on the site, when they are switched off', () => {
    const c = data({ p1: { photos: ['C:/p/p1b.jpg'], dimensions: 'Ø 9 cm', show: { photos: false, dimensions: false } } }).creations[0]!;
    expect(c.images).toEqual(['assets/creation-p1.webp']);
    expect(c.dimensions).toBeUndefined();
  });

  it('writes every further photo it names, from its path on disk', async () => {
    const d = data({ p1: { photos: ['C:/p/p1b.jpg'], show: { photos: true } } });
    const read: string[] = [];
    const saved: string[] = [];
    await exportSite(d, scenes, pieces, '<html>', {
      readImage: async (p) => { read.push(p); return `data:${p}`; }, readMedia: async () => '', toWebp: async () => 'AAAA',
      save: async (n) => { saved.push(n); }, onProgress: () => {}, creationPhotos: { p1: ['C:/p/p1b.jpg'] },
    });
    expect(saved).toContain('assets/creation-p1-1.webp');
    expect(read).toContain('C:/p/p1b.jpg');
  });

  it('carries the hover the artisan chose, and nothing when she chose none', () => {
    expect(data({}, 'swap').creationsHover).toBe('swap');
    expect(data({}, 'none').creationsHover).toBeUndefined();
    expect(normalizeHover('explode')).toBe('none');
  });

  it('reads back only sane settings', () => {
    const many = Array.from({ length: 20 }, (_, i) => `C:/p/${i}.jpg`);
    const s = normalizeShowcase({ p1: { photos: [...many, 3, ''], dimensions: '  Ø 8 cm ' }, '../x': { photos: [] }, p2: 'garbled' });
    expect(Object.keys(s)).toEqual(['p1', 'p2']);
    expect(s.p1!.photos).toHaveLength(PHOTOS_MAX);
    expect(s.p1!.dimensions).toBe('Ø 8 cm');
    expect(s.p2).toEqual(defaultShow());
  });
});

describe('the showcase in a kit', () => {
  const text = (showcase: unknown) => JSON.stringify({ schema: KIT_SCHEMA, name: 'A', version: '2026-10-10T00:00:00.000Z', brand: {}, pages: [], files: [], showcase });

  it('adds the kit\'s pieces she has not set, its photos inside the kit folder, and never replaces hers', () => {
    const kit = readKit(text({ p1: { photos: ['kit-media:p1b.webp'], show: { photos: true } }, p2: { dimensions: 'kit', show: {} } }));
    expect(needsFolder(kit)).toBe(true);
    const mine = { p2: { ...defaultShow(), dimensions: 'mine' } };
    const out = mergeShowcase(mine, kit, 'D:/kit', (...p: string[]) => p.join('/'));
    expect(out.p1!.photos).toEqual(['D:/kit/media/p1b.webp']);
    expect(out.p2!.dimensions).toBe('mine');
  });

  it('refuses a photo that leaves media/ or names the maker\'s disk', () => {
    expect(() => readKit(text({ p1: { photos: ['kit-media:../x.webp'] } }))).toThrow(/KIT_BAD_PATH/);
    expect(() => readKit(text({ p1: { photos: ['C:/Users/crypt/x.webp'] } }))).toThrow(/KIT_BAD_RECORD/);
  });
});

describe('three measures and a weight', () => {
  it('writes all three as a size, a lone one named so it is never read as the wrong side', () => {
    expect(formatSize({ l: 12, w: 8, h: 18 }, 'fr')).toBe('12 × 8 × 18 cm');
    expect(formatSize({ h: 18.5 }, 'fr')).toBe('H 18,5 cm');
    expect(formatSize({ l: 30, h: 9 }, 'en')).toBe('L 30 × H 9 cm');
    expect(formatSize({}, 'fr')).toBeNull();
    expect(formatSize(undefined, 'fr')).toBeNull();
  });

  it('writes a weight in g under a kilo, in kg above', () => {
    expect(formatMass(850, 'fr')).toBe('850 g');
    expect(formatMass(1250, 'fr')).toBe('1,25 kg');
  });

  it('reads a typed measure with a comma, and nothing that is not a positive number', () => {
    expect(measure('12,5', 100)).toBe(12.5);
    for (const bad of ['', 'abc', '-3', '0', '200']) expect(measure(bad, 100)).toBeUndefined();
  });

  it('shows the size and the weight each when chosen, the old free text when no measure is set', () => {
    const scenes = [scene('1', 'p1')];
    const make = (sh: Record<string, unknown>) => {
      const s = site({ p1: sh });
      return buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes, pieces: [piece('p1')], showcase: s.showcase }).creations[0]!;
    };
    const both = make({ size: { l: 12, w: 8, h: 18 }, weight: 850, show: { dimensions: true, weight: true } });
    expect([both.dimensions, both.weight]).toEqual(['12 × 8 × 18 cm', '850 g']);
    const sizeOnly = make({ size: { h: 18 }, weight: 850, show: { dimensions: true, weight: false } });
    expect([sizeOnly.dimensions, sizeOnly.weight]).toEqual(['H 18 cm', undefined]);
    expect(make({ dimensions: 'Ø 12 cm', show: { dimensions: true } }).dimensions).toBe('Ø 12 cm');
    expect(make({ dimensions: 'Ø 12 cm', size: { h: 18 }, show: { dimensions: true } }).dimensions).toBe('H 18 cm');
  });

  it('reads back only positive measures', () => {
    const s = normalizeShowcase({ p1: { size: { l: '12', w: -1, h: 18 }, weight: 0 } });
    expect(s.p1!.size).toEqual({ l: 12, h: 18 });
    expect(s.p1!.weight).toBeUndefined();
  });
});

describe('the real size told to the image model', () => {
  it('names only the sides she gave, and none at all says nothing', () => {
    expect(scaleLine({ l: 12, w: 8.25, h: 18 })).toContain('12 cm long, 8.3 cm wide and 18 cm high');
    expect(scaleLine({ h: 18 })).toContain('Real size of the product: 18 cm high.');
    expect(scaleLine({})).toBeNull();
    expect(scaleLine(undefined)).toBeNull();
    expect(scaleLine({ h: 0 })).toBeNull();
  });
  it('rides on the paid background edit when known', () => {
    expect(backdropPrompt('a wooden table', { h: 18 })).toContain('18 cm high');
    expect(backdropPrompt('a wooden table')).not.toContain('Real size');
  });
});
