import { makeBeat, BeatError, type BeatDeps } from './makeBeat';
import { ENHANCE_PLACE_PROMPT, profileById } from '../model/profiles';
import { newScene } from '../model/records';
import { DEFAULT_SETTINGS, type Piece, type Scene } from '../model/types';

const piece: Piece = { schema: 1, id: 'p1', name: 'Vase', kind: 'unique', tags: [], photoPath: 'C:/home/vase.jpg', description: 'matte grey stoneware' };
const profile = profileById('ceramics-plants');

function deps(over: Partial<BeatDeps> = {}): BeatDeps & { calls: unknown[] } {
  const calls: unknown[] = [];
  let n = 0;
  return {
    calls,
    generate: vi.fn(async (req) => { calls.push(req); return { path: `C:/gen/${++n}.png`, model: 'm' }; }),
    measure: vi.fn(async () => 0.04),
    modelFor: (q) => (q === 'fast' ? 'cheap' : 'best'),
    now: () => new Date('2026-10-09T12:00:00Z'),
    ...over,
  };
}

const scene = () => newScene({ pieceId: 'p1', universe: 'Salon', variant: 'Console', placeDescription: 'A calm living room', animation: 'pothos', aspectRatio: '16:9' });

describe('makeBeat', () => {
  it('draws the place from the words, in the scene shape, with the chosen quality', async () => {
    const d = deps();
    const s = await makeBeat('place', scene(), piece, profile, DEFAULT_SETTINGS, d);
    expect(d.calls[0]).toMatchObject({ aspectRatio: '16:9', modelId: 'best' });
    expect((d.calls[0] as { prompt: string }).prompt).toContain('A calm living room');
    expect(s.images.place).toBe('C:/gen/1.png');
  });

  it("ends the instruction with the person's own word for THAT picture only", async () => {
    const d = deps();
    const withPlace = { ...scene(), images: { place: 'C:/gen/place.png' }, beatNotes: { piece: 'A little more to the left.', alive: 'Taller.' } };
    await makeBeat('piece', withPlace, piece, profile, DEFAULT_SETTINGS, d);
    const prompt = (d.calls[0] as { prompt: string }).prompt;
    expect(prompt).toMatch(/A little more to the left\.$/);
    expect(prompt).not.toContain('Taller.');
  });

  it("sets the piece as an EDIT of the place, with the person's photo as reference, and measures the room", async () => {
    const d = deps();
    const withPlace = { ...scene(), images: { place: 'C:/gen/place.png' } };
    const s = await makeBeat('piece', withPlace, piece, profile, DEFAULT_SETTINGS, d);
    expect(d.calls[0]).toMatchObject({ editImagePath: 'C:/gen/place.png', refImagePaths: ['C:/home/vase.jpg'] });
    expect((d.calls[0] as { prompt: string }).prompt).toContain('matte grey stoneware');
    expect(d.measure).toHaveBeenCalledWith('C:/gen/place.png', 'C:/gen/1.png');
    expect(s.decorChange).toBe(0.04);
  });

  it('leaves the room change ABSENT when the measure fails, never 0', async () => {
    const d = deps({ measure: vi.fn(async () => { throw new Error('PICTURE_UNDECODABLE'); }) });
    const s = await makeBeat('piece', { ...scene(), images: { place: 'a' }, decorChange: 0.5 }, piece, profile, DEFAULT_SETTINGS, d);
    expect(s).not.toHaveProperty('decorChange');
  });

  it('refuses each beat whose previous one is missing, before spending', async () => {
    const d = deps();
    await expect(makeBeat('piece', scene(), piece, profile, DEFAULT_SETTINGS, d)).rejects.toThrow(BeatError);
    await expect(makeBeat('alive', { ...scene(), images: { place: 'a' } }, piece, profile, DEFAULT_SETTINGS, d)).rejects.toThrow('NO_PIECE_YET');
    expect(d.generate).not.toHaveBeenCalled();
  });

  it('refuses to stage a piece that has no photo instead of drawing it from words', async () => {
    const d = deps();
    const { photoPath: _drop, ...noPhoto } = piece;
    await expect(makeBeat('piece', { ...scene(), images: { place: 'a' } }, noPhoto as Piece, profile, DEFAULT_SETTINGS, d)).rejects.toThrow('PIECE_HAS_NO_PHOTO');
    expect(d.generate).not.toHaveBeenCalled();
  });

  it('adds the living thing as an edit of the piece, with the optional photo', async () => {
    const d = deps();
    await makeBeat('alive', { ...scene(), images: { place: 'a', piece: 'b' }, animationRefPath: 'C:/home/plant.jpg' }, piece, profile, DEFAULT_SETTINGS, d);
    expect(d.calls[0]).toMatchObject({ editImagePath: 'b', refImagePaths: ['C:/home/plant.jpg'] });
  });

  it('a new picture un-validates the scene: what goes online was seen', async () => {
    const s = await makeBeat('alive', { ...scene(), images: { place: 'a', piece: 'b' }, validated: true }, piece, profile, DEFAULT_SETTINGS, deps());
    expect(s.validated).toBe(false);
  });
});

describe("the person's own instruction", () => {
  it('is sent as written for its beat, and the others stay automatic', async () => {
    const reqs: Array<{ prompt: string }> = [];
    const d = {
      generate: async (req: { prompt: string }) => { reqs.push(req); return { path: `C:/g${reqs.length}.png`, model: 'm' }; },
      measure: async () => 0.01,
      modelFor: () => 'm',
      now: () => new Date('2026-10-09T10:00:00Z'),
    };
    const profile = profileById('ceramics-plants');
    const piece = { schema: 1 as const, id: 'p', name: 'Vase', kind: 'unique' as const, tags: [], photoPath: 'C:/p.jpg' };
    let scene: Scene = { ...newScene({ pieceId: 'p', universe: 'U', variant: 'V', placeDescription: 'A calm room', animation: 'pothos', aspectRatio: '16:9' }), prompts: { piece: 'MY OWN WORDS' } };
    scene = await makeBeat('place', scene, piece, profile, DEFAULT_SETTINGS, d);
    await makeBeat('piece', scene, piece, profile, DEFAULT_SETTINGS, d);
    expect(reqs[0]!.prompt).toMatch(/^A calm room\./);
    expect(reqs[1]!.prompt).toBe('MY OWN WORDS');
  });
});

describe("the person's own photo, enhanced", () => {
  it('makes the place as an edit OF that photo, never a new room, and needs no description', async () => {
    const reqs: Array<{ prompt: string; editImagePath?: string; aspectRatio?: string }> = [];
    const d = {
      generate: async (req: { prompt: string }) => { reqs.push(req); return { path: 'C:/g/place.png', model: 'm' }; },
      measure: async () => 0.01,
      modelFor: () => 'm',
      now: () => new Date('2026-10-10T10:00:00Z'),
    };
    const piece = { schema: 1 as const, id: 'p', name: 'Vase', kind: 'unique' as const, tags: [], photoPath: 'C:/p.jpg' };
    const scene: Scene = { ...newScene({ pieceId: 'p', universe: 'U', variant: 'V', placeDescription: '', animation: 'pothos', aspectRatio: '16:9' }), placeSourcePath: 'C:/my/room.jpg' };
    const made = await makeBeat('place', scene, piece, profileById('ceramics-plants'), DEFAULT_SETTINGS, d);
    expect(reqs[0]!.editImagePath).toBe('C:/my/room.jpg');
    expect(reqs[0]!.prompt).toBe(ENHANCE_PLACE_PROMPT);
    // The photo's own shape: no ratio forced on an edit.
    expect(reqs[0]!.aspectRatio).toBeUndefined();
    expect(made.images.place).toBe('C:/g/place.png');
    expect(made.placeSourcePath).toBe('C:/my/room.jpg');
  });
});

describe('the piece at its real size', () => {
  it('tells the model the measures on the piece and alive beats, before her word', async () => {
    const d = deps();
    const withPlace = { ...scene(), images: { place: 'C:/gen/place.png' }, beatNotes: { piece: 'Left.' } };
    await makeBeat('piece', withPlace, piece, profile, DEFAULT_SETTINGS, d, { l: 14, w: 14, h: 22 });
    const prompt = (d.calls[0] as { prompt: string }).prompt;
    expect(prompt).toContain('14 cm long, 14 cm wide and 22 cm high');
    expect(prompt).toMatch(/high\..*Left\.$/);
    const d2 = deps();
    await makeBeat('alive', { ...withPlace, images: { place: 'C:/a.png', piece: 'C:/b.png' } }, piece, profile, DEFAULT_SETTINGS, d2, { h: 30 });
    expect((d2.calls[0] as { prompt: string }).prompt).toContain('30 cm high');
  });

  it('says nothing of size on the room alone, nor when no measure is given', async () => {
    const d = deps();
    await makeBeat('place', scene(), piece, profile, DEFAULT_SETTINGS, d, { h: 30 });
    expect((d.calls[0] as { prompt: string }).prompt).not.toContain('Real size');
    const d2 = deps();
    await makeBeat('piece', { ...scene(), images: { place: 'C:/p.png' } }, piece, profile, DEFAULT_SETTINGS, d2, {});
    expect((d2.calls[0] as { prompt: string }).prompt).not.toContain('Real size');
  });
});
