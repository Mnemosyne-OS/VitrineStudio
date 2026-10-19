import { describe, expect, it } from 'vitest';
import { anyMaking, makeSceneRefusal, sceneBusy, validateSceneRefusal } from './agentGuards';
import type { Scene } from '../model/types';

const scene = (id: string, images: Scene['images'] = {}, agentMake?: Scene['agentMake']): Scene => ({
  schema: 1, id, pieceId: 'p', universe: 'Salon', variant: '', placeDescription: 'x', animation: '', aspectRatio: '16:9',
  images, validated: false, createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z', ...(agentMake ? { agentMake } : {}),
});
const ALL = { place: 'a.png', piece: 'b.png', alive: 'c.png' };
const AT = '2026-10-12T09:00:00.000Z';

describe('makeSceneRefusal: one scene at a time, whichever door', () => {
  it('starts when nothing is being made', () => {
    expect(makeSceneRefusal(scene('a'), {}, [scene('a')])).toBeNull();
  });

  it('refuses while ANOTHER scene is being made (the person\'s button counts)', () => {
    expect(makeSceneRefusal(scene('b'), { a: { making: 'place' } }, [scene('a'), scene('b')])).toMatch(/^BUSY: pictures/);
  });

  it('refuses while the request door has written its make but not started its first picture', () => {
    const pending = scene('a', {}, { state: 'making', requestedAt: AT });
    expect(makeSceneRefusal(scene('b'), {}, [pending, scene('b')])).toMatch(/^BUSY: pictures/);
  });

  it('refuses a scene whose clip or layers are running', () => {
    expect(makeSceneRefusal(scene('a'), { a: { clipping: true } }, [])).toMatch(/^BUSY: this scene/);
    expect(makeSceneRefusal(scene('a'), { a: { layering: 'piece' as never } }, [])).toMatch(/^BUSY: this scene/);
  });

  it('refuses a scene that already has its three pictures', () => {
    expect(makeSceneRefusal(scene('a', ALL), {}, [])).toMatch(/^NOTHING_TO_MAKE/);
  });
});

describe('anyMaking / sceneBusy', () => {
  it('a finished agent make, or a done one, is not making', () => {
    expect(anyMaking({}, [scene('a', ALL, { state: 'making', requestedAt: AT }), scene('b', {}, { state: 'done', requestedAt: AT })])).toBe(false);
    expect(anyMaking({ a: { error: { key: 'x' } } })).toBe(false);
  });

  it('a scene is busy with its pictures, its clip or its layers', () => {
    expect(sceneBusy({ a: { making: 'place' } }, 'a')).toBe(true);
    expect(sceneBusy({ a: { clipping: true } }, 'a')).toBe(true);
    expect(sceneBusy({ a: { clipping: true } }, 'b')).toBe(false);
  });
});

describe('validateSceneRefusal', () => {
  it('a scene goes online only with its pictures; going offline is always allowed', () => {
    expect(validateSceneRefusal(scene('a'), true)).toMatch(/^NOT_MADE/);
    expect(validateSceneRefusal(scene('a'), false)).toBeNull();
    expect(validateSceneRefusal(scene('a', ALL), true)).toBeNull();
  });
});
