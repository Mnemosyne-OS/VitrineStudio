/**
 * The phrases that name each beat's subject for the host's phrase matte
 * (doc 189 §5): the trade's own English noun, and what the living beat added.
 */
import { describe, it, expect } from 'vitest';
import { mattePhrases, scenePhrases, profileById, MATTE_PHRASE_MAX } from './profiles';

describe('mattePhrases', () => {
  const ceramics = profileById('ceramics-plants');

  it('names the piece by the trade\'s noun, the same words the prompts used to draw it', () => {
    expect(mattePhrases(ceramics, 'eucalyptus').piece).toEqual(['the ceramic piece']);
    expect(mattePhrases(profileById('lighting'), 'night').piece).toEqual(['the lamp']);
  });

  it('the living beat names the piece, what was put in it, and the trade\'s plant (one matte for pot and plant)', () => {
    expect(mattePhrases(ceramics, 'eucalyptus').alive).toEqual(['the ceramic piece', 'a bunch of silver-green eucalyptus stems', 'the plant']);
  });

  it('🚨 a companion is named, and the plant too: a « cat » scene came back with a plant (2026-10-28)', () => {
    expect(mattePhrases(ceramics, 'cat').alive).toEqual(['the ceramic piece', 'a calm cat curled up beside it', 'the plant']);
  });

  it('the person\'s own words are a phrase when they are short', () => {
    expect(mattePhrases(ceramics, 'un olivier').alive).toEqual(['the ceramic piece', 'un olivier', 'the plant']);
  });

  it('no animation named: the trade\'s plant is still named (9 of 10 imported scenes)', () => {
    expect(mattePhrases(ceramics, '').alive).toEqual(['the ceramic piece', 'the plant']);
    expect(mattePhrases(ceramics, 'x'.repeat(MATTE_PHRASE_MAX + 1)).alive).toEqual(['the ceramic piece', 'the plant']);
  });

  it('🚨 nothing names what was added and the trade has no plant: the living beat sends NO phrase (the salient matte keeps it)', () => {
    const lighting = profileById('lighting');
    expect(lighting.aliveNoun).toBeUndefined();
    expect(mattePhrases(lighting, '').alive).toEqual([]);
    expect(mattePhrases(lighting, '   ').alive).toEqual([]);
    expect(mattePhrases(lighting, 'x'.repeat(MATTE_PHRASE_MAX + 1)).alive).toEqual([]);
  });

  it('🚨 a trade whose animations are lights names no animation: « the room dark around it » would name the room', () => {
    expect(mattePhrases(profileById('lighting'), 'night').alive).toEqual([]);
    expect(mattePhrases(profileById('painting'), 'evening').alive).toEqual([]);
    expect(mattePhrases(profileById('woodwork'), 'books').alive).toEqual([]);
  });

  it('a companion is always named, whatever the trade: it is a creature', () => {
    expect(mattePhrases(profileById('woodwork'), 'cat').alive).toEqual(['the wooden piece', 'a calm cat curled up beside it']);
  });

  it('never more phrases than the host takes (4)', () => {
    for (const p of ['ceramics-plants', 'lighting', 'woodwork', 'textile', 'products']) {
      expect(mattePhrases(profileById(p), 'cat').alive.length).toBeLessThanOrEqual(4);
    }
  });
});

describe('scenePhrases', () => {
  it("the scene's own trade wins over the settings", () => {
    expect(scenePhrases({ profileId: 'lighting', animation: 'night' }, 'ceramics-plants').piece).toEqual(['the lamp']);
  });

  it("a scene from before the trade was kept reads the settings' trade", () => {
    expect(scenePhrases({ animation: 'eucalyptus' }, 'ceramics-plants').piece).toEqual(['the ceramic piece']);
  });
});
