import { buildSiteData, type Brand } from '../site/buildSite';
import type { Piece, Scene } from './types';
import { herWords, normalizeTranslation, translated, translationProgress, withSecondLanguage } from './translation';

const brand: Brand = { accent: '#5F5A53', ink: '#2B2926', paper: '#EEECE7', name: 'Atelier', tagline: 'Céramique et plantes', about: 'Je tourne la terre.', email: '', instagram: '', introLine: '', portraitCaption: '', contactNote: '', formspree: '' };
const piece = (id: string, over: Partial<Piece> = {}): Piece => ({ schema: 1, id, name: `Vase ${id}`, kind: 'unique', tags: [], photoPath: `C:/p/${id}.jpg`, ...over });

describe('the second language', () => {
  const data = buildSiteData({ brand, lang: 'en', today: '2026-11-02', untitled: 'x', scenes: [] as Scene[], pieces: [piece('p1')], showcase: { p1: { photos: [], onPage: true, show: { name: true, description: false, dimensions: false, weight: false, price: false, photos: false } } }, categories: [{ id: 'jardin', name: 'Jardin' }] });

  it('finds her words, once each, and never the site own words', () => {
    const words = herWords(data);
    expect(words).toEqual(expect.arrayContaining(['Céramique et plantes', 'Vase p1']));
    expect(words.some((w) => w.includes('Je tourne la terre'))).toBe(true);
    expect(new Set(words).size).toBe(words.length);
    // About is read once, from its HTML.
    expect(words.filter((w) => w.includes('Je tourne la terre'))).toEqual(['<p>Je tourne la terre.</p>']);
    // The menus, the legal pages, the hints are the build's language, not hers.
    expect(words).not.toContain(data.texts.creations);
  });
  it('puts online only what she read, every other string in her words', () => {
    const tr = { lang: 'en' as const, entries: { 'Céramique et plantes': { to: 'Ceramics and plants', ok: true as const }, 'Vase p1': { to: 'Vase p1 EN' } } };
    const out = translated(data, tr);
    expect(out.brand.tagline).toBe('Ceramics and plants');
    expect(out.creations[0]!.alt).toBe('Vase p1');
    expect(translationProgress(herWords(data), tr)).toMatchObject({ read: 1, proposed: 1 });
  });
  it('reads back a known language other than the studio one, an empty translation never ticked', () => {
    expect(normalizeTranslation({ lang: 'en', entries: { a: { to: 'b', ok: true }, c: { to: '  ', ok: true }, d: 3 } }, 'fr')).toEqual({ lang: 'en', entries: { a: { to: 'b', ok: true }, c: { to: '  ' } } });
    expect(normalizeTranslation({ lang: 'fr', entries: {} }, 'fr')).toBeUndefined();
    expect(normalizeTranslation({ lang: 'de', entries: {} })).toBeUndefined();
  });
});

describe('the site as it is sent', () => {
  const build = (lang: 'fr' | 'en' | 'es') => buildSiteData({ brand, lang, today: '2026-11-02', untitled: 'x', scenes: [] as Scene[], pieces: [], menu: { creations: 'Mes créations' } });
  const proposed = { lang: 'en' as const, entries: { 'Céramique et plantes': { to: 'Ceramics and plants' } } };
  const read = { lang: 'en' as const, entries: { 'Céramique et plantes': { to: 'Ceramics and plants', ok: true as const }, 'Mes créations': { to: 'My creations', ok: true as const } } };

  it('carries no second version while nothing is read, nor for the studio language itself', () => {
    expect(withSecondLanguage('fr', build, undefined).alt).toBeUndefined();
    expect(withSecondLanguage('fr', build, proposed).alt).toBeUndefined();
    expect(withSecondLanguage('en', build, read).alt).toBeUndefined();
  });
  it('builds the second version in ITS language, her read words in place, her renamed menu included', () => {
    const sent = withSecondLanguage('fr', build, read);
    expect(sent.texts.about).toBe(build('fr').texts.about);
    expect(sent.alt!.lang).toBe('en');
    expect(sent.alt!.data.texts.about).toBe(build('en').texts.about);
    expect(sent.alt!.data.brand.tagline).toBe('Ceramics and plants');
    expect(sent.alt!.data.texts.creations).toBe('My creations');
    // A menu entry left as the site names it is the site's words, not hers.
    expect(herWords(build('en'))).toContain('Mes créations');
    expect(herWords(build('en'))).not.toContain(build('en').texts.about);
  });
});
