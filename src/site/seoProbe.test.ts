/**
 * An instrument, not a test of the suite: with `VITRINE_SEO_OUT=<folder>` it
 * writes a whole small site (two languages, a post, a sold piece) into that
 * folder, to be served and opened in a real browser. The page's script is not
 * run by any test here: its routes and its effects are checked this way
 * (doc 145 §10.24, §10.25).
 *
 *   VITRINE_SEO_OUT=/tmp/site npx vitest run src/site/seoProbe.test.ts
 *   python -m http.server 5299 --directory /tmp/site
 *
 * `VITRINE_PROBE_FX=mosaic,parallax,loupe,living` turns effects on by their id
 * (`all` = every effect of the catalogue that can stand with the others; a
 * catalogue has one layout, so `strip` is asked by name). Each picture of the
 * probe is a small PNG of its own colour, so a second photo, a layer or an
 * effect is seen for what it is. Clips are the dev fixtures' when they are there.
 *
 * `VITRINE_PROBE_THEME=galerie` lays a theme on it (src/site/themes); `galerie:theme` also
 * takes the theme's own colours instead of the probe's.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { buildSiteData, exportSite, fillShell, seoPictures, type Brand, type SiteData } from './buildSite';
import { withSeo } from './seo';
import { EFFECTS } from './effects';
import { defaultShow } from '../model/showcase';
import { LAYERS_MADE } from '../model/sceneLayers';
import type { EffectsSettings } from '../model/effects';
import type { ViewerSettings } from '../model/viewer';
import type { Piece, Scene } from '../model/types';

const OUT = process.env.VITRINE_SEO_OUT ?? '';
const ASKED = (process.env.VITRINE_PROBE_FX ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const [THEME_ID = '', THEME_COLOURS = ''] = (process.env.VITRINE_PROBE_THEME ?? '').split(':');
const FX = new Set(ASKED.includes('all') ? [...EFFECTS.map((e) => e.id).filter((id) => id !== 'strip'), ...ASKED] : ASKED);

// ── A PNG of one colour with a soft diagonal, by the picture's path: every picture of the probe is told apart. ──
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (buf: Uint8Array) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set([...type].map((c) => c.charCodeAt(0)), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
  return out;
}
function png(path: string, w = 96, h = 120): string {
  let seed = 0;
  for (const c of path) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const hue = [(seed & 0xff), ((seed >> 8) & 0xff), ((seed >> 16) & 0xff)].map((v) => 90 + (v % 130));
  // A layer is cut out: its corners are clear, so what stands under it shows.
  const cut = /pot|alive|shadow/.test(path);
  const raw = new Uint8Array(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * (1 + w * 4) + 1 + x * 4, shade = ((x + y) / (w + h)) * 50;
      const inside = !cut || ((x - w / 2) ** 2) / ((w / 2.2) ** 2) + ((y - h / 2) ** 2) / ((h / 2.1) ** 2) < 1;
      raw[i] = Math.min(255, hue[0]! + shade); raw[i + 1] = Math.min(255, hue[1]! + shade); raw[i + 2] = Math.min(255, hue[2]! + shade); raw[i + 3] = inside ? 255 : 0;
    }
  }
  const head = new Uint8Array(13);
  const hv = new DataView(head.buffer);
  hv.setUint32(0, w); hv.setUint32(4, h); head[8] = 8; head[9] = 6;
  const bytes = Buffer.concat([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]);
  return bytes.toString('base64');
}

const piece = (id: string, over: Partial<Piece> = {}): Piece => ({ schema: 1, id, name: `Vase ${id}`, kind: 'unique', tags: [], photoPath: `C:/p/${id}.jpg`, ...over });
const scene = (id: string, over: Partial<Scene> = {}): Scene => ({
  schema: 1, id, pieceId: 'p1', universe: 'Salon', variant: `Ambiance ${id}`, placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9',
  images: { place: `C:/g/${id}a.png`, piece: `C:/g/${id}b.png`, alive: `C:/g/${id}c.png` }, validated: true, createdAt: `2026-10-0${id}T00:00:00Z`, updatedAt: '', ...over,
});
const brand: Brand = { accent: '#5F5A53', ink: '#2B2926', paper: '#EEECE7', name: 'Atelier Probe', tagline: 'Grès tourné à la main', about: 'Je tourne le grès depuis dix ans.\n\nChaque pièce est unique.', email: 'a@b.ch', instagram: '', introLine: '', portraitCaption: '', contactNote: 'Écrivez-moi.', formspree: '' };
const CLIP = join(__dirname, '..', '..', 'dev-fixtures', 'film-clip1.mp4');

describe.skipIf(!OUT)('probe: a whole site written to a folder', () => {
  it('writes it', async () => {
    const pieces = [piece('p1', { name: 'Vase cône', description: 'Un vase haut en grès.', price: 120 }), piece('p2', { name: 'Bol à thé' }), piece('p3', { name: 'Saladier', status: 'sold' }), piece('p4', { name: 'Pichet' }), piece('p5', { name: 'Assiette creuse' })];
    // A living scene when asked: its layers made from the pictures it has now, so the site takes them.
    const layers = { from: { place: 'C:/g/3a.png', piece: 'C:/g/3b.png', alive: 'C:/g/3c.png' }, pot: { path: 'C:/l/pot.png', x: 40, y: 38, w: 20, h: 40 }, potAlive: { path: 'C:/l/alive.png', x: 38, y: 14, w: 24, h: 64 }, swayMap: 'C:/l/sway.png', pivot: { x: 50, y: 40 }, room: 'C:/l/room.png', made: LAYERS_MADE, madeAt: '2026-11-10T00:00:00Z' };
    const scenes = [scene('1', { clipPath: 'C:/v/1.mp4' }), scene('2', { pieceId: 'p2', clipPath: 'C:/v/2.mp4' }), scene('3', { universe: 'Jardin', ...(FX.has('living') ? { motion: 'living' as const, layers } : {}) }), scene('4', { pieceId: 'p4', universe: 'Jardin' }), scene('5', { pieceId: 'p5', universe: 'Jardin' })];
    const show = { ...defaultShow(), show: { ...defaultShow().show, name: true, description: true, price: true, photos: true } };
    // Further photos: two for the first creation, five for the second (enough to turn it by dragging).
    const showcase = { p1: { ...show, photos: ['C:/p/p1-b.jpg'] }, p2: { ...show, photos: ['C:/p/p2-b.jpg', 'C:/p/p2-c.jpg', 'C:/p/p2-d.jpg', 'C:/p/p2-e.jpg', 'C:/p/p2-f.jpg'] }, p3: show, p4: show, p5: show };
    const viewer: ViewerSettings = { loupe: FX.has('loupe') ? 'lens' : 'none', frame: 'none', ...(FX.has('strip') ? { layout: 'strip' as const } : FX.has('mosaic') ? { layout: 'mosaic' as const } : {}), ...(FX.has('parallax') ? { parallax: true as const } : {}) };
    // The effects that have no setting of their own are turned on by their state.
    const stateful = [...FX].filter((id) => !['all', 'mosaic', 'strip', 'parallax', 'loupe', 'living'].includes(id));
    const effects: EffectsSettings = stateful.length ? { state: Object.fromEntries(stateful.map((id) => [id, 'on' as const])) } : {};
    // `VITRINE_SEO_MOVED=1`: « About » has moved to her own word, as on a site sent before (a redirect, and the old address written over).
    const moved = process.env.VITRINE_SEO_MOVED ? { words: { about: 'atelier' }, redirects: [{ from: 'a-propos/', id: 'a-propos' }] } : {};
    const seo = { origin: process.env.VITRINE_SEO_ORIGIN ?? 'http://localhost:5299', slugs: { 'c:p3': 'saladier' }, aiBots: 'closed' as const, ...moved };
    const theme = { ...(THEME_ID ? { id: THEME_ID } : {}), ...(THEME_COLOURS === 'theme' ? { colours: 'theme' as const } : {}) };
    const input = (lang: 'fr' | 'en') => ({ brand, lang, today: '2026-11-09', untitled: 'x', scenes, pieces, showcase, viewer, effects, theme, seo, posts: [{ id: 'a', title: 'Le four à bois', date: '2026-06-12', text: '# T\n\nUne cuisson de trois jours.\n\nLe four monte en température pendant une nuit entière.\n\nAu matin, on ouvre.' }] });
    const en = buildSiteData(input('en'));
    const data: SiteData = withSeo({ ...buildSiteData(input('fr')), alt: { lang: 'en', data: { ...en, brand: { ...en.brand, tagline: 'Hand-thrown stoneware' } } } }, 'fr', seo, { address: '1 rue du Four\n1200 Genève' });
    const shell = fillShell((await import('./template.html?raw')).default, brand, 'fr', data, seoPictures(data));
    const save = async (name: string, b64: string) => { const f = join(OUT, name); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, Buffer.from(b64, 'base64')); };
    const clip = existsSync(CLIP) ? `data:video/mp4;base64,${readFileSync(CLIP).toString('base64')}` : 'data:video/mp4;base64,AAAA';
    // The picture « encoded » is the picture read: the probe has no canvas, and what is checked is the page.
    const res = await exportSite(data, scenes, pieces, shell, {
      readImage: async (path) => `data:image/png;base64,${png(path, /room|a\.png|b\.png|c\.png/.test(path) ? 160 : 96, /room|a\.png|b\.png|c\.png/.test(path) ? 100 : 120)}`,
      readMedia: async () => clip, toWebp: async (dataUrl) => dataUrl.split(',')[1]!, toShare: async (dataUrl) => dataUrl.split(',')[1]!, save, onProgress: () => {}, lang: 'fr',
      creationPhotos: Object.fromEntries(Object.entries(showcase).map(([id, s]) => [id, s.photos])),
      writtenPaths: process.env.VITRINE_SEO_MOVED ? ['a-propos/', 'creations/retiree/'] : [],
    });
    expect(res.files).toBeGreaterThan(10);
    // What the page carries, said in the run's output: the effects written into it.
    console.info('[probe] theme:', data.theme ?? 'the starting one, her colours');
    console.info('[probe] effects in the page:', [...shell.matchAll(/^effect\('([a-z-]+)'/gm)].map((m) => m[1]).join(', ') || 'none');
  });
});
