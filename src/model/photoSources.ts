import { createContext } from 'react';
import type { PieceShow } from './showcase';
import type { Piece, Scene } from './types';

/** What the chooser can offer besides the computer: the studio's own pictures. */
export interface PhotoSourceData {
  pieces: Piece[];
  scenes: Scene[];
  showcase: Record<string, PieceShow>;
}

export const PhotoSources = createContext<PhotoSourceData>({ pieces: [], scenes: [], showcase: {} });

/**
 * Where Mnemosyne keeps the pictures it made: read from a scene's picture,
 * all of which it generated (`…/.mnemosyne/generations/…`). Null when no
 * scene was made yet; the picker then opens where the system decides.
 */
export function generationsDir(scenes: Scene[]): string | null {
  for (const s of scenes) {
    for (const p of Object.values(s.images)) {
      const m = p && /^(.*?[\\/]\.mnemosyne[\\/]generations)(?:[\\/]|$)/.exec(p);
      if (m) return m[1]!;
    }
  }
  return null;
}
