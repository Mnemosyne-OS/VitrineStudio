/**
 * An instrument, not a test of the suite: with `VITRINE_SEO_OUT=<folder>` it
 * writes a whole small site (two languages, a post, a sold piece) into that
 * folder, to be served and opened in a real browser. The page's script is not
 * run by any test here: its routes are checked this way (doc 145 §10.24).
 *
 *   VITRINE_SEO_OUT=/tmp/site npx vitest run src/site/seoProbe.test.ts
 *   python -m http.server 5299 --directory /tmp/site
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildSiteData, exportSite, fillShell, seoPictures, type Brand, type SiteData } from './buildSite';
import { withSeo } from './seo';
import { defaultShow } from '../model/showcase';
import type { Piece, Scene } from '../model/types';

const OUT = process.env.VITRINE_SEO_OUT ?? '';
// A 2 x 2 grey PNG: every picture of the probe.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNoaGhgYGBgYGgAAAUEAYGfaJ0vAAAAAElFTkSuQmCC';
const piece = (id: string, over: Partial<Piece> = {}): Piece => ({ schema: 1, id, name: `Vase ${id}`, kind: 'unique', tags: [], photoPath: `C:/p/${id}.jpg`, ...over });
const scene = (id: string, over: Partial<Scene> = {}): Scene => ({
  schema: 1, id, pieceId: 'p1', universe: 'Salon', variant: `Ambiance ${id}`, placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9',
  images: { place: `C:/g/${id}a.png`, piece: `C:/g/${id}b.png`, alive: `C:/g/${id}c.png` }, validated: true, createdAt: `2026-10-0${id}T00:00:00Z`, updatedAt: '', ...over,
});
const brand: Brand = { accent: '#5F5A53', ink: '#2B2926', paper: '#EEECE7', name: 'Atelier Probe', tagline: 'Grès tourné à la main', about: 'Je tourne le grès depuis dix ans.\n\nChaque pièce est unique.', email: 'a@b.ch', instagram: '', introLine: '', portraitCaption: '', contactNote: 'Écrivez-moi.', formspree: '' };

describe.skipIf(!OUT)('probe: a whole site written to a folder', () => {
  it('writes it', async () => {
    const pieces = [piece('p1', { name: 'Vase cône', description: 'Un vase haut en grès.', price: 120 }), piece('p2', { name: 'Bol à thé' }), piece('p3', { name: 'Saladier', status: 'sold' })];
    const scenes = [scene('1'), scene('2', { pieceId: 'p2' }), scene('3', { universe: 'Jardin' })];
    const show = { ...defaultShow(), show: { ...defaultShow().show, name: true, description: true, price: true } };
    // `VITRINE_SEO_MOVED=1`: « About » has moved to her own word, as on a site sent before (a redirect, and the old address written over).
    const moved = process.env.VITRINE_SEO_MOVED ? { words: { about: 'atelier' }, redirects: [{ from: 'a-propos/', id: 'a-propos' }] } : {};
    const seo = { origin: process.env.VITRINE_SEO_ORIGIN ?? 'http://localhost:5299', slugs: { 'c:p3': 'saladier' }, aiBots: 'closed' as const, ...moved };
    const input = (lang: 'fr' | 'en') => ({ brand, lang, today: '2026-11-09', untitled: 'x', scenes, pieces, showcase: { p1: show, p2: show, p3: show }, seo, posts: [{ id: 'a', title: 'Le four à bois', date: '2026-06-12', text: '# T\n\nUne cuisson de trois jours.' }] });
    const en = buildSiteData(input('en'));
    const data: SiteData = withSeo({ ...buildSiteData(input('fr')), alt: { lang: 'en', data: { ...en, brand: { ...en.brand, tagline: 'Hand-thrown stoneware' } } } }, 'fr', seo, { address: '1 rue du Four\n1200 Genève' });
    const shell = fillShell((await import('./template.html?raw')).default, brand, 'fr', data, seoPictures(data));
    const save = async (name: string, b64: string) => { const f = join(OUT, name); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, Buffer.from(b64, 'base64')); };
    const res = await exportSite(data, scenes, pieces, shell, { readImage: async () => `data:image/png;base64,${PNG}`, readMedia: async () => 'data:video/mp4;base64,AAAA', toWebp: async () => PNG, toShare: async () => PNG, save, onProgress: () => {}, lang: 'fr', writtenPaths: process.env.VITRINE_SEO_MOVED ? ['a-propos/', 'creations/retiree/'] : [] });
    expect(res.files).toBeGreaterThan(10);
  });
});
