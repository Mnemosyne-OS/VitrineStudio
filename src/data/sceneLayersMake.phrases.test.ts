/**
 * makeSceneLayers hands each beat its own phrases (doc 189 §5): the piece beat
 * the piece's, the living beat the living's. The cut is stopped after the
 * second call: what follows is the canvas arithmetic, tested on its own.
 */
import { describe, it, expect, vi } from 'vitest';
import { makeSceneLayers, type LayerDeps } from './sceneLayersMake';
import type { Scene } from '../model/types';

const scene = { id: 's1', images: { place: 'C:/a.png', piece: 'C:/b.png', alive: 'C:/c.png' } } as unknown as Scene;

describe('makeSceneLayers phrases', () => {
  it('the piece beat gets the piece phrases, the living beat the living ones', async () => {
    const cut = vi.fn(async (_p: string, _phrases?: string[]) => {
      if (cut.mock.calls.length === 2) throw new Error('STOP_HERE');
      return 'C:/cut.png';
    });
    const deps: LayerDeps = { read: vi.fn(), cut, save: vi.fn(), now: () => new Date(0) };
    await expect(makeSceneLayers(scene, deps, () => {}, { piece: ['the ceramic piece'], alive: ['the ceramic piece', 'the plant'] }))
      .rejects.toThrow('STOP_HERE');
    expect(cut.mock.calls).toEqual([['C:/b.png', ['the ceramic piece']], ['C:/c.png', ['the ceramic piece', 'the plant']]]);
  });

  it('no phrases: the cut is asked exactly as before', async () => {
    const cut = vi.fn(async () => { throw new Error('STOP_HERE'); });
    const deps: LayerDeps = { read: vi.fn(), cut, save: vi.fn(), now: () => new Date(0) };
    await expect(makeSceneLayers(scene, deps)).rejects.toThrow('STOP_HERE');
    expect(cut).toHaveBeenCalledWith('C:/b.png', undefined);
  });
});
