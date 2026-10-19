import { filmOnSite, isFilmRecord, newFilm, normalizeFilm, withOnSite } from './filmRecord';
import { filesOwnedBy } from '../data/removeScene';
import type { Scene } from './types';

const a = { ...newFilm('ceramics-plants', '16:9'), validated: true, keyframes: { workshop: 'C:/g/a.png' } };
const b = { ...newFilm('ceramics-plants', '16:9', new Date(), 'film-b'), keyframes: { workshop: 'C:/g/b.png' } };

describe('a studio with several films', () => {
  it('reads the first film, written before films had an id, as `film`', () => {
    const { id: _id, name: _name, ...old } = a;
    const read = normalizeFilm(old)!;
    expect(read.id).toBe('film');
    expect(read.name).toBe('');
    expect(read.keyframes).toEqual({ workshop: 'C:/g/a.png' });
    expect(read.validated).toBe(true);
  });
  it('keeps a new film\'s id and name, and refuses an id that is not a plain file name', () => {
    expect(normalizeFilm({ ...b, name: 'Été' })!.id).toBe('film-b');
    expect(normalizeFilm({ ...b, name: 'Été' })!.name).toBe('Été');
    expect(normalizeFilm({ ...b, id: '../evil' })!.id).toBe('film');
  });
  it('has one film on the website: putting one on takes the other off; taking one off touches only it', () => {
    const on = withOnSite([a, b], 'film-b', true);
    expect(on.map((f) => f.validated)).toEqual([false, true]);
    expect(filmOnSite(on)!.id).toBe('film-b');
    const off = withOnSite([a, b], 'film', false);
    expect(off.map((f) => f.validated)).toEqual([false, false]);
    expect(off[1]).toBe(b);
    expect(filmOnSite(off)).toBeNull();
  });
  it('counts the costs of every film, and of nothing else', () => {
    expect(isFilmRecord('film')).toBe(true);
    expect(isFilmRecord('film-kq3-0a1b')).toBe(true);
    expect(isFilmRecord('scene-1')).toBe(false);
    expect(isFilmRecord('filmy')).toBe(false);
  });
  it('never lets a removed scene take a picture any film uses', () => {
    const scene = { id: 's', images: { place: 'C:/g/b.png', piece: 'C:/g/x.png' } } as unknown as Scene;
    expect(filesOwnedBy(scene, [], [a, b])).toEqual(['C:/g/x.png']);
  });
});
