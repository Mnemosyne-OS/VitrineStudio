/**
 * Taking a film out of the studio, the two ways a scene leaves it
 * (data/removeScene.ts):
 *
 * - ARCHIVE: the record moves to `<root>/archive/films/`, its pictures and
 *   clips stay on disk.
 * - DELETE FOR GOOD: the record is removed, then the pictures and clips the
 *   studio made for THIS film only are deleted.
 *
 * 🚨 What she brought is never deleted: her workshop photo, her portrait, the
 * photo that animates, and a picture of the chain that IS her own photo
 * (`ownFrames`). 🚨 A file a scene or another film still points at stays.
 */
import { ARCHIVE_DIR, FILM_FILE, FILMS_DIR, joinPath, saveRecord, STUDIO_DIR, StoreError, type FolderIO } from './folderStore';
import { scenePaths } from './removeScene';
import { LEGACY_FILM_ID, type Film } from '../model/filmRecord';
import type { Scene } from '../model/types';

/** Every path a film points at, whoever made it. */
export function filmFiles(film: Film): string[] {
  return [...Object.values(film.keyframes), ...Object.values(film.conformed), ...Object.values(film.clips), film.workshopPhotoPath, film.portraitPath, film.animationRefPath].filter((p): p is string => !!p);
}

const key = (p: string) => p.replace(/\\/g, '/').toLowerCase();

/** The files "delete for good" removes: made by the studio for this film, used nowhere else. */
export function filesOwnedByFilm(film: Film, otherFilms: readonly Film[], scenes: readonly Scene[]): string[] {
  const own = new Set(film.ownFrames ?? []);
  const made = [
    ...Object.entries(film.keyframes).filter(([step]) => !own.has(step)).map(([, p]) => p),
    ...Object.values(film.conformed),
    ...Object.values(film.clips),
  ];
  const used = new Set([
    ...otherFilms.filter((f) => f.id !== film.id).flatMap(filmFiles),
    ...scenes.flatMap(scenePaths),
    // A path she brought is never the studio's, even when a made picture shares it.
    ...[film.workshopPhotoPath, film.portraitPath, film.animationRefPath, ...[...own].map((s) => film.keyframes[s])].filter((p): p is string => !!p),
  ].map(key));
  const out: string[] = [];
  for (const p of made) if (!used.has(key(p)) && !out.some((o) => key(o) === key(p))) out.push(p);
  return out;
}

/** Where the film's record lives: the first film's own file, or its file under studio/films. */
const recordPath = (root: string, film: Film) => (film.id === LEGACY_FILM_ID ? joinPath(root, STUDIO_DIR, FILM_FILE) : joinPath(root, FILMS_DIR, `${film.id}.json`));

async function removeRecord(io: FolderIO, root: string, film: Film): Promise<void> {
  const res = await io.deleteFile(recordPath(root, film));
  // A film never written (made and removed before its first change) has no file: that is gone already.
  if (!res.success && res.error !== 'File does not exist') throw new StoreError('WRITE_FAILED', res.error);
}

/** The archived copy is written FIRST: if removing the original then fails, nothing is lost. */
export async function archiveFilm(io: FolderIO, root: string, film: Film, now: string): Promise<void> {
  const archived: Film = { ...film, updatedAt: now };
  await saveRecord(io, root, `${ARCHIVE_DIR}/films`, archived);
  await removeRecord(io, root, film);
}

/** The record goes FIRST; resolves the files that could not be deleted, by path, so they are told. */
export async function deleteFilmForGood(io: FolderIO, root: string, film: Film, files: string[]): Promise<string[]> {
  await removeRecord(io, root, film);
  const left: string[] = [];
  for (const f of files) {
    try {
      const res = await io.deleteFile(f);
      if (!res.success && res.error !== 'File does not exist') left.push(f);
    } catch (err) {
      console.warn(`[vitrine-studio] could not delete ${f}:`, err);
      left.push(f);
    }
  }
  return left;
}
