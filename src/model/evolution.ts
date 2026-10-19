/**
 * A piece's pictures over time (Tony, 2026-10-12: « le suivi des évolutions des
 * images par produit »): its own photos, then each of its scenes with every
 * version of each picture and of the clip, oldest first, the one in use marked.
 *
 * 🎭 A version's date is read from the generator's file name (`gen-<ms>-…`),
 * the only date the studio has for it. A picture without one (an imported
 * photo, a cut-out) has NO date: never the scene's date, never now.
 *
 * A line is in time order when every version on it is dated. The record is
 * not: takes are kept LAST MOVED first (a version put back then redone goes to
 * the head), which on a real scene read 11 oct, 9 oct, 12 oct. When one
 * version has no date the line keeps the record's order, the one in use last:
 * a sort on dates only some versions have would place the others anywhere.
 */
import { BEATS, type Beat, type Piece, type Scene } from './types';

export interface Version {
  path: string;
  /** When the generator made it; absent when the file name does not say. */
  at?: Date;
  /** The version the piece or the scene uses today. */
  current: boolean;
  /** The piece lifted off its photo's background. */
  cutout?: true;
}

export interface SceneEvolution {
  scene: Scene;
  /** Per picture made or kept, oldest first. */
  beats: Partial<Record<Beat, Version[]>>;
  /** The clips, oldest first. */
  clips: Version[];
  /** How many versions in all. */
  count: number;
}

export interface PieceEvolution {
  /** Her photos of the piece, oldest first, and its cut-out when made. */
  photos: Version[];
  scenes: SceneEvolution[];
  count: number;
}

const GEN_STAMP = /gen-(\d{13})-/;

/** The date in a generated file's name, when it carries one. */
export function versionDate(path: string): Date | undefined {
  const m = GEN_STAMP.exec(path.replace(/\\/g, '/').split('/').pop() ?? '');
  if (!m) return undefined;
  const d = new Date(Number(m[1]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const version = (path: string, current: boolean): Version => {
  const at = versionDate(path);
  return at ? { path, at, current } : { path, current };
};

/** A line of versions: by date when every one has one, else kept (reversed) then the one in use. */
function line(current: string | undefined, kept: string[] | undefined): Version[] {
  const out = [...(kept ?? [])].reverse().map((p) => version(p, false));
  if (current) out.push(version(current, true));
  if (out.every((v) => v.at)) out.sort((a, b) => a.at!.getTime() - b.at!.getTime());
  return out;
}

/** Every picture of `piece`: its photos, then each of ITS scenes (any other piece's are left out). */
export function pieceEvolution(piece: Piece, scenes: Scene[]): PieceEvolution {
  const photos = line(piece.photoPath, piece.photoTakes);
  if (piece.cutout) photos.push({ ...version(piece.cutout.path, false), cutout: true });
  const mine = scenes.filter((s) => s.pieceId === piece.id).map((scene): SceneEvolution => {
    const beats: Partial<Record<Beat, Version[]>> = {};
    let count = 0;
    for (const b of BEATS) {
      const list = line(scene.images[b], scene.takes?.[b]);
      if (list.length) { beats[b] = list; count += list.length; }
    }
    const clips = line(scene.clipPath, scene.clipTakes?.map((c) => c.path));
    count += clips.length;
    return { scene, beats, clips, count };
  });
  return { photos, scenes: mine, count: photos.length + mine.reduce((n, s) => n + s.count, 0) };
}
