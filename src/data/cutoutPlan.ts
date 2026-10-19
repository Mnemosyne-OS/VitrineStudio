/**
 * What « take the background off » means for one piece, decided before any
 * matte runs (doc 149, the studio's cutoutPieces agent action). Pure.
 *
 * - shown: the photo on show IS a cut-out already, nothing to do.
 * - reuse: a cut-out exists whose source is the photo on show or one of her
 *   earlier photos of it: show it, the matte is never paid twice. A photo with
 *   a generated background thus goes back to her own photo, cut out.
 * - make: no cut-out of these photos yet, the matte runs on the photo on show.
 * - noPhoto: nothing to cut out.
 */
import type { Piece } from '../model/types';

export type CutoutPlan =
  | { kind: 'shown' }
  | { kind: 'reuse'; path: string }
  | { kind: 'make'; from: string }
  | { kind: 'noPhoto' };

export function cutoutPlan(piece: Pick<Piece, 'photoPath' | 'photoTakes' | 'cutout'>): CutoutPlan {
  const photo = piece.photoPath;
  if (!photo) return { kind: 'noPhoto' };
  const cut = piece.cutout;
  if (cut && cut.path === photo) return { kind: 'shown' };
  if (cut && (cut.from === photo || (piece.photoTakes ?? []).includes(cut.from))) return { kind: 'reuse', path: cut.path };
  return { kind: 'make', from: photo };
}

/**
 * Which pieces a « take the backgrounds off » call works on: the ones asked
 * (every piece when none), minus those already cut out or without a photo.
 * An id that is not a piece is named, never skipped in silence.
 */
export function cutoutTodo<P extends Pick<Piece, 'id' | 'photoPath' | 'photoTakes' | 'cutout'>>(pieces: readonly P[], asked: readonly string[] | null): { todo: string[]; unknown: string[]; already: number } {
  const ids = asked ?? pieces.map((p) => p.id);
  const unknown = ids.filter((id) => !pieces.some((p) => p.id === id));
  const todo = ids.filter((id) => {
    const piece = pieces.find((p) => p.id === id);
    const k = piece ? cutoutPlan(piece).kind : 'noPhoto';
    return k === 'reuse' || k === 'make';
  });
  return { todo, unknown, already: ids.length - unknown.length - todo.length };
}
