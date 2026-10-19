import { upscaleJobs, withEnlarged } from './upscale';
import { newScene, normalizeScene, withoutFrom } from '../model/records';
import type { Scene } from '../model/types';

const scene = (id: string, images: Scene['images'], enlarged?: Scene['enlarged']): Scene => ({
  ...newScene({ pieceId: 'p', universe: 'U', variant: id, placeDescription: 'A room', animation: 'pothos', aspectRatio: '16:9' }),
  id, images, ...(enlarged ? { enlarged } : {}),
});

describe('upscaleJobs', () => {
  it('lists every picture not yet enlarged, beat by beat', () => {
    const jobs = upscaleJobs([scene('a', { place: 'p.png', piece: 'q.png' }), scene('b', {})], 2);
    expect(jobs).toEqual([{ sceneId: 'a', beat: 'place', from: 'p.png' }, { sceneId: 'a', beat: 'piece', from: 'q.png' }]);
  });

  it('skips what is already enlarged that much, and redoes a smaller one from its ORIGINAL', () => {
    const s = scene('a', { place: 'p-x2.png', piece: 'q-x2.png' }, { place: { from: 'p.png', scale: 2 }, piece: { from: 'q.png', scale: 2 } });
    expect(upscaleJobs([s], 2)).toEqual([]);
    expect(upscaleJobs([s], 1.5)).toEqual([]);
    expect(upscaleJobs([s], 3).map((j) => j.from)).toEqual(['p.png', 'q.png']);
  });
});

describe('withEnlarged', () => {
  it('points the beat at the new file and remembers where it came from', () => {
    const s = withEnlarged(scene('a', { place: 'p.png' }), { sceneId: 'a', beat: 'place', from: 'p.png' }, 'p-x2.png', 2, '2026-10-10T00:00:00Z');
    expect(s.images.place).toBe('p-x2.png');
    expect(s.enlarged?.place).toEqual({ from: 'p.png', scale: 2 });
    expect(normalizeScene(JSON.parse(JSON.stringify(s)))?.enlarged).toEqual(s.enlarged);
  });

  it('is dropped with its picture when the beat is remade', () => {
    const s = scene('a', { place: 'p2.png', piece: 'q2.png' }, { place: { from: 'p.png', scale: 2 }, piece: { from: 'q.png', scale: 2 } });
    expect(withoutFrom(s, 'piece').enlarged).toEqual({ place: { from: 'p.png', scale: 2 } });
    expect(withoutFrom(s, 'place').enlarged).toBeUndefined();
  });

  it('reads an enlargement recorded before the factor as one to redo from its original', () => {
    const old = normalizeScene({ ...scene('a', { place: 'p-2560w.png' }), enlarged: { place: { from: 'p.png', width: 2560 } } });
    expect(old?.enlarged?.place).toEqual({ from: 'p.png', scale: 0 });
    expect(upscaleJobs([old!], 1.5)).toEqual([{ sceneId: 'a', beat: 'place', from: 'p.png' }]);
  });
});
