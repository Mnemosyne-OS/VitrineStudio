import { describe, expect, it } from 'vitest';
import { findNamed, nameWords, type Named } from './agentFind';

const piece = (id: string, name: string): Named<string> => ({ item: id, id, names: [name], label: name });
const PIECES = [piece('p1', 'Vase bleu'), piece('p2', 'Vase'), piece('p3', 'Bol à thé'), piece('p4', 'Grand vase bleu')];
const kind = { code: 'NO_PIECE', noun: 'piece' };

describe('a piece named the way a person says it', () => {
  it('folds case, accents, fillers and a plural', () => {
    expect(nameWords('le Bol à THÉ')).toEqual(['bol', 'the']);
    expect(nameWords('les vases bleus')).toEqual(['vase', 'bleu']);
  });

  it('an id, the whole name, or every word of it', () => {
    expect(findNamed(PIECES, 'p3', kind)).toBe('p3');
    expect(findNamed(PIECES, 'le bol à thé', kind)).toBe('p3');
    // « Vase » is a whole name: it wins over the pieces that hold the word.
    expect(findNamed(PIECES, 'le vase', kind)).toBe('p2');
    expect(findNamed(PIECES, 'grand vase', kind)).toBe('p4');
  });

  it('several matches are refused with their names, never the first taken', () => {
    expect(() => findNamed(PIECES, 'vase bleu', kind)).not.toThrow();
    expect(() => findNamed(PIECES, 'bleu', kind)).toThrow('AMBIGUOUS: "bleu" names several pieces: Vase bleu, Grand vase bleu; say which');
  });

  it('no match is refused with the names that exist', () => {
    expect(() => findNamed(PIECES, 'théière', kind)).toThrow('NO_PIECE: no piece named "théière"; pieces: Vase bleu, Vase, Bol à thé, Grand vase bleu');
    expect(() => findNamed(PIECES, '', kind)).toThrow(/^BAD_ARG/);
    expect(() => findNamed([], 'vase', kind)).toThrow('pieces: none');
  });

  it('a scene by its piece and its room', () => {
    const scenes: Array<Named<string>> = [
      { item: 's1', id: 's1', names: ['Vase bleu', 'Salon', 'Console'], label: 'Vase bleu · Salon · Console' },
      { item: 's2', id: 's2', names: ['Vase bleu', 'Jardin', 'Terrasse'], label: 'Vase bleu · Jardin · Terrasse' },
    ];
    const sk = { code: 'NO_SCENE', noun: 'scene' };
    expect(findNamed(scenes, 'vase bleu au jardin', sk)).toBe('s2');
    expect(() => findNamed(scenes, 'vase bleu', sk)).toThrow(/^AMBIGUOUS: .*Salon.*Jardin/);
  });
});
