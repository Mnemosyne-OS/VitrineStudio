import { generationsDir } from './photoSources';
import type { Scene } from './types';

const scene = (images: Scene['images']) => ({ images } as Scene);

describe('where Mnemosyne keeps the pictures it made', () => {
  it('is read from a scene picture, on Windows and elsewhere', () => {
    expect(generationsDir([scene({ place: 'C:\\Users\\d\\.mnemosyne\\generations\\2026-11\\a.png' })])).toBe('C:\\Users\\d\\.mnemosyne\\generations');
    expect(generationsDir([scene({}), scene({ piece: '/home/d/.mnemosyne/generations/b.png' })])).toBe('/home/d/.mnemosyne/generations');
  });
  it('is unknown before any generated picture', () => {
    expect(generationsDir([scene({ place: 'C:/photos/a.jpg' })])).toBeNull();
    expect(generationsDir([])).toBeNull();
  });
});
