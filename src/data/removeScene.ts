/**
 * Taking a scene out of the studio, the two ways the person can choose:
 *
 * - ARCHIVE: the record moves to `<root>/archive/scenes/`, its pictures stay
 *   on disk. Nothing is lost, the scene simply leaves the studio and the site.
 * - DELETE FOR GOOD: the record is removed, then the pictures and the clip
 *   that ONLY this scene uses are deleted from disk.
 *
 * 🚨 A file the person brought (their own photo of the place, the photo that
 * animates the third beat) is never deleted: the studio did not make it.
 * 🚨 A file another scene or the home film still points at is never deleted.
 */
import { ARCHIVE_DIR, joinPath, saveRecord, SCENES_DIR, StoreError, type FolderIO } from './folderStore';
import { takePaths } from '../model/takes';
import { layerPaths } from '../model/sceneLayers';
import type { Film } from '../model/filmRecord';
import type { Scene } from '../model/types';

/** Every path a scene points at, whoever made it. */
export function scenePaths(scene: Scene): string[] {
  const from = Object.values(scene.enlarged ?? {}).map((e) => e?.from);
  return [...Object.values(scene.images), ...from, scene.clipPath, scene.animationRefPath, ...takePaths(scene), ...Object.values(scene.clipFrames ?? {}).filter((v): v is string => typeof v === 'string'), ...layerPaths(scene.layers)].filter((p): p is string => !!p);
}

function filmPaths(film: Film | null): string[] {
  if (!film) return [];
  return [
    ...Object.values(film.keyframes),
    ...Object.values(film.conformed),
    ...Object.values(film.clips),
    film.workshopPhotoPath,
    film.portraitPath,
    film.animationRefPath,
  ].filter((p): p is string => !!p);
}

/** Windows paths compare without case and without the separator's spelling. */
const key = (p: string) => p.replace(/\\/g, '/').toLowerCase();

/**
 * The files deleting this scene for good would remove: the pictures the
 * studio made for it and its clip, minus the person's own photos and minus
 * anything another scene or the film still uses.
 */
export function filesOwnedBy(scene: Scene, others: Scene[], films: Film | readonly Film[] | null): string[] {
  const made = [scene.images.piece, scene.images.alive, scene.enlarged?.piece?.from, scene.enlarged?.alive?.from, scene.clipPath, scene.clipFrames?.piece, scene.clipFrames?.alive, ...takePaths(scene), ...layerPaths(scene.layers)];
  made.unshift(scene.images.place, scene.enlarged?.place?.from);
  const used = new Set([...others.filter((o) => o.id !== scene.id).flatMap(scenePaths), ...(Array.isArray(films) ? films : [films]).flatMap((f: Film | null) => filmPaths(f))].map(key));
  // A place that IS the person's own photo was not made by the studio (its
  // enlargement was, and goes). Held back by path, so a photo that was already
  // wide enough, and so is both "from" and the picture, is still kept.
  if (scene.placeFromPhoto) used.add(key(scene.enlarged?.place?.from ?? scene.images.place ?? ''));
  const out: string[] = [];
  for (const p of made) {
    if (p && !used.has(key(p)) && !out.some((o) => key(o) === key(p))) out.push(p);
  }
  return out;
}

async function removeRecord(io: FolderIO, root: string, scene: Scene): Promise<void> {
  const res = await io.deleteFile(joinPath(root, SCENES_DIR, `${scene.id}.json`));
  if (!res.success) throw new StoreError('WRITE_FAILED', res.error);
}

/**
 * The archived copy is written FIRST: if removing the original then fails,
 * the scene is in both places and nothing is lost.
 */
export async function archiveScene(io: FolderIO, root: string, scene: Scene, now: string): Promise<void> {
  const archived: Scene = { ...scene, updatedAt: now };
  await saveRecord(io, root, `${ARCHIVE_DIR}/${SCENES_DIR}`, archived);
  await removeRecord(io, root, scene);
}

/**
 * The record goes FIRST: a scene whose pictures were deleted but whose record
 * stayed would show holes; a picture left behind is only a file on disk.
 * Resolves the files that could not be deleted, by path, so they are told.
 */
export async function deleteSceneForGood(io: FolderIO, root: string, scene: Scene, files: string[]): Promise<string[]> {
  await removeRecord(io, root, scene);
  const left: string[] = [];
  for (const f of files) {
    try {
      const res = await io.deleteFile(f);
      // Already gone is what we wanted.
      if (!res.success && res.error !== 'File does not exist') left.push(f);
    } catch (err) {
      console.warn(`[vitrine-studio] could not delete ${f}:`, err);
      left.push(f);
    }
  }
  return left;
}
