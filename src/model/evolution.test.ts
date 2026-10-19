import { pieceEvolution, versionDate } from './evolution';
import { keepTakes, putTakeBack } from './takes';
import type { Piece, Scene } from './types';

const piece: Piece = { schema: 1, id: 'p1', name: 'Vase', kind: 'unique', tags: [], photoPath: 'C:/ph/vase-2.jpg', photoTakes: ['C:/ph/vase-1.jpg'], cutout: { from: 'C:/ph/vase-2.jpg', path: 'C:/ph/vase-2-nobg.png' } };
const scene = (id: string, pieceId: string, extra: Partial<Scene> = {}): Scene => ({
  schema: 1, id, pieceId, universe: 'Jardin', variant: 'Bohème', placeDescription: '', animation: '', aspectRatio: '16:9', images: {}, validated: false, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', ...extra,
});

describe('a piece over time', () => {
  it('reads the date the generator wrote in the file name, and none from a file that has none', () => {
    expect(versionDate('C:\g\gen-1791780831854-eb7ea89d.png')?.getTime()).toBe(1791780831854);
    expect(versionDate('C:/scenes/jardin-3b.png')).toBeUndefined();
  });

  it('lists each picture oldest first, the one in use last and marked, with no date where none is known', () => {
    const s = scene('s1', 'p1', {
      images: { place: 'C:/scenes/jardin-3.png', alive: 'C:/g/gen-1791780831854-a.png' },
      takes: { alive: ['C:/g/gen-1791691931441-b.png', 'C:/g/gen-1791583139238-c.png'] },
    });
    const ev = pieceEvolution(piece, [s]);
    const alive = ev.scenes[0]!.beats.alive!;
    expect(alive.map((v) => v.path)).toEqual(['C:/g/gen-1791583139238-c.png', 'C:/g/gen-1791691931441-b.png', 'C:/g/gen-1791780831854-a.png']);
    expect(alive.map((v) => v.current)).toEqual([false, false, true]);
    const place = ev.scenes[0]!.beats.place!;
    expect(place).toEqual([{ path: 'C:/scenes/jardin-3.png', current: true }]);
    expect(ev.scenes[0]!.beats.piece).toBeUndefined();
  });

  it('keeps the record order even when only some versions carry a date', () => {
    const s = scene('s1', 'p1', { images: { alive: 'C:/i/own.png' }, takes: { alive: ['C:/g/gen-1791780831854-a.png'] } });
    expect(pieceEvolution(piece, [s]).scenes[0]!.beats.alive!.map((v) => v.path)).toEqual(['C:/g/gen-1791780831854-a.png', 'C:/i/own.png']);
  });

  it('takes the piece photos and cut-out, the clips, and only the scenes of this piece', () => {
    const ev = pieceEvolution(piece, [scene('s1', 'p1', { clipPath: 'C:/v/2.mp4', clipTakes: [{ path: 'C:/v/1.mp4' }] }), scene('s2', 'other')]);
    expect(ev.photos.map((v) => [v.path, v.current, v.cutout ?? false])).toEqual([['C:/ph/vase-1.jpg', false, false], ['C:/ph/vase-2.jpg', true, false], ['C:/ph/vase-2-nobg.png', false, true]]);
    expect(ev.scenes.map((x) => x.scene.id)).toEqual(['s1']);
    expect(ev.scenes[0]!.clips.map((v) => v.path)).toEqual(['C:/v/1.mp4', 'C:/v/2.mp4']);
    expect(ev.count).toBe(5);
  });

  it('puts a line in time order when every version is dated, even after a version was put back and redone', () => {
    const A = 'C:/g/gen-1791583139238-a.png', B = 'C:/g/gen-1791691931441-b.png', C = 'C:/g/gen-1791780831854-c.png';
    // 9 oct A; 11 oct redone into B; A put back; 12 oct redone into C: the record keeps [A, B], last moved first.
    let s = scene('s1', 'p1', { images: { alive: A } });
    s = { ...keepTakes(s, ['alive'], false), images: { alive: B } };
    s = putTakeBack(s, 'alive', A);
    s = { ...keepTakes(s, ['alive'], false), images: { alive: C } };
    expect(s.takes!.alive).toEqual([A, B]);
    expect(pieceEvolution(piece, [s]).scenes[0]!.beats.alive!.map((v) => v.path)).toEqual([A, B, C]);
    // A version older than a kept one, put back: it stays in its place in time, still marked in use.
    const back = pieceEvolution(piece, [scene('s1', 'p1', { images: { alive: A }, takes: { alive: [B] } })]).scenes[0]!.beats.alive!;
    expect(back.map((v) => [v.path, v.current])).toEqual([[A, true], [B, false]]);
  });
});
