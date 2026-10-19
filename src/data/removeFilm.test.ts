import { archiveFilm, deleteFilmForGood, filesOwnedByFilm } from './removeFilm';
import type { FolderIO } from './folderStore';
import { filmOf } from '../model/film';
import { profileById } from '../model/profiles';
import { newScene } from '../model/records';
import { newFilm, withKeyframe, type Film } from '../model/filmRecord';

const steps = filmOf(profileById('ceramics-plants')).steps;

function io(fail: Record<string, string> = {}): FolderIO & { calls: string[] } {
  const calls: string[] = [];
  const answer = (op: string, path: string) => {
    calls.push(`${op} ${path}`);
    return Promise.resolve(fail[path] ? { success: false, error: fail[path] } : { success: true });
  };
  return {
    calls,
    mkdir: (p) => answer('mkdir', p),
    readDir: () => Promise.resolve({ success: true, files: [] }),
    readFile: () => Promise.resolve({ success: false, error: 'File does not exist' }),
    writeFile: (p) => answer('write', p),
    deleteFile: (p) => answer('delete', p),
  };
}

/** A second film: two made pictures, a clip, her workshop photo and her portrait. */
const film: Film = {
  ...newFilm('ceramics-plants', '16:9', new Date(), 'film-b'),
  workshopPhotoPath: 'C:/me/atelier.jpg', portraitPath: 'C:/me/moi.jpg',
  keyframes: { [steps[0]!.id]: 'C:/g/k0.png', [steps[1]!.id]: 'C:/g/k1.png' },
  conformed: { [steps[1]!.id]: 'C:/g/k1-crop.png' },
  clips: { [steps[1]!.id]: 'C:/g/c1.mp4' },
};

describe('a film removed for good', () => {
  it('takes what the studio made for it, never what she brought', () => {
    const files = filesOwnedByFilm(film, [film], []);
    expect(files.sort()).toEqual(['C:/g/c1.mp4', 'C:/g/k0.png', 'C:/g/k1-crop.png', 'C:/g/k1.png']);
  });
  it('never takes a picture of the chain that is her own photo', () => {
    const mine = withKeyframe(film, steps[1]!.id, 'C:/me/tour.jpg', steps, true);
    expect(mine.ownFrames).toEqual([steps[1]!.id]);
    expect(filesOwnedByFilm(mine, [mine], [])).toEqual(['C:/g/k0.png']);
    // Changed again by the studio: no longer hers.
    expect(withKeyframe(mine, steps[1]!.id, 'C:/g/decor.png', steps).ownFrames).toBeUndefined();
  });
  it('never takes a file another film or a scene still uses', () => {
    const other = { ...newFilm('ceramics-plants', '16:9'), keyframes: { [steps[0]!.id]: 'C:/g/k0.png' } };
    const scene = { ...newScene({ pieceId: 'p1', universe: 'Salon', variant: 'v', placeDescription: 'A room', animation: 'pothos', aspectRatio: '16:9' }), images: { place: 'C:/G/C1.MP4' } };
    expect(filesOwnedByFilm(film, [film, other], [scene]).sort()).toEqual(['C:/g/k1-crop.png', 'C:/g/k1.png']);
  });
  it('removes its record first, from its own file, then the files, and tells the ones left', async () => {
    const host = io({ 'C:/g/k1.png': 'locked' });
    const left = await deleteFilmForGood(host, 'C:/studio', film, ['C:/g/k0.png', 'C:/g/k1.png']);
    expect(host.calls[0]).toBe('delete C:/studio/studio/films/film-b.json');
    expect(left).toEqual(['C:/g/k1.png']);
  });
  it('removes the first film from film.json, and accepts a film never written', async () => {
    const host = io({ 'C:/studio/studio/film.json': 'File does not exist' });
    await expect(deleteFilmForGood(host, 'C:/studio', newFilm('ceramics-plants', '16:9'), [])).resolves.toEqual([]);
    expect(host.calls).toEqual(['delete C:/studio/studio/film.json']);
  });
});

describe('a film archived', () => {
  it('is written to the archive BEFORE its record is removed, its files untouched', async () => {
    const host = io();
    await archiveFilm(host, 'C:/studio', film, '2026-10-11T12:00:00Z');
    expect(host.calls).toEqual(['mkdir C:/studio/archive/films', 'write C:/studio/archive/films/film-b.json', 'delete C:/studio/studio/films/film-b.json']);
  });
  it('keeps everything when the archive cannot be written', async () => {
    const host = io({ 'C:/studio/archive/films/film-b.json': 'disk full' });
    await expect(archiveFilm(host, 'C:/studio', film, '2026-10-11T12:00:00Z')).rejects.toThrow();
    expect(host.calls.some((c) => c.startsWith('delete'))).toBe(false);
  });
});
