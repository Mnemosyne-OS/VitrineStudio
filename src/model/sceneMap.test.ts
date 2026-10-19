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
  });
  it('reaches the site when it is not the default', () => {
    const base = { brand: { name: 'A' }, lang: 'en', scenes: [], pieces: [], today: '2026-10-11', untitled: 'x' };
    expect(buildSiteData({ ...(base as any), sceneMap: { style: 'dots', guide: 'none' } }).sceneMap).toEqual({ style: 'dots', guide: 'none' });
    expect(buildSiteData({ ...(base as any), sceneMap: { style: 'dots', edges: 'text' } }).sceneMap).toEqual({ style: 'dots', edges: 'text' });
    expect(buildSiteData({ ...(base as any), sceneMap: { style: 'dots', credit: 'line' } }).sceneMap).toEqual({ style: 'dots', credit: 'line' });
  });
});
