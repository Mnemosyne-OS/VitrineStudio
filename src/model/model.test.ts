import { CLIP_NEGATIVE, clipNegative, clipPrompt, companionsFor, fillTemplate, outdoorIdeas, profileById, PROFILES, promptsFor } from './profiles';
import { newScene, nextBeat, normalizePiece, normalizeScene, normalizeSettings, normalizeSiteSettings, withoutFrom } from './records';
import { changedShare, DECOR_WARN_SHARE } from './decor';
import { DEFAULT_SETTINGS } from './types';

describe('trade profiles', () => {
  it('every profile names its three beats in the three languages and fills every hole', () => {
    for (const p of PROFILES) {
      for (const beat of ['place', 'piece', 'alive'] as const) {
        for (const lang of ['en', 'fr', 'es'] as const) expect(p.beats[beat][lang]).toBeTruthy();
      }
      const prompts = promptsFor({ profile: p, placeDescription: 'A calm room', animation: p.animations[0]!.id });
      for (const text of Object.values(prompts)) expect(text).not.toMatch(/\{\w+\}/);
    }
  });

  it('keeps an unfilled hole visible instead of dropping a word', () => {
    expect(fillTemplate('a {piece} on {place}', { piece: 'vase' })).toBe('a vase on {place}');
  });

  it("uses the person's description of THEIR piece before the trade's default material", () => {
    const p = profileById('ceramics-plants');
    expect(promptsFor({ profile: p, placeDescription: 'x', pieceDescription: 'blue glazed porcelain', animation: 'pothos' }).piece).toContain('blue glazed porcelain');
    expect(promptsFor({ profile: p, placeDescription: 'x', animation: 'pothos' }).piece).toContain(p.material);
  });

  it('takes the animation as free words when it is not one of the profile', () => {
    const p = profileById('ceramics-plants');
    expect(promptsFor({ profile: p, placeDescription: 'x', animation: 'a single red tulip' }).alive).toContain('a single red tulip');
  });

  it('carries the rules learnt on the first pictures: same camera, only the object, an empty piece', () => {
    const t = profileById('ceramics-plants').templates;
    expect(t.piece).toMatch(/Same camera, same framing/);
    expect(t.piece).toMatch(/never its background/);
    expect(t.piece).toMatch(/EMPTY/);
  });

  it('falls back to the first profile for an unknown id', () => {
    expect(profileById('nope').id).toBe(PROFILES[0]!.id);
  });
});

describe('records', () => {
  it('reads a MnemoCRM product as a piece, keeping its photo and status', () => {
    const piece = normalizePiece({ schema: 1, id: 'p1', name: 'Vase', kind: 'unique', status: 'sold', photoPath: 'C:/a.jpg', tags: ['x', 3], emoji: '🏺' });
    expect(piece).toMatchObject({ id: 'p1', name: 'Vase', kind: 'unique', status: 'sold', photoPath: 'C:/a.jpg', tags: ['x'] });
  });

  it('refuses a record without an id or a name', () => {
    expect(normalizePiece({ name: 'x' })).toBeNull();
    expect(normalizeScene({ id: 's' })).toBeNull();
  });

  it('keeps an unmeasured room change ABSENT, never 0', () => {
    const s = normalizeScene({ id: 's', pieceId: 'p', images: {} });
    expect(s).not.toHaveProperty('decorChange');
    expect(normalizeScene({ id: 's', pieceId: 'p', decorChange: 7 })).not.toHaveProperty('decorChange');
  });

  it('reads unknown settings as the defaults', () => {
    expect(normalizeSettings({ profileId: 'nope', quality: 'x', aspectRatio: '2:1' })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ profileId: 'lighting', quality: 'fast', aspectRatio: '9:16' })).toEqual({ profileId: 'lighting', advanced: false, quality: 'fast', aspectRatio: '9:16', upscaleScale: 2, showCosts: false });
    expect(normalizeSettings({ upscaleScale: 1.5 }).upscaleScale).toBe(1.5);
    expect(normalizeSettings({ upscaleScale: 9 }).upscaleScale).toBe(2);
    // Only a real `true` turns the advanced mode on: a hand-edited "yes" stays off.
    expect(normalizeSettings({ advanced: true }).advanced).toBe(true);
    expect(normalizeSettings({ advanced: 'yes' }).advanced).toBe(false);
  });

  it("keeps the person's own instructions, only for known keys and never empty", () => {
    const s = normalizeScene({ id: 's', pieceId: 'p', prompts: { piece: '  my words ', clip: '', ghost: 'x', alive: 3 } })!;
    expect(s.prompts).toEqual({ piece: 'my words' });
    expect(normalizeScene({ id: 's', pieceId: 'p', prompts: { clip: '  ' } })!.prompts).toBeUndefined();
  });

  it('makes the beats in order, and remaking one throws away the ones after it', () => {
    const base = newScene({ pieceId: 'p', universe: 'U', variant: 'V', placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9' });
    expect(nextBeat(base)).toBe('place');
    const full = { ...base, images: { place: 'a', piece: 'b', alive: 'c' }, decorChange: 0.03, clipPath: 'v.mp4', validated: true };
    expect(nextBeat(full)).toBeNull();
    const redo = withoutFrom(full, 'piece');
    expect(redo.images).toEqual({ place: 'a' });
    expect(redo).not.toHaveProperty('decorChange');
    expect(redo).not.toHaveProperty('clipPath');
    expect(redo.validated).toBe(false);
    const redoAlive = withoutFrom(full, 'alive');
    expect(redoAlive.images).toEqual({ place: 'a', piece: 'b' });
    expect(redoAlive.decorChange).toBe(0.03);
  });
});

describe('room change', () => {
  const px = (lum: number, n: number) => new Uint8ClampedArray(Array.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : lum)));

  it('counts the pixels that moved beyond compression noise', () => {
    const a = px(100, 100);
    const b = px(100, 100);
    for (let i = 0; i < 10; i++) b.set([200, 200, 200], i * 4);
    b.set([110, 110, 110], 50 * 4); // noise, under the step
    expect(changedShare(a, b)).toBeCloseTo(0.1);
  });

  it('cannot compare pictures of two sizes', () => {
    expect(changedShare(px(0, 4), px(0, 5))).toBeNull();
  });

  it('sits between a good edit and the measured bad one', () => {
    expect(DECOR_WARN_SHARE).toBeGreaterThan(0.068);
    expect(DECOR_WARN_SHARE).toBeLessThan(0.177);
  });
});

describe('interior styles', () => {
  it('compose the place from a room and a style, either one optional', async () => {
    const { composePlace, STYLES } = await import('./styles');
    expect(composePlace('A living room', 'Swiss interior design')).toBe('A living room. Swiss interior design');
    expect(composePlace(undefined, 'Japandi')).toBe('Japandi');
    expect(composePlace('  ', undefined)).toBe('');
    for (const s of STYLES) for (const l of ['en', 'fr', 'es'] as const) expect(s.label[l]).toBeTruthy();
  });
});

describe('read back', () => {
  it('keeps "no limit" on the weight as no limit, and a broken value as the default', () => {
    expect(normalizeSiteSettings({ imageKb: null }, '').imageKb).toBeNull();
    expect(normalizeSiteSettings({ imageKb: 800 }, '').imageKb).toBe(800);
    expect(normalizeSiteSettings({ imageKb: 'big' }, '').imageKb).toBe(100);
  });

  it('keeps an enlargement only for a beat that still has its picture', () => {
    const raw = { ...newScene({ pieceId: 'p', universe: 'U', variant: 'V', placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9' }),
      images: { place: 'C:/a-x2.png' }, enlarged: { place: { from: 'C:/a.png', scale: 2 }, piece: { from: 'C:/b.png', scale: 2 } } };
    const s = normalizeScene(raw);
    expect(s?.enlarged).toEqual({ place: { from: 'C:/a.png', scale: 2 } });
  });
});

describe('places', () => {
  it('never offers twice a place the trade already has (sculpture and painting have their gallery)', () => {
    for (const p of PROFILES) {
      const ids = [...p.placeIdeas, ...outdoorIdeas(p)].map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('offers places outside the home to every trade, and walls to hang on for painting', () => {
    for (const p of PROFILES) expect(outdoorIdeas(p).length).toBeGreaterThan(0);
    expect(outdoorIdeas(profileById('painting')).every((i) => /wall/.test(i.prompt))).toBe(true);
    expect(outdoorIdeas(profileById('ceramics-plants')).map((i) => i.id)).toEqual(['city', 'beach', 'nature', 'market', 'mountain', 'cafe', 'hotel', 'workshop', 'office', 'boutique', 'restaurant', 'terrace', 'gallery', 'hotel-bathroom']);
  });

  it('reads back the photo an enhanced place comes from, never beside a place that IS the photo', () => {
    const base = { ...newScene({ pieceId: 'p', universe: 'U', variant: 'V', placeDescription: '', animation: 'pothos', aspectRatio: '16:9' }) };
    expect(normalizeScene({ ...base, placeSourcePath: 'C:/me/room.jpg' })?.placeSourcePath).toBe('C:/me/room.jpg');
    expect(normalizeScene({ ...base, placeFromPhoto: true, images: { place: 'C:/me/room.jpg' }, placeSourcePath: 'C:/me/room.jpg' })?.placeSourcePath).toBeUndefined();
  });
});

describe('company in the third beat', () => {
  const ceramics = profileById('ceramics-plants');
  const input = (animation: string) => ({ profile: ceramics, placeDescription: 'A calm room', animation });

  it('adds a cat beside the pot, never in it, and leaves the plants as they were', () => {
    expect(promptsFor(input('cat')).alive).toMatch(/a calm cat curled up beside it, near the ceramic piece/);
    expect(promptsFor(input('cat')).alive).not.toMatch(/Put .* in the/);
    expect(promptsFor(input('pothos')).alive).toMatch(/^Edit the first image\. Put a lush green pothos/);
    expect(clipPrompt(ceramics, 'cat')).toMatch(/settles near the/);
  });

  it('is offered only where the third beat is life, never where it is light', () => {
    expect(companionsFor(ceramics).length).toBeGreaterThan(0);
    for (const id of ['lighting', 'painting', 'sculpture', 'jewellery']) expect(companionsFor(profileById(id))).toEqual([]);
  });

  it('lifts the clip ban on people and hands only for a child', () => {
    expect(clipNegative(ceramics, 'child')).not.toMatch(/people|hands/);
    expect(clipNegative(ceramics, 'cat')).toBe(CLIP_NEGATIVE);
    expect(clipNegative(ceramics, 'pothos')).toBe(CLIP_NEGATIVE);
  });
});
