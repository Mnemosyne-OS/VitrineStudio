import { inShape, wideFrames, type ClipFrameDeps } from './clipFrames';
import { newScene } from '../model/records';

const made = () => ({ ...newScene({ pieceId: 'p', universe: 'U', variant: 'V', placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9' }), images: { place: 'a', piece: 'b', alive: 'c' } });

function deps(sizes: Record<string, { w: number; h: number }>): ClipFrameDeps & { asked: Array<Record<string, unknown>> } {
  const asked: Array<Record<string, unknown>> = [];
  return {
    asked,
    generate: vi.fn(async (req) => { asked.push(req); return { path: req.refImagePaths ? 'wide-c' : 'wide-b' }; }),
    sizeOf: vi.fn(async (p: string) => sizes[p] ?? { w: 0, h: 0 }),
    conform: vi.fn(async () => 'wide-c-cropped'),
  };
}

describe('clip frames', () => {
  it('knows the video shape within 2 %', () => {
    expect(inShape({ w: 1280, h: 720 }, '16:9')).toBe(true);
    expect(inShape({ w: 1376, h: 768 }, '16:9')).toBe(true);
    expect(inShape({ w: 1024, h: 1024 }, '16:9')).toBe(false);
    expect(inShape({ w: 0, h: 0 }, '16:9')).toBe(false);
  });

  it('extends the creation picture, then redoes the living one ON it, and keeps both', async () => {
    const d = deps({ b: { w: 1024, h: 1024 }, c: { w: 1024, h: 1024 }, 'wide-b': { w: 1376, h: 768 }, 'wide-c': { w: 1376, h: 768 } });
    const s = await wideFrames(made(), 'm', d);
    expect(d.asked[0]).toMatchObject({ editImagePath: 'b', aspectRatio: '16:9', modelId: 'm' });
    expect(d.asked[1]).toMatchObject({ editImagePath: 'wide-b', refImagePaths: ['c'] });
    expect(s.clipFrames).toEqual({ piece: 'wide-b', alive: 'wide-c', from: { piece: 'b', alive: 'c' } });
    expect(s.images).toEqual(made().images);
  });

  it('costs nothing again for the same pictures, nor for pictures already in shape', async () => {
    const d = deps({ b: { w: 1280, h: 720 }, c: { w: 1280, h: 720 } });
    await wideFrames({ ...made(), clipFrames: { piece: 'x', alive: 'y', from: { piece: 'b', alive: 'c' } } }, 'm', d);
    const s = await wideFrames(made(), 'm', d);
    expect(d.generate).not.toHaveBeenCalled();
    expect(s.clipFrames).toBeUndefined();
  });

  it('makes new frames when a picture was redone', async () => {
    const d = deps({ b: { w: 1024, h: 1024 }, c: { w: 1024, h: 1024 }, 'wide-b': { w: 1376, h: 768 }, 'wide-c': { w: 1376, h: 768 } });
    const s = await wideFrames({ ...made(), clipFrames: { piece: 'x', alive: 'y', from: { piece: 'b', alive: 'old' } } }, 'm', d);
    expect(d.generate).toHaveBeenCalledTimes(2);
    expect(s.clipFrames?.from.alive).toBe('c');
  });

  it('stops before the second picture when the first did not come back in shape', async () => {
    const d = deps({ b: { w: 1024, h: 1024 }, c: { w: 1024, h: 1024 }, 'wide-b': { w: 1024, h: 1024 } });
    const s = await wideFrames(made(), 'm', d);
    expect(d.generate).toHaveBeenCalledTimes(1);
    expect(s.clipFrames).toBeUndefined();
  });

  it('crops the living frame to the first when the model returned another size', async () => {
    const d = deps({ b: { w: 1024, h: 1024 }, c: { w: 1024, h: 1024 }, 'wide-b': { w: 1376, h: 768 }, 'wide-c': { w: 1392, h: 768 } });
    const s = await wideFrames(made(), 'm', d);
    expect(d.conform).toHaveBeenCalledWith('wide-c', { w: 1376, h: 768 }, expect.stringContaining('clip-alive'));
    expect(s.clipFrames?.alive).toBe('wide-c-cropped');
  });
});
