import { normalizeSceneMap } from './sceneMap';
import { buildSiteData } from '../site/buildSite';

describe('the map of places', () => {
  it('keeps a known model and a real colour, and nothing else', () => {
    expect(normalizeSceneMap({ style: 'thumbs', color: '#B5643C' })).toEqual({ style: 'thumbs', color: '#b5643c' });
    expect(normalizeSceneMap({ style: 'wild', color: 'red' })).toEqual({ style: 'dots' });
    expect(normalizeSceneMap(undefined)).toEqual({ style: 'dots' });
  });

  it('reaches the site only when it differs from the plain dots', () => {
    const base = { brand: { name: 'A', colors: { bg: '#fff', ink: '#000', accent: '#000' } }, lang: 'fr' as const, scenes: [], pieces: [], today: '2026-10-11', untitled: 'x' };
     
    expect(buildSiteData({ ...(base as any), sceneMap: { style: 'dots' } }).sceneMap).toBeUndefined();
     
    expect(buildSiteData({ ...(base as any), sceneMap: { style: 'glass', color: '#3fa66a' } }).sceneMap).toEqual({ style: 'glass', color: '#3fa66a' });
  });
});

describe('the first visitor guide', () => {
  it('is framed unless she chose the text or nothing, and an unknown value falls back to framed', () => {
    expect(normalizeSceneMap({ style: 'dots' }).guide).toBeUndefined();
    expect(normalizeSceneMap({ style: 'dots', guide: 'text' }).guide).toBe('text');
    expect(normalizeSceneMap({ style: 'dots', guide: 'none' }).guide).toBe('none');
    expect(normalizeSceneMap({ style: 'dots', guide: 'loud' }).guide).toBeUndefined();
    expect(normalizeSceneMap({ style: 'dots', edges: 'none' }).edges).toBe('none');
    expect(normalizeSceneMap({ style: 'dots', edges: 'box' }).edges).toBeUndefined();
    expect(normalizeSceneMap({ style: 'dots', credit: 'line' }).credit).toBe('line');
    expect(normalizeSceneMap({ style: 'dots', credit: 'loud' }).credit).toBeUndefined();
    expect(normalizeSceneMap({ style: 'dots', titles: 'off' }).titles).toBe('off');
    expect(normalizeSceneMap({ style: 'dots', titles: 'on' }).titles).toBeUndefined();
  });
  it('reaches the site when it is not the default', () => {
    const base = { brand: { name: 'A' }, lang: 'en', scenes: [], pieces: [], today: '2026-10-11', untitled: 'x' };
    expect(buildSiteData({ ...(base as any), sceneMap: { style: 'dots', guide: 'none' } }).sceneMap).toEqual({ style: 'dots', guide: 'none' });
    expect(buildSiteData({ ...(base as any), sceneMap: { style: 'dots', edges: 'text' } }).sceneMap).toEqual({ style: 'dots', edges: 'text' });
    expect(buildSiteData({ ...(base as any), sceneMap: { style: 'dots', credit: 'line' } }).sceneMap).toEqual({ style: 'dots', credit: 'line' });
    expect(buildSiteData({ ...(base as any), sceneMap: { style: 'dots', titles: 'off' } }).sceneMap).toEqual({ style: 'dots', titles: 'off' });
  });
});

describe('the names of the steps', () => {
  const base = { brand: { name: 'A' }, lang: 'fr', scenes: [], pieces: [], today: '2026-11-10', untitled: 'x', beats: { place: 'Le lieu', piece: 'Votre création', alive: 'Le vivant' } };
  const texts = (sceneMap: unknown, lang = 'fr') => buildSiteData({ ...(base as any), lang, sceneMap: normalizeSceneMap(sceneMap) }).texts as Record<string, string>;

  it('reads back known languages and steps, one short line each, an empty one dropped', () => {
    expect(normalizeSceneMap({ style: 'dots', stepNames: { fr: { place: '  Mon  atelier ', piece: '', alive: 3 }, de: { place: 'x' }, es: {} } }).stepNames).toEqual({ fr: { place: 'Mon atelier' } });
    expect(normalizeSceneMap({ style: 'dots', stepNames: { fr: { place: 'x'.repeat(60) } } }).stepNames?.fr?.place).toHaveLength(40);
    expect(normalizeSceneMap({ style: 'dots', steps: 'off' }).steps).toBe('off');
    expect(normalizeSceneMap({ style: 'dots', steps: 'on' }).steps).toBeUndefined();
    // A site written before this setting reads as it always did.
    expect(normalizeSceneMap({ style: 'dots' })).toEqual({ style: 'dots' });
  });
  it('replaces the trade\'s word in the site\'s language only, the others keeping it', () => {
    const map = { style: 'dots', stepNames: { fr: { piece: 'Ma céramique' } } };
    expect(texts(map).piece).toBe('Ma céramique');
    expect(texts(map).place).toBe('Le lieu');
    expect(texts(map, 'en').piece).toBe('Votre création');
    expect(texts({ style: 'dots' }).piece).toBe('Votre création');
  });
  it('reaches the site when set, with the list hidden or not', () => {
    const data = (sceneMap: unknown) => buildSiteData({ ...(base as any), sceneMap: normalizeSceneMap(sceneMap) }).sceneMap;
    expect(data({ style: 'dots', steps: 'off' })).toEqual({ style: 'dots', steps: 'off' });
    expect(data({ style: 'dots', stepNames: { fr: { place: 'x' } } })).toEqual({ style: 'dots', stepNames: { fr: { place: 'x' } } });
    expect(data({ style: 'dots' })).toBeUndefined();
  });
});
