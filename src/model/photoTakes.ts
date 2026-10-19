/**
 * A creation's photo and its versions (Tony: « refaire l'image, amélioration »):
 * an improved photo becomes the one shown, the one before goes in the versions,
 * and any version comes back in one click. Nothing is deleted on the way.
 */
import type { Piece } from './types';

/** More than this and the oldest version leaves the list (its file stays on disk). */
export const PHOTO_TAKES_MAX = 12;

/** The new photo shown, the previous one first in the versions. */
export function withNewPhoto(piece: Piece, path: string, now: string): Piece {
  const takes = [piece.photoPath, ...(piece.photoTakes ?? [])].filter((p): p is string => !!p && p !== path);
  return { ...piece, photoPath: path, photoTakes: [...new Set(takes)].slice(0, PHOTO_TAKES_MAX), updatedAt: now };
}

/** A version brought back: it is shown, the one shown goes in the versions. */
export function backToPhoto(piece: Piece, path: string, now: string): Piece {
  if (!(piece.photoTakes ?? []).includes(path)) return piece;
  return withNewPhoto(piece, path, now);
}

/** A version taken off the list (its file stays: the person's own photo may be one). */
export function withoutPhotoTake(piece: Piece, path: string, now: string): Piece {
  const takes = (piece.photoTakes ?? []).filter((p) => p !== path);
  const next: Piece = { ...piece, updatedAt: now };
  if (takes.length) next.photoTakes = takes; else delete next.photoTakes;
  return next;
}
