import { archiveScene, deleteSceneForGood, filesOwnedBy } from './removeScene';
import type { FolderIO } from './folderStore';
import { newScene } from '../model/records';
import { newFilm, type Film } from '../model/filmRecord';
import type { Scene } from '../model/types';

const make = (id: string, images: Scene['images'], extra: Partial<Scene> = {}): Scene => ({
  ...newScene({ pieceId: 'p1', universe: 'Salon', variant: id, placeDescription: 'A room', animation: 'pothos', aspectRatio: '16:9' }),
  id,
  images,
  ...extra,
});

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

describe('filesOwnedBy', () => {
  it('takes the scene’s layers with it, and keeps one another scene still points at', () => {
    const lf = (path: string) => ({ path, x: 1, y: 1, w: 1, h: 1 });
    const layers = { from: { place: 'C:/a.png', piece: 'C:/b.png', alive: 'C:/c.png' }, pot: lf('C:/l/pot.png'), potAlive: lf('C:/l/pa.png'), swayMap: 'C:/l/map.png', pivot: { x: 1, y: 1 }, madeAt: 'x' };
    const s = make('s1', { place: 'C:/a.png', piece: 'C:/b.png', alive: 'C:/c.png' }, { layers });
    const other = make('s2', { place: 'C:/l/map.png' });
    const owned = filesOwnedBy(s, [s, other], null);
    expect(owned).toEqual(expect.arrayContaining(['C:/l/pot.png', 'C:/l/pa.png']));
    expect(owned).not.toContain('C:/l/map.png');
  });

  const s = make('s1', { place: 'C:/g/a.png', piece: 'C:/g/b.png', alive: 'C:/g/c.png' }, { clipPath: 'C:/g/c.mp4', animationRefPath: 'C:/me/plant.jpg' });

  it('takes the pictures and the clip the studio made, never the photo the person gave', () => {
    expect(filesOwnedBy(s, [s], null)).toEqual(['C:/g/a.png', 'C:/g/b.png', 'C:/g/c.png', 'C:/g/c.mp4']);
  });

  it('keeps the photo an enhanced place was made from, and takes the enhanced copy', () => {
    const files = filesOwnedBy({ ...s, placeSourcePath: 'C:/me/room.jpg' }, [], null);
    expect(files).not.toContain('C:/me/room.jpg');
    expect(files).toContain('C:/g/a.png');
  });
  it('keeps a place that is the person own photo', () => {
    expect(filesOwnedBy({ ...s, placeFromPhoto: true }, [], null)).not.toContain('C:/g/a.png');
  });

  it('keeps a file another scene or the film still uses, whatever the path spelling', () => {
    const other = make('s2', { place: 'c:\\G\\a.png' });
    const film: Film = { ...newFilm('ceramics-plants', '16:9'), clips: { making: 'C:/g/c.mp4' } };
    expect(filesOwnedBy(s, [s, other], film)).toEqual(['C:/g/b.png', 'C:/g/c.png']);
  });
});

describe('archiveScene', () => {
  it('writes the archived copy before removing the record', async () => {
    const host = io();
    await archiveScene(host, 'C:/studio', make('s1', {}), '2026-10-10T00:00:00Z');
    expect(host.calls).toEqual(['mkdir C:/studio/archive/scenes', 'write C:/studio/archive/scenes/s1.json', 'delete C:/studio/scenes/s1.json']);
  });

  it('never removes the record when the archived copy could not be written', async () => {
    const host = io({ 'C:/studio/archive/scenes/s1.json': 'disk full' });
    await expect(archiveScene(host, 'C:/studio', make('s1', {}), 'now')).rejects.toThrow();
    expect(host.calls.some((c) => c.startsWith('delete'))).toBe(false);
  });
});

describe('deleteSceneForGood', () => {
  it('removes the record first, then the files, and tells which files stayed', async () => {
    const host = io({ 'C:/g/b.png': 'locked', 'C:/g/c.png': 'File does not exist' });
    const left = await deleteSceneForGood(host, 'C:/studio', make('s1', {}), ['C:/g/a.png', 'C:/g/b.png', 'C:/g/c.png']);
    expect(host.calls[0]).toBe('delete C:/studio/scenes/s1.json');
    expect(left).toEqual(['C:/g/b.png']);
  });

  it('deletes no picture when the record could not be removed', async () => {
    const host = io({ 'C:/studio/scenes/s1.json': 'denied' });
    await expect(deleteSceneForGood(host, 'C:/studio', make('s1', {}), ['C:/g/a.png'])).rejects.toThrow();
    expect(host.calls).toEqual(['delete C:/studio/scenes/s1.json']);
  });
});

describe('filesOwnedBy, enlarged pictures', () => {
  it('takes the enlarged picture and the original it was made from', () => {
    const s = make('s1', { place: 'C:/g/a-2560w.png', piece: 'C:/g/b.png' }, { enlarged: { place: { from: 'C:/g/a.png', scale: 2 } } });
    expect(filesOwnedBy(s, [], null).sort()).toEqual(['C:/g/a-2560w.png', 'C:/g/a.png', 'C:/g/b.png']);
  });

  it('never the person own photo of the place, even enlarged, even when it was already wide enough', () => {
    const enlarged = make('s1', { place: 'C:/me/room-2560w.png' }, { placeFromPhoto: true, enlarged: { place: { from: 'C:/me/room.jpg', scale: 2 } } });
    expect(filesOwnedBy(enlarged, [], null)).toEqual(['C:/me/room-2560w.png']);
    const wide = make('s2', { place: 'C:/me/room.jpg' }, { placeFromPhoto: true, enlarged: { place: { from: 'C:/me/room.jpg', scale: 2 } } });
    expect(filesOwnedBy(wide, [], null)).toEqual([]);
  });
});
