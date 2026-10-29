import { bareAddress, publishStage, siteFields, siteLink, sitePrint, type LastPublish } from './publish';
import { normalizeSiteSettings } from './records';
import { defaultShow } from './showcase';
import type { Piece, Scene } from './types';

const live = (over: Partial<LastPublish> = {}): LastPublish => ({ url: 'https://atelier-k2j4.vercel.app', aliases: [], readyState: 'READY', at: '2026-10-29T10:00:00Z', ...over });

describe('siteLink', () => {
  it('is the project’s own address when Vercel gave it, never the deployment’s', () => {
    expect(siteLink(live({ aliases: ['https://atelier-tony.vercel.app', 'https://atelier.vercel.app'] }), 'atelier')).toBe('https://atelier.vercel.app');
  });

  it('never builds <name>.vercel.app from the name alone: a taken name gets the alias Vercel gave', () => {
    expect(siteLink(live({ aliases: ['https://atelier-claire-team.vercel.app', 'https://atelier-claire.vercel.app'] }), 'atelier')).toBe('https://atelier-claire.vercel.app');
  });

  it('prefers a .vercel.app alias to a domain Vercel lists but nobody said points there', () => {
    expect(siteLink(live({ aliases: ['https://atelier.fr', 'https://atelier-x.vercel.app'] }), 'atelier')).toBe('https://atelier-x.vercel.app');
  });

  it('never opens a domain of hers that nobody said points there, even when Vercel lists it alone', () => {
    expect(siteLink(live({ aliases: ['https://atelier.fr'] }), 'atelier')).toBe('https://atelier-k2j4.vercel.app');
  });

  it('is her own domain once it is read as pointing there', () => {
    expect(siteLink(live({ aliases: ['https://atelier.vercel.app'] }), 'atelier', ['atelier.fr'])).toBe('https://atelier.fr');
  });

  it('falls back to the deployment, and is nothing for a site never sent', () => {
    expect(siteLink(live(), 'atelier')).toBe('https://atelier-k2j4.vercel.app');
    expect(siteLink(undefined, 'atelier', ['atelier.fr'])).toBeNull();
  });

  it('reads bare in a sentence', () => {
    expect(bareAddress('https://atelier.vercel.app/')).toBe('atelier.vercel.app');
  });
});

describe('publishStage', () => {
  const ready = { connected: true, missing: [], printNow: 'abc' };
  it('never reads a token not read yet as « to connect », even with something missing', () => {
    expect(publishStage({ ...ready, connected: null, missing: ['name'] })).toBe('checking');
    expect(publishStage({ ...ready, connected: null, live: live({ print: 'abc' }) })).toBe('checking');
  });

  it('a refused send is « refused » while the site before it is still the one online', () => {
    expect(publishStage({ ...ready, refused: true, live: live({ print: 'abc' }) })).toBe('failed');
    expect(publishStage({ ...ready, refused: true })).toBe('failed');
  });

  it('names what blocks before anything else', () => {
    expect(publishStage({ ...ready, connected: false, live: live({ print: 'abc' }) })).toBe('unconnected');
    expect(publishStage({ ...ready, missing: ['name'], live: live({ print: 'abc' }) })).toBe('incomplete');
    expect(publishStage(ready)).toBe('never');
  });

  it('tells Vercel’s own states apart from the studio’s', () => {
    expect(publishStage({ ...ready, live: live({ readyState: 'BUILDING', print: 'abc' }) })).toBe('pending');
    expect(publishStage({ ...ready, live: live({ readyState: 'ERROR', print: 'abc' }) })).toBe('failed');
    expect(publishStage({ ...ready, live: live({ readyState: 'CANCELED' }) })).toBe('failed');
  });

  it('compares the print sent with the print now; a publish without one is unknown, never up to date', () => {
    expect(publishStage({ ...ready, live: live({ print: 'abc' }) })).toBe('current');
    expect(publishStage({ ...ready, live: live({ print: 'old' }) })).toBe('behind');
    expect(publishStage({ ...ready, live: live() })).toBe('unknown');
    // The site could not be printed now: whether it changed is not known.
    expect(publishStage({ ...ready, printNow: null, live: live({ print: 'abc' }) })).toBe('unknown');
  });
});

describe('sitePrint', () => {
  const now = '2026-10-29T10:00:00Z';
  const piece: Piece = { schema: 1, id: 'p1', name: 'Totem', kind: 'unique', status: 'available', tags: [], photoPath: 'C:/p1.webp', createdAt: now, updatedAt: now };
  const scene = { schema: 1, id: 's1', pieceId: 'p1', universe: 'Salon', variant: 'Console', placeDescription: '', animation: 'pothos', aspectRatio: '16:9',
    images: { place: 'C:/s1a.webp', piece: 'C:/s1b.webp' }, validated: true, createdAt: now, updatedAt: now } as unknown as Scene;
  const site = normalizeSiteSettings({ projectName: 'atelier', brand: { name: 'Atelier' } }, '');
  const input = (s = site) => ({ ...siteFields(s), lang: 'fr' as const, untitled: '—', scenes: [scene], pieces: [piece] });
  const print = (s = site, scenes = [scene], pieces = [piece]) => sitePrint({ ...input(s), scenes, pieces }, s, { scenes, pieces });

  it('is the same for the same site, whatever order the keys were read in', () => {
    // Every object, at every level, its keys in the opposite order: a file written by another hand.
    const flip = (v: unknown): unknown => (Array.isArray(v) ? v.map(flip)
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, flip(x)])) : v);
    expect(print(flip(site) as typeof site, [flip(scene) as Scene], [flip(piece) as Piece])).toBe(print());
  });

  it('changes with what the visitor would see', () => {
    expect(print({ ...site, brand: { ...site.brand, tagline: 'Grès tourné' } })).not.toBe(print());
    expect(print({ ...site, analytics: true })).not.toBe(print());
    expect(print(site, [{ ...scene, validated: false }])).not.toBe(print());
  });

  it('changes with what the export reads beside the page: weight, quality, a picture remade', () => {
    expect(print({ ...site, imageKb: 400 })).not.toBe(print());
    expect(print({ ...site, quality: 'max' })).not.toBe(print());
    expect(print(site, [{ ...scene, updatedAt: '2026-10-30T09:00:00Z' }])).not.toBe(print());
    expect(print(site, [scene], [{ ...piece, photoPath: 'C:/p1-better.webp' }])).not.toBe(print());
  });

  it('changes with every file behind a name: logo, portrait, kit, photos, posts, the film, a page photo', () => {
    const base = print();
    expect(print({ ...site, identity: { ...site.identity, logoPath: 'C:/logo2.png' } })).not.toBe(base);
    expect(print({ ...site, brand: { ...site.brand, portrait: 'C:/moi2.jpg' } })).not.toBe(base);
    expect(print({ ...site, kit: { pages: 1 } as unknown as typeof site.kit })).not.toBe(base);
    expect(print({ ...site, posts: [{ id: 'b1', path: 'C:/notes/b1.md', date: '2026-10-29', published: true }] })).not.toBe(base);
    expect(print({ ...site, showcase: { p1: { ...defaultShow(), photos: ['C:/p1-back.webp'] } } })).not.toBe(base);
    const withPage = { ...site, pages: [{ id: 'atelier', type: 'text' as const, name: 'Atelier', photo: 'C:/a.webp' }] };
    expect(print({ ...withPage, pages: [{ ...withPage.pages[0]!, photo: 'C:/a2.webp' }] })).not.toBe(print(withPage));
  });

  it('changes with the home film: a clip, its cut, or the record remade in place', () => {
    const film: { poster: string; clips: Array<{ name: string; path: string; cut?: { in: number; out: number } }> } = { poster: 'C:/k1.png', clips: [{ name: 'assets/film-making.mp4', path: 'C:/clip1.mp4' }] };
    const rec = { id: 'f1', updatedAt: '2026-10-29T10:00:00Z' };
    const withFilm = (f = film, r = rec) => sitePrint({ ...input(site), scenes: [scene], pieces: [piece], film: f }, site, { scenes: [scene], pieces: [piece], film: r });
    expect(withFilm({ ...film, clips: [{ ...film.clips[0]!, path: 'C:/clip1b.mp4' }] })).not.toBe(withFilm());
    expect(withFilm({ ...film, clips: [{ ...film.clips[0]!, cut: { in: 1, out: 3 } }] })).not.toBe(withFilm());
    expect(withFilm(film, { ...rec, updatedAt: '2026-10-30T10:00:00Z' })).not.toBe(withFilm());
  });

  it('does not change with a piece the site does not show', () => {
    const aside: Piece = { ...piece, id: 'p2', name: 'Bol', photoPath: 'C:/p2.webp' };
    expect(print(site, [scene], [piece, { ...aside, photoPath: 'C:/p2-new.webp', updatedAt: '2026-10-30T09:00:00Z' }])).toBe(print(site, [scene], [piece, aside]));
    // Its further photos too: off the page, a photo added to it is not a change of the site.
    const hidden = { ...site, showcase: { p2: { ...defaultShow(), onPage: false } } };
    expect(print({ ...hidden, showcase: { p2: { ...hidden.showcase.p2, photos: ['C:/p2-back.webp'] } } }, [scene], [piece, aside])).toBe(print(hidden, [scene], [piece, aside]));
  });

  it('does not change with what never reaches the site', () => {
    expect(print({ ...site, lastExport: { files: 3, bytes: 10, imageBytes: 8, clipBytes: 0, at: now } })).toBe(print());
    expect(print({ ...site, siteId: 'other-folder' })).toBe(print());
  });
});

describe('the refusal kept apart from the site online', () => {
  it('survives the settings being read back, and is dropped when it is not one', () => {
    expect(normalizeSiteSettings({ lastRefusal: { at: '2026-10-29T10:00:00Z', readyState: 'ERROR' } }, '').lastRefusal).toEqual({ at: '2026-10-29T10:00:00Z', readyState: 'ERROR' });
    expect(normalizeSiteSettings({ lastRefusal: { readyState: 'ERROR' } }, '').lastRefusal).toBeUndefined();
  });
});

describe('the print kept with a publish', () => {
  const lp = { url: 'https://a.vercel.app', aliases: [], readyState: 'READY', at: '2026-10-29T10:00:00Z' };
  it('survives the settings being read back from disk: lost, every site would read « unknown » forever', () => {
    expect(normalizeSiteSettings({ lastPublish: { ...lp, print: '00a1b2c3d4e5f6' } }, '').lastPublish?.print).toBe('00a1b2c3d4e5f6');
  });
  it('is dropped when it is not a print', () => {
    expect(normalizeSiteSettings({ lastPublish: { ...lp, print: '<script>' } }, '').lastPublish?.print).toBeUndefined();
    expect(normalizeSiteSettings({ lastPublish: lp }, '').lastPublish).not.toHaveProperty('print');
  });
});
