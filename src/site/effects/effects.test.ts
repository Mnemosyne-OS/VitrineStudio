import { activeEffects, EFFECT_FOLDERS, EFFECTS } from './index';
import { effectBytes, EFFECT_PLACES } from './contract';
import { demoDocument } from './demo';
import template from '../template.html?raw';
import { buildSiteData, EMPTY_BRAND, fillShell, type SiteData } from '../buildSite';
import { defaultShow } from '../../model/showcase';
import { designOf } from '../../model/design';
import { normalizeEffects, withEffectOn, withEffectState } from '../../model/effects';
import { sitePrint } from '../../model/publish';
import { normalizeSiteSettings } from '../../model/records';
import { LAYERS_MADE } from '../../model/sceneLayers';
import type { Piece, Scene } from '../../model/types';

const brand = { ...EMPTY_BRAND, name: 'Atelier Rosalie' };
const piece = (id: string, over: Partial<Piece> = {}): Piece => ({ schema: 1, id, name: `Vase ${id}`, kind: 'unique', tags: [], photoPath: `C:/p/${id}.jpg`, ...over });
const scene = (id: string, over: Partial<Scene> = {}): Scene => ({
  schema: 1, id, pieceId: 'p1', universe: 'Salon', variant: `Ambiance ${id}`, placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9',
  images: { place: `C:/g/${id}a.png`, piece: `C:/g/${id}b.png`, alive: `C:/g/${id}c.png` }, validated: true, createdAt: `2026-10-0${id}T00:00:00Z`, updatedAt: '', ...over,
});
const pieces = [piece('p1'), piece('p2')];
const scenes = [scene('1'), scene('2', { pieceId: 'p2' })];
const showcase = { p1: defaultShow(), p2: defaultShow() };
const input = (over: Partial<Parameters<typeof buildSiteData>[0]> = {}) => ({ brand, lang: 'fr' as const, today: '2026-11-10', untitled: 'x', scenes, pieces, showcase, ...over });
const page = (data: SiteData) => fillShell(template, brand, 'fr', data);
/** The effects a page carries, read from the script the export wrote. */
const written = (html: string) => [...html.matchAll(/^effect\('([a-z-]+)'/gm)].map((m) => m[1]);

describe('the contract of an effect', () => {
  it('reads the catalogue from the folders: the five effects of before are there, each under its own name', () => {
    expect(EFFECTS.map((e) => e.id)).toEqual(expect.arrayContaining(['mosaic', 'strip', 'parallax', 'loupe', 'living']));
    for (const e of EFFECTS) expect(EFFECT_FOLDERS[e.id]).toBe(e.id);
    expect(new Set(EFFECTS.map((e) => e.id)).size).toBe(EFFECTS.length);
    expect(new Set(EFFECTS.map((e) => e.order)).size).toBe(EFFECTS.length);
  });

  it.each(EFFECTS.map((e) => [e.id, e] as const))('%s: its sheet is whole, its script registers under its id and parses', (_id, e) => {
    for (const words of [e.name, e.about, ...(e.adds ? [e.adds] : []), ...(e.note ? [e.note] : [])]) for (const lang of ['en', 'fr', 'es'] as const) expect(words[lang].trim().length).toBeGreaterThan(1);
    expect(e.where.length).toBeGreaterThan(0);
    for (const w of e.where) expect(EFFECT_PLACES).toContain(w);
    expect(written(e.js)).toEqual([e.id]);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- parsed only, never called: a script that does not parse would stop the whole page
    expect(() => new Function('effect', e.js)).not.toThrow();
    // Nothing of an effect can close the script or the style it is written into.
    expect(e.js).not.toMatch(/<\/script/i);
    expect(e.css).not.toMatch(/<\/style/i);
    expect(e.demo).toContain('window.play');
    // Read as text, never emptied on the way: an effect with no CSS would be written without its look.
    expect(e.css.trim().length).toBeGreaterThan(20);
    expect(effectBytes(e)).toBeGreaterThan(100);
  });

  it.each(EFFECTS.filter((e) => e.moves).map((e) => [e.id, e] as const))('%s moves: its code keeps it still for who asked for less motion', (_id, e) => {
    expect(/prefers-reduced-motion/.test(e.css) || /\breduced\b/.test(e.js)).toBe(true);
  });

  it.each(EFFECTS.filter((e) => e.pointer).map((e) => [e.id, e] as const))('%s needs a mouse: its code plays nothing on a touch screen', (_id, e) => {
    expect(/api\.hovers|pointerType !== 'mouse'|pointerType === 'mouse'/.test(e.js)).toBe(true);
  });

  it('the page itself holds no effect: the five of before left the template', () => {
    for (const mark of ['layout-mosaic', 'strip-thumbs {', 'gallery.parallax', 'v-lens', 'swayTick', 'armLoupe', 'livingRoom']) expect(template).not.toContain(mark);
    expect(template.split('/*__EFFECTS_CSS__*/')).toHaveLength(2);
    expect(template.split('/*__EFFECTS_JS__*/')).toHaveLength(2);
    // The CSS goes inside the page's one stylesheet, the scripts inside its one script: the light documents of the addresses carry them too.
    expect(template.indexOf('/*__EFFECTS_CSS__*/')).toBeLessThan(template.indexOf('</style>'));
    expect(template.indexOf('/*__EFFECTS_JS__*/')).toBeGreaterThan(template.lastIndexOf('<script>'));
  });
});

describe('the export writes only the effects that are on', () => {
  it('a site with none on carries no effect at all', () => {
    const html = page(buildSiteData(input()));
    expect(written(html)).toEqual([]);
    expect(html).not.toContain('/*__EFFECTS_');
    expect(html).not.toContain('layout-mosaic');
  });

  it('the catalogue as a mosaic with a parallax carries those two, in the order of the catalogue, and no other', () => {
    const data = buildSiteData(input({ viewer: { loupe: 'none', frame: 'none', layout: 'mosaic', parallax: true } }));
    const html = page(data);
    expect(written(html)).toEqual(['mosaic', 'parallax']);
    expect(html).toContain('.gallery.layout-mosaic');
    expect(html).not.toContain('v-lens');
    expect(activeEffects(data).map((e) => e.id)).toEqual(['mosaic', 'parallax']);
  });

  it('a strip, a loupe: each its own', () => {
    expect(written(page(buildSiteData(input({ viewer: { loupe: 'none', frame: 'none', layout: 'strip' } }))))).toEqual(['strip']);
    expect(written(page(buildSiteData(input({ viewer: { loupe: 'zoom', frame: 'none' } }))))).toEqual(['loupe']);
  });
});

describe('a site of before does not move', () => {
  const site = normalizeSiteSettings({ brand: { name: 'Atelier Rosalie' }, showcase, viewer: { loupe: 'lens', layout: 'mosaic' } }, '');

  it('settings never touched are absent, and the data says nothing of effects', () => {
    expect(site.effects).toEqual({});
    expect(normalizeEffects({ state: { loupe: 'maybe', 'Bad Id': 'on' }, only: { loupe: [] } })).toEqual({});
    expect('effects' in buildSiteData(input({ effects: {} }))).toBe(false);
  });

  it('its print is the same with the settings of the effects and without them', () => {
    const base = { ...input({ viewer: site.viewer }), film: null };
    const before = sitePrint(base, site, { scenes, pieces });
    expect(sitePrint({ ...base, effects: {} }, site, { scenes, pieces })).toBe(before);
    // And a switch turned is a change of the site: the bar says so.
    expect(sitePrint({ ...base, effects: { only: { loupe: ['p1'] } }, viewer: { loupe: 'none', frame: 'none' } }, site, { scenes, pieces })).not.toBe(before);
  });

  it('each switch of the five reads and writes the setting the effect already had', () => {
    const d = designOf(site);
    const by = (id: string) => EFFECTS.find((e) => e.id === id)!;
    expect([by('mosaic').get(d), by('strip').get(d), by('parallax').get(d), by('loupe').get(d), by('living').get(d)]).toEqual([true, false, false, true, true]);
    // The strip turned on takes the place of the mosaic: a catalogue has one layout.
    expect(by('strip').set(d, true)).toEqual({ viewer: { ...d.viewer, layout: 'strip' } });
    expect(by('mosaic').set(d, false).viewer).toEqual({ loupe: 'lens', frame: 'none' });
    // The strip turned off while the mosaic is on leaves the mosaic alone.
    expect(by('strip').set(d, false).viewer?.layout).toBe('mosaic');
    expect(by('loupe').set(d, false).viewer?.loupe).toBe('none');
    expect(by('loupe').set({ ...d, viewer: { ...d.viewer, loupe: 'none' } }, true).viewer?.loupe).toBe('lens');
    expect(by('parallax').set(d, true).viewer?.parallax).toBe(true);
    expect(by('living').set(d, false)).toEqual({ effects: { state: { living: 'off' } } });
    expect(by('living').set({ ...d, effects: { state: { living: 'off' } } }, true)).toEqual({ effects: {} });
  });
});

describe('what a switch does to the site', () => {
  it('the living scenes turned off show their three pictures again', () => {
    // A scene that IS living on the site: its layers made from the pictures it has now.
    const layers = { from: { place: 'C:/g/1a.png', piece: 'C:/g/1b.png', alive: 'C:/g/1c.png' }, pot: { path: 'C:/l/pot.png', x: 40, y: 40, w: 20, h: 30 }, potAlive: { path: 'C:/l/pa.png', x: 30, y: 40, w: 20, h: 30 }, pivot: { x: 50, y: 40 }, room: 'C:/l/room.webp', made: LAYERS_MADE, madeAt: '2026-10-12T00:00:00Z' };
    const living = [scene('1', { motion: 'living', layers }), scenes[1]!];
    const on = buildSiteData(input({ scenes: living }));
    expect(on.rows[0]!.scenes[0]!.layers).toBeDefined();
    expect(Object.keys(on.rows[0]!.scenes[0]!.images)).toEqual(['place']);
    expect(written(page(on))).toEqual(['living']);
    const off = buildSiteData(input({ scenes: living, effects: { state: { living: 'off' } } }));
    expect(off.rows[0]!.scenes[0]!.layers).toBeUndefined();
    expect(Object.keys(off.rows[0]!.scenes[0]!.images)).toEqual(['place', 'piece', 'alive']);
    expect(written(page(off))).toEqual([]);
  });

  it('the loupe on one creation only: a sharp copy of that one alone, and the page carries the loupe', () => {
    const data = buildSiteData(input({ effects: { only: { loupe: ['p2', 'gone'] } } }));
    expect(data.creations.find((c) => c.id === 'p1')!.zoom).toBeUndefined();
    expect(data.creations.find((c) => c.id === 'p2')!.zoom).toHaveLength(1);
    // A creation the site no longer shows is not named.
    expect(data.effects).toEqual({ loupe: ['p2'] });
    expect(written(page(data))).toEqual(['loupe']);
    // On for the whole site, her list says nothing more.
    expect('effects' in buildSiteData(input({ viewer: { loupe: 'lens', frame: 'none' }, effects: { only: { loupe: ['p2'] } } }))).toBe(false);
  });

  it('her settings stay sparse: a state forgotten and a list emptied leave nothing behind', () => {
    expect(withEffectState(withEffectState({}, 'living', 'off'), 'living', null)).toEqual({});
    const one = withEffectOn({}, 'loupe', 'p1', true);
    expect(one).toEqual({ only: { loupe: ['p1'] } });
    expect(withEffectOn(one, 'loupe', 'p1', true)).toEqual(one);
    expect(withEffectOn(one, 'loupe', 'p1', false)).toEqual({});
  });
});

describe('the four new effects', () => {
  const by = (id: string) => EFFECTS.find((e) => e.id === id)!;
  const site = normalizeSiteSettings({ brand: { name: 'Atelier Rosalie' }, showcase }, '');

  it('are in the catalogue, off until she turns them on, and stored sparse', () => {
    const d = designOf(site);
    for (const id of ['before-after', 'spin', 'hover-video', 'reveal']) {
      expect(by(id).get(d)).toBe(false);
      const on = by(id).set(d, true);
      expect(on).toEqual({ effects: { state: { [id]: 'on' } } });
      // Turned off again, nothing is left of it in her settings.
      expect(by(id).set({ ...d, effects: on.effects! }, false)).toEqual({ effects: {} });
    }
    expect(EFFECTS.map((e) => e.id)).toEqual(['mosaic', 'strip', 'parallax', 'hover-video', 'before-after', 'spin', 'loupe', 'living', 'reveal']);
  });

  it('turned on for the whole site, each is written into the page, and only those', () => {
    const data = buildSiteData(input({ effects: { state: { 'before-after': 'on', reveal: 'on' } } }));
    expect(data.effects).toEqual({ 'before-after': true, reveal: true });
    expect(written(page(data))).toEqual(['before-after', 'reveal']);
  });

  it('on some creations only: the page carries the effect and the list, a creation gone is not named', () => {
    const data = buildSiteData(input({ effects: { only: { spin: ['p2', 'gone'], 'before-after': ['gone'] } } }));
    expect(data.effects).toEqual({ spin: ['p2'] });
    expect(written(page(data))).toEqual(['spin']);
    // On for the whole site, the list is not repeated.
    expect(buildSiteData(input({ effects: { state: { spin: 'on' }, only: { spin: ['p2'] } } })).effects).toEqual({ spin: true });
  });

  it('video on hover: a creation is told the clip of its scene, the one already on the site, and only where it plays', () => {
    const withClips = [scene('1', { clipPath: 'C:/v/1.mp4' }), scene('2', { pieceId: 'p2' })];
    const off = buildSiteData(input({ scenes: withClips }));
    expect(off.creations.some((c) => 'clip' in c)).toBe(false);
    const on = buildSiteData(input({ scenes: withClips, effects: { state: { 'hover-video': 'on' } } }));
    expect(on.creations.find((c) => c.id === 'p1')!.clip).toBe(on.rows[0]!.scenes[0]!.clip);
    // The second creation's scene has no clip: it keeps its photo, and nothing is invented for it.
    expect('clip' in on.creations.find((c) => c.id === 'p2')!).toBe(false);
    const listed = buildSiteData(input({ scenes: [scene('1', { clipPath: 'C:/v/1.mp4' }), scene('2', { pieceId: 'p2', clipPath: 'C:/v/2.mp4' })], effects: { only: { 'hover-video': ['p2'] } } }));
    expect(listed.creations.map((c) => !!c.clip)).toEqual([false, true]);
  });

  it('is offered on a creation only where it has something to play', () => {
    expect(by('before-after').fits!({ photos: 1, clip: true })).toBe(false);
    expect(by('before-after').fits!({ photos: 2, clip: false })).toBe(true);
    expect(by('spin').fits!({ photos: 2, clip: true })).toBe(false);
    expect(by('spin').fits!({ photos: 3, clip: false })).toBe(true);
    expect(by('hover-video').fits!({ photos: 6, clip: false })).toBe(false);
    expect(by('hover-video').fits!({ photos: 1, clip: true })).toBe(true);
    // The loupe plays on any photo.
    expect(by('loupe').fits).toBeUndefined();
  });

  it('a switch turned changes the print: the bar says the site is to send again', () => {
    const base = { ...input(), film: null };
    const before = sitePrint(base, site, { scenes, pieces });
    for (const id of ['before-after', 'spin', 'hover-video', 'reveal']) expect(sitePrint({ ...base, effects: { state: { [id]: 'on' } } }, site, { scenes, pieces })).not.toBe(before);
  });

  it('a creation\'s large picture has one effect at a time: the comparison and the turn mark it, the loupe leaves it', () => {
    expect(by('before-after').js).toContain("main.dataset.taken = 'before-after'");
    expect(by('spin').js).toContain("main.dataset.taken = 'spin'");
    for (const id of ['before-after', 'spin', 'loupe']) expect(by(id).js).toContain('main.dataset.taken');
    // Both on for the whole site, a creation with three photos or more is left to the turn; put on it from its own card, the comparison stays.
    expect(by('before-after').js).toContain("if (c.images.length >= 3 && api.on('spin', c) && !api.listed('before-after', c)) return;");
    // The comparison and the turn come before the loupe in the page: they are asked first.
    expect(by('before-after').order).toBeLessThan(by('loupe').order);
    expect(by('spin').order).toBeLessThan(by('loupe').order);
  });

  it('what moves by itself never starts for who asked for less motion, and the video never on a touch screen', () => {
    expect(by('reveal').js).toContain("if (api.reduced || !('IntersectionObserver' in window)) return {};");
    expect(by('hover-video').js).toContain('if (!api.hovers || api.reduced) return {};');
    expect(by('hover-video').js).toContain("if (e.pointerType !== 'mouse') return;");
    // The living scene: the two depths follow the pointer only outside reduced motion, and only a mouse; the sway starts only then too.
    expect(by('living').js).toContain("if (!reduced) {\n    stage.addEventListener('pointermove', (e) => {");
    expect(by('living').js).toContain("if (!current || e.pointerType !== 'mouse') return;");
    expect(by('living').js).toContain('if (!reduced && ROWS.some(');
    expect(by('living').js).toContain('if (!map || reduced) return;');
    expect(by('parallax').js).toContain('const MOVES = api.hovers && !api.reduced;');
    // Before / after and the turn move only under the visitor's hand: neither is declared as moving.
    expect(by('before-after').moves).toBeUndefined();
    expect(by('spin').moves).toBeUndefined();
  });
});

describe('a demonstration', () => {
  it('is the own CSS and script of the effect around its own markup, with her photos and her colours', () => {
    const e = EFFECTS.find((x) => x.id === 'mosaic')!;
    const photo = 'data:image/webp;base64,AAAA';
    const doc = demoDocument(e, [photo], { ink: '#112233', paper: '#fafafa', accent: '#b5532f' });
    expect(doc).toContain(e.css);
    expect(doc).toContain(e.js);
    expect(doc).toContain('--accent:#b5532f');
    expect(doc.split(photo).length - 1).toBe(6);
    expect(doc).not.toMatch(/__P\d__/);
  });

  it('a photo that is not a picture made here, or a colour that is not one, never reaches the page', () => {
    const e = EFFECTS.find((x) => x.id === 'parallax')!;
    const doc = demoDocument(e, ['"><script>alert(1)</script>'], { ink: 'red;}', paper: '', accent: 'x' });
    expect(doc).not.toContain('alert(1)');
    expect(doc).toContain('--ink:#2B2926');
    // No photo of hers: plain tiles in her colours stand in.
    expect(doc).toContain('data:image/svg+xml,');
  });
});
