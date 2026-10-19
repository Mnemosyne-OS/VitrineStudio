import { filmOf } from './film';
import { profileById } from './profiles';
import { filmWithoutFrom, newFilm, normalizeFilm, readCut, withCut, type Film } from './filmRecord';
import { buildSiteData, filmSources, type Brand } from '../site/buildSite';
import { filmFileStem, filmParts } from './filmExport';

const steps = filmOf(profileById('ceramics-plants')).steps;
const full = (over: Partial<Film> = {}): Film => ({
  ...newFilm('ceramics-plants', '16:9'),
  keyframes: Object.fromEntries(steps.map((s) => [s.id, `C:/k/${s.id}.png`])),
  clips: Object.fromEntries(steps.slice(1).map((s) => [s.id, `C:/v/${s.id}.mp4`])),
  validated: true,
  ...over,
});
const second = steps[1]!.id;
const third = steps[2]!.id;

describe('film cuts', () => {
  it('reads a cut only when it leaves a part to play', () => {
    expect(readCut({ in: 0.5, out: 4.25 })).toEqual({ in: 0.5, out: 4.25 });
    expect(readCut({ in: 3, out: 2 })).toBeNull();
    expect(readCut({ in: 1, out: 1.1 })).toBeNull();
    expect(readCut({ in: -1, out: 2 })).toBeNull();
    expect(readCut({ in: '0', out: 2 })).toBeNull();
    expect(readCut(null)).toBeNull();
  });

  it('writes a cut, takes it off, and never writes one that keeps the whole clip', () => {
    const f = withCut(full(), second, { in: 0.5, out: 5 }, 6);
    expect(f.cuts[second]).toEqual({ in: 0.5, out: 5 });
    expect(withCut(f, second, null, 6).cuts).toEqual({});
    expect(withCut(full(), second, { in: 0, out: 6 }, 6).cuts).toEqual({});
  });

  it('keeps a cut read back only for a clip that is there', () => {
    const f = normalizeFilm({ ...full(), cuts: { [second]: { in: 1, out: 4 }, ghost: { in: 1, out: 4 } }, clips: { [second]: 'C:/v.mp4' } })!;
    expect(f.cuts).toEqual({ [second]: { in: 1, out: 4 } });
    expect(normalizeFilm({ ...full(), clips: {}, cuts: { [second]: { in: 1, out: 4 } } })!.cuts).toEqual({});
  });

  it('forgets the cuts of the clips a remade keyframe throws away', () => {
    const f = full({ cuts: { [second]: { in: 1, out: 4 }, [third]: { in: 0.5, out: 3 } } });
    expect(filmWithoutFrom(f, third, steps).cuts).toEqual({ [second]: { in: 1, out: 4 } });
  });

  it('gives the page its parts only when one is cut', () => {
    const brand: Brand = { accent: '#000000', ink: '#000000', paper: '#ffffff', name: 'A', tagline: '', about: '', email: '', instagram: '', introLine: '', portraitCaption: '', contactNote: '', formspree: '' };
    const data = (f: Film) => buildSiteData({ brand, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes: [], pieces: [], film: filmSources(f, steps) });
    expect(data(full()).film!.cuts).toBeUndefined();
    const cut = data(full({ cuts: { [third]: { in: 0.5, out: 3 } } })).film!.cuts!;
    expect(cut[0]).toBeNull();
    expect(cut[1]).toEqual({ in: 0.5, out: 3 });
    expect(cut).toHaveLength(steps.length - 1);
  });
});

describe('film export', () => {
  it('sends the parts in the order of the chain, each with its cut, and only the clips that exist', () => {
    const f = full({ cuts: { [third]: { in: 0.5, out: 3 } } });
    const parts = filmParts(f, steps);
    expect(parts).toHaveLength(steps.length - 1);
    expect(parts[0]).toEqual({ path: `C:/v/${second}.mp4` });
    expect(parts[1]).toEqual({ path: `C:/v/${third}.mp4`, in: 0.5, out: 3 });
    expect(filmParts(full({ clips: { [third]: 'C:/v/x.mp4' } }), steps)).toEqual([{ path: 'C:/v/x.mp4' }]);
  });

  it('names each export by its minute, never the same name as the last one', () => {
    expect(filmFileStem(new Date(2026, 9, 10, 14, 3))).toBe('film-2026-10-10-1403');
  });
});
