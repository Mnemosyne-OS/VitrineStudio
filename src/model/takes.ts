/**
 * The versions of a scene (Tony: « garder les versions de vidéo et d'image,
 * ainsi on peut switch si on veut valider ou supprimer »). A redone picture or
 * clip is no longer thrown away: it becomes a TAKE, and any take can be put
 * back or deleted.
 *
 * A picture is an edit of the one before it, so putting back an older
 * « creation » can leave a « living » made from another one: allowed, the
 * person sees it, and redoing the later picture fixes it. What was MEASURED
 * on the old pair (the room change) leaves with it: absent, never stale.
 */
import { BEATS, type Beat, type ClipStyle, type Scene } from './types';

/** Kept per picture and for the clip; past it the oldest takes are let go (their files stay). */
export const MAX_TAKES = 12;

export interface ClipTake { path: string; cut?: { in: number; out: number }; style?: ClipStyle }

const same = (a: string, b: string) => a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase();

/** The list with `path` added first, without doubles, never the current one, at most MAX_TAKES. */
function withTake(list: string[] | undefined, path: string, current?: string): string[] {
  const out = [path, ...(list ?? []).filter((p) => !same(p, path))].filter((p) => !current || !same(p, current));
  return out.slice(0, MAX_TAKES);
}

/** The scene with these pictures (and the clip, when `clip`) kept as takes before they leave. */
export function keepTakes(scene: Scene, beats: Beat[], clip: boolean): Scene {
  const next: Scene = { ...scene };
  const takes: Partial<Record<Beat, string[]>> = { ...(scene.takes ?? {}) };
  for (const b of beats) {
    const path = scene.images[b];
    if (path) takes[b] = withTake(takes[b], path);
  }
  if (Object.values(takes).some((l) => l && l.length)) next.takes = takes;
  if (clip && scene.clipPath) next.clipTakes = keepClip(scene.clipTakes, scene);
  return next;
}

function keepClip(list: ClipTake[] | undefined, scene: Scene): ClipTake[] {
  const take: ClipTake = { path: scene.clipPath! };
  if (scene.clipCut) take.cut = scene.clipCut;
  if (scene.clipStyle) take.style = scene.clipStyle;
  return [take, ...(list ?? []).filter((c) => !same(c.path, take.path))].slice(0, MAX_TAKES);
}

/** Puts a kept picture back; the current one becomes a take. */
export function putTakeBack(scene: Scene, beat: Beat, path: string): Scene {
  const current = scene.images[beat];
  if (current && same(current, path)) return scene;
  const rest = (scene.takes?.[beat] ?? []).filter((p) => !same(p, path));
  const next: Scene = { ...scene, images: { ...scene.images, [beat]: path }, takes: { ...(scene.takes ?? {}), [beat]: current ? withTake(rest, current, path) : rest } };
  // Measured on the other pair of pictures.
  if (beat !== 'place') delete next.decorChange;
  if (next.enlarged?.[beat] && !same(next.enlarged[beat].from, path)) {
    const enlarged = { ...next.enlarged };
    delete enlarged[beat];
    if (Object.keys(enlarged).length) next.enlarged = enlarged;
    else delete next.enlarged;
  }
  return next;
}

/** Puts a kept clip back, with the cut and settings it had; the current clip becomes a take. */
export function putClipBack(scene: Scene, path: string): Scene {
  const take = scene.clipTakes?.find((c) => same(c.path, path));
  if (!take) return scene;
  const rest = (scene.clipTakes ?? []).filter((c) => !same(c.path, path));
  const next: Scene = { ...scene, clipPath: take.path, clipTakes: scene.clipPath ? keepClip(rest, scene) : rest };
  if (take.cut) next.clipCut = take.cut;
  else delete next.clipCut;
  if (take.style) next.clipStyle = take.style;
  return next;
}

/** The scene without that take (the current picture or clip is never one). */
export function dropTake(scene: Scene, beat: Beat | 'clip', path: string): Scene {
  const next: Scene = { ...scene };
  if (beat === 'clip') next.clipTakes = (scene.clipTakes ?? []).filter((c) => !same(c.path, path));
  else next.takes = { ...(scene.takes ?? {}), [beat]: (scene.takes?.[beat] ?? []).filter((p) => !same(p, path)) };
  return next;
}

/** Whether deleting this take's FILE is safe: not shown anywhere in the scene, and not a source of its frames. */
export function takeFileFree(scene: Scene, path: string): boolean {
  const used = [
    ...BEATS.map((b) => scene.images[b]),
    scene.clipPath,
    scene.clipFrames?.from.piece, scene.clipFrames?.from.alive,
    ...Object.values(scene.enlarged ?? {}).map((e) => e?.from),
    scene.animationRefPath,
  ];
  return !used.some((p) => p && same(p, path));
}

/** Every take's file, for a scene deleted for good. */
export function takePaths(scene: Scene): string[] {
  return [...Object.values(scene.takes ?? {}).flat(), ...(scene.clipTakes ?? []).map((c) => c.path)].filter((p): p is string => !!p);
}
