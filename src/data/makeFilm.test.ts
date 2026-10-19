import { conformKeyframes, frameFor, makeKeyframe, startFilmClip, type FilmDeps } from './makeFilm';
import { coverCrop } from './frames';
import type { ClipDeps } from './makeClip';
import { FILMS, filmOf, filmPrompts, FILM_NEGATIVE } from '../model/film';
import { PROFILES, profileById } from '../model/profiles';
import { clipsToMake, filmComplete, filmWithoutFrom, newFilm, nextKeyframe, normalizeFilm, type Film } from '../model/filmRecord';
import type { Piece } from '../model/types';

const profile = profileById('ceramics-plants');
const steps = filmOf(profile).steps;
const piece: Piece = { schema: 1, id: 'p1', name: 'Vase', kind: 'unique', tags: [], photoPath: 'C:/p1.jpg' };
const base = (): Film => ({ ...newFilm(profile.id, '16:9'), pieceId: 'p1', animation: 'pothos' });

function deps(sizes: Record<string, { w: number; h: number }> = {}): FilmDeps & { reqs: unknown[]; conformed: string[] } {
  const reqs: unknown[] = [];
  const conformed: string[] = [];
  let n = 0;
  return {
    reqs,
    conformed,
    generate: vi.fn(async (req) => { reqs.push(req); return { path: `C:/gen-${++n}.png`, model: 'm' }; }),
    modelFor: (q) => (q === 'fast' ? 'fast-model' : 'pro-model'),
    sizeOf: async (path) => sizes[path] ?? { w: 1376, h: 768 },
    conform: vi.fn(async (path) => { conformed.push(path); return `${path}.fit.png`; }),
    now: () => new Date('2026-10-09T10:00:00Z'),
  };
}

describe('film prompts, every trade', () => {
  it('gives every trade a chain: a first picture with its photo variant, then a clip to each next one', () => {
    for (const p of PROFILES) {
      const film = FILMS[p.id]!;
      expect(film.steps.length).toBeGreaterThanOrEqual(3);
      expect(film.steps[0]!.photoPrompt).toBeTruthy();
      expect(film.steps[0]!.clip).toBeUndefined();
      film.steps.slice(1).forEach((s) => expect(s.clip, `${p.id}/${s.id}`).toBeTruthy());
      expect(film.steps.some((s) => s.refs.includes('piece')), p.id).toBe(true);
    }
  });

  it('never gives the person a gender, and leaves no hole unfilled', () => {
    for (const p of PROFILES) {
      for (const hasPortrait of [true, false]) {
        for (const fromPhoto of [true, false]) {
          const out = filmPrompts({ profile: p, workshopDescription: '', fromPhoto, hasPortrait, animation: p.animations[0]!.id });
          for (const o of out) {
            const all = `${o.prompt} ${o.clip ?? ''}`;
            expect(all, `${p.id}/${o.id}`).not.toMatch(/\{\w+\}/);
            expect(all, `${p.id}/${o.id}`).not.toMatch(/\b(woman|man|she|he|her|his|female|male)\b/i);
          }
        }
      }
    }
  });

  it('shows the face only with a portrait, and edits the workshop photo when there is one', () => {
    const withP = filmPrompts({ profile, workshopDescription: 'my shop', fromPhoto: false, hasPortrait: true, animation: 'pothos' });
    const without = filmPrompts({ profile, workshopDescription: '', fromPhoto: true, hasPortrait: false, animation: 'pothos' });
    expect(withP[1]!.prompt).toMatch(/portrait reference/);
    expect(without[1]!.prompt).toMatch(/face stays out of the frame/);
    expect(withP[0]!.prompt).toMatch(/^my shop\./);
    expect(without[0]!.prompt).toMatch(/^Edit the image\. Keep this workshop/);
  });
});

describe('keyframes', () => {
  it('makes the first from words in the video shape, then edits each from the one before with the portrait', async () => {
    const d = deps();
    let f: Film = { ...base(), portraitPath: 'C:/me.jpg' };
    f = await makeKeyframe(f, steps[0]!, piece, profile, 'quality', d);
    f = await makeKeyframe(f, steps[1]!, piece, profile, 'quality', d);
    expect(d.reqs[0]).toMatchObject({ aspectRatio: '16:9', modelId: 'pro-model' });
    expect(d.reqs[0]).not.toHaveProperty('editImagePath');
    expect(d.reqs[1]).toMatchObject({ editImagePath: 'C:/gen-1.png', refImagePaths: ['C:/me.jpg'] });
    expect(f.keyframes).toEqual({ workshop: 'C:/gen-1.png', making: 'C:/gen-2.png' });
    expect(nextKeyframe(f, steps)!.id).toBe('raw');
  });

  it('edits the workshop photo instead of drawing one, in the video shape', async () => {
    const d = deps();
    await makeKeyframe({ ...base(), workshopPhotoPath: 'C:/shop.jpg' }, steps[0]!, piece, profile, 'fast', d);
    expect(d.reqs[0]).toMatchObject({ editImagePath: 'C:/shop.jpg', aspectRatio: '16:9', modelId: 'fast-model' });
  });

  it('refuses the creation step without a creation or its photo, before spending', async () => {
    const d = deps();
    const f = { ...base(), keyframes: { workshop: 'a', making: 'b', raw: 'c' } };
    const finished = steps.find((s) => s.refs.includes('piece'))!;
    await expect(makeKeyframe(f, finished, undefined, profile, 'quality', d)).rejects.toThrow('FILM_NO_PIECE');
    await expect(makeKeyframe(f, finished, { ...piece, photoPath: undefined }, profile, 'quality', d)).rejects.toThrow('PIECE_HAS_NO_PHOTO');
    await expect(makeKeyframe(base(), steps[2]!, piece, profile, 'quality', d)).rejects.toThrow('FILM_NO_PREVIOUS');
    expect(d.generate).not.toHaveBeenCalled();
  });

  it('a remake throws away the later keyframes, their crops, clips and jobs', () => {
    const f: Film = {
      ...base(),
      keyframes: { workshop: 'a', making: 'b', raw: 'c', finished: 'd', alive: 'e' },
      conformed: { making: 'b2', finished: 'd2' },
      clips: { making: 'v1', raw: 'v2', finished: 'v3', alive: 'v4' },
      clipJobs: { alive: { id: 'j', startedAt: '2026-10-09T10:00:00Z' } },
      validated: true,
    };
    const r = filmWithoutFrom(f, 'raw', steps);
    expect(r.keyframes).toEqual({ workshop: 'a', making: 'b' });
    expect(r.conformed).toEqual({ making: 'b2' });
    expect(r.clips).toEqual({ making: 'v1' });
    expect(r.clipJobs).toEqual({});
    expect(r.validated).toBe(false);
  });
});

describe('frame sizes', () => {
  it('crops a copy of every keyframe whose size differs from the first, and only those', async () => {
    const d = deps({ 'C:/k2': { w: 1392, h: 768 } });
    const f: Film = { ...base(), keyframes: { workshop: 'C:/k0', making: 'C:/k1', raw: 'C:/k2', finished: 'C:/k3', alive: 'C:/k4' } };
    const out = await conformKeyframes(f, steps, d);
    expect(d.conformed).toEqual(['C:/k2']);
    expect(out.conformed).toEqual({ raw: 'C:/k2.fit.png' });
    expect(frameFor(out, 'raw')).toBe('C:/k2.fit.png');
    expect(frameFor(out, 'making')).toBe('C:/k1');
  });

  it('refuses before measuring when a keyframe is missing', async () => {
    await expect(conformKeyframes({ ...base(), keyframes: { workshop: 'a' } }, steps, deps())).rejects.toThrow('FILM_KEYFRAMES_MISSING');
  });

  it('the cover crop keeps the centre and the target shape', () => {
    expect(coverCrop({ w: 1392, h: 768 }, { w: 1376, h: 768 })).toEqual({ sx: 8, sy: 0, sw: 1376, sh: 768 });
    const c = coverCrop({ w: 1000, h: 1000 }, { w: 1600, h: 900 });
    expect(c.sw / c.sh).toBeCloseTo(1600 / 900);
    expect(c.sx).toBe(0);
    expect(c.sy).toBeCloseTo((1000 - c.sh) / 2);
  });
});

describe('clips', () => {
  const clipDeps = (): ClipDeps & { started: Record<string, unknown>[] } => {
    const started: Record<string, unknown>[] = [];
    return { started, start: vi.fn(async (p) => { started.push(p); return { id: 'job-9', state: 'running' as const, path: null }; }), status: vi.fn(), sleep: async () => {}, now: () => 0 };
  };

  it('starts the clip from the frame before to this one, with the cropped copy and the film rules', async () => {
    const c = clipDeps();
    const f: Film = { ...base(), keyframes: { workshop: 'k0', making: 'k1' }, conformed: { making: 'k1.fit' }, clips: { making: 'old.mp4' }, cuts: { making: { in: 1, out: 4 } } };
    const out = await startFilmClip(f, steps[1]!, piece, profile, c, new Date('2026-10-09T10:00:00Z'));
    expect(c.started[0]).toMatchObject({ startImagePath: 'k0', endImagePath: 'k1.fit', negativePrompt: FILM_NEGATIVE, fit: 'widen', aspectRatio: '16:9', durationSeconds: 6 });
    expect(out.clipJobs).toEqual({ making: { id: 'job-9', startedAt: '2026-10-09T10:00:00.000Z' } });
    expect(out.clips).toEqual({});
    // The new clip has its own timing: the old one's cut goes with it.
    expect(out.cuts).toEqual({});
  });

  it('lists the clips still to make, skipping those made or being made', () => {
    const f: Film = { ...base(), clips: { making: 'v' }, clipJobs: { raw: { id: 'j', startedAt: 'x' } } };
    expect(clipsToMake(f, steps).map((s) => s.id)).toEqual(['finished', 'alive']);
    expect(filmComplete(f, steps)).toBe(false);
  });
});

describe("the person's own instruction in the film", () => {
  it('replaces the keyframe and the clip it was written for, nothing else', async () => {
    const d = deps();
    const f: Film = { ...base(), prompts: { workshop: { image: 'MY WORKSHOP' }, making: { clip: 'MY CLIP' } } };
    const made = await makeKeyframe(f, steps[0]!, piece, profile, 'quality', d);
    await makeKeyframe(made, steps[1]!, piece, profile, 'quality', d);
    expect((d.reqs[0] as { prompt: string }).prompt).toBe('MY WORKSHOP');
    expect((d.reqs[1] as { prompt: string }).prompt).toMatch(/^Edit the first image\./);
    const started: Record<string, unknown>[] = [];
    const c = { start: async (p: Record<string, unknown>) => { started.push(p); return { id: 'j', state: 'running' as const, path: null }; }, status: vi.fn(), sleep: async () => {}, now: () => 0 };
    await startFilmClip({ ...f, keyframes: { workshop: 'a', making: 'b', raw: 'c' } }, steps[1]!, piece, profile, c);
    await startFilmClip({ ...f, keyframes: { workshop: 'a', making: 'b', raw: 'c' } }, steps[2]!, piece, profile, c);
    expect(started[0]!.prompt).toBe('MY CLIP');
    expect(started[1]!.prompt).not.toBe('MY CLIP');
  });

  it('survives a remake and is read back from film.json', () => {
    const f: Film = { ...base(), keyframes: { workshop: 'a', making: 'b' }, prompts: { making: { image: 'X' } } };
    expect(filmWithoutFrom(f, 'workshop', steps).prompts).toEqual({ making: { image: 'X' } });
    expect(normalizeFilm({ profileId: 'ceramics-plants', prompts: { making: { image: ' X ', clip: '' }, ghost: { image: 'y' } } })!.prompts).toEqual({ making: { image: 'X' } });
  });
});

describe('film.json', () => {
  it('drops what the trade does not know and refuses an unknown trade', () => {
    const f = normalizeFilm({ profileId: 'ceramics-plants', aspectRatio: '9:16', keyframes: { workshop: 'a', ghost: 'b' }, clipJobs: { raw: { id: 'j', startedAt: '2026-10-09T10:00:00Z' }, x: { id: 'k', startedAt: 'nope' } } });
    expect(f!.keyframes).toEqual({ workshop: 'a' });
    expect(f!.clipJobs).toEqual({ raw: { id: 'j', startedAt: '2026-10-09T10:00:00Z' } });
    expect(f!.aspectRatio).toBe('9:16');
    expect(normalizeFilm({ profileId: 'nope' })).toBeNull();
  });
});
