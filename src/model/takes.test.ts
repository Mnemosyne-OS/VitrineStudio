import { dropTake, keepTakes, MAX_TAKES, putClipBack, putTakeBack, takeFileFree, takePaths } from './takes';
import { newScene, normalizeScene, withoutFrom } from './records';
import type { Scene } from './types';

const full = (): Scene => ({
  ...newScene({ pieceId: 'p', universe: 'U', variant: 'V', placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9' }),
  images: { place: 'a', piece: 'b', alive: 'c' }, decorChange: 0.03, clipPath: 'v1.mp4', clipCut: { in: 0.5, out: 5 },
});

describe('takes', () => {
  it('keeps what a redo throws away: the redone picture, the ones after it, and the clip', () => {
    const redo = withoutFrom(full(), 'piece');
    expect(redo.images).toEqual({ place: 'a' });
    expect(redo.takes).toEqual({ piece: ['b'], alive: ['c'] });
    expect(redo.clipTakes).toEqual([{ path: 'v1.mp4', cut: { in: 0.5, out: 5 } }]);
  });

  it('puts a picture back, the current one becoming a take, and forgets what was measured on the other pair', () => {
    const s = { ...full(), takes: { alive: ['c0'] } };
    const back = putTakeBack(s, 'alive', 'c0');
    expect(back.images.alive).toBe('c0');
    expect(back.takes?.alive).toEqual(['c']);
    expect(back).not.toHaveProperty('decorChange');
  });

  it('puts a clip back with its own cut', () => {
    const s = { ...full(), clipTakes: [{ path: 'v0.mp4' }] };
    const back = putClipBack(s, 'v0.mp4');
    expect(back.clipPath).toBe('v0.mp4');
    expect(back).not.toHaveProperty('clipCut');
    expect(back.clipTakes).toEqual([{ path: 'v1.mp4', cut: { in: 0.5, out: 5 } }]);
  });

  it('drops a take, and never calls a file free while the scene still shows it', () => {
    const s = { ...full(), takes: { alive: ['c0'] } };
    expect(dropTake(s, 'alive', 'c0').takes?.alive).toEqual([]);
    expect(takeFileFree(s, 'c')).toBe(false);
    expect(takeFileFree(s, 'c0')).toBe(true);
    expect(takeFileFree({ ...s, clipFrames: { piece: 'w', alive: 'w2', from: { piece: 'b', alive: 'c0' } } }, 'c0')).toBe(false);
  });

  it('keeps at most MAX_TAKES, newest first, without doubles', () => {
    let s = full();
    for (let i = 0; i < MAX_TAKES + 3; i++) s = keepTakes({ ...s, images: { ...s.images, alive: `c${i}` } }, ['alive'], false);
    expect(s.takes?.alive).toHaveLength(MAX_TAKES);
    expect(s.takes?.alive?.[0]).toBe(`c${MAX_TAKES + 2}`);
    expect(takePaths(s)).toHaveLength(MAX_TAKES);
  });

  it('reads takes back from disk, dropping the current picture and junk', () => {
    const raw = JSON.parse(JSON.stringify({ ...full(), takes: { alive: ['c0', 'c', 3, 'c0'] }, clipTakes: [{ path: 'v0.mp4', cut: { in: 2, out: 1 } }, { path: 'v1.mp4' }, 'x'] }));
    const s = normalizeScene(raw)!;
    expect(s.takes).toEqual({ alive: ['c0'] });
    expect(s.clipTakes).toEqual([{ path: 'v0.mp4' }]);
  });
});
