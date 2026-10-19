/**
 * The clip's two frames in the video's own shape. The video model makes 16:9
 * or 9:16 only; a square scene sent as it is gets widened by mirroring its
 * edges, and the model then animates those mirrored edges as part of the room
 * (a second window, a plant growing in from the side). The site re-centres the
 * clip at every screen width, so its sides are seen.
 *
 * So, before a clip, a scene whose pictures are not in shape gets two wide
 * frames, made once and kept: the creation picture EXTENDED to the sides by
 * the image model, then the living picture redone on that wide frame (so the
 * room is the same in both, which the clip needs). The scene's own pictures
 * are never touched; a redone picture makes new frames.
 *
 * The host calls are injected: tested without credits.
 */
import type { Scene } from '../model/types';
import type { Size } from './frames';
import { clipShape } from './makeClip';

export interface ClipFrameDeps {
  generate: (req: { prompt: string; aspectRatio: string; modelId: string; editImagePath: string; refImagePaths?: string[] }) => Promise<{ path: string }>;
  sizeOf: (path: string) => Promise<Size>;
  /** A copy of the picture cropped to exactly `size`; resolves its path. */
  conform: (path: string, size: Size, stem: string) => Promise<string>;
}

export const WIDEN_PIECE_PROMPT =
  'Extend this photograph to a wider frame. Keep everything already in the picture exactly as it is, at the same place, size and light: ' +
  'the room, the object, the shadows. Only add what lies beyond the edges, continuing the same walls, floor, furniture and light naturally. ' +
  'Never repeat or mirror anything from the picture: no second window, no second object, no plant.';

export const WIDEN_ALIVE_PROMPT =
  'The first image is the scene in its wide frame. The second image shows the same scene, narrower, after a change. ' +
  'Reproduce in the first image exactly what changed in the second (the plant and its leaves, at the same place and size on the object) ' +
  'and change nothing else: same framing, same room, same light, same sides.';

/** Within 2 % of the video's shape: the model takes it as it is. */
export function inShape(size: Size, aspectRatio: '16:9' | '9:16'): boolean {
  const target = aspectRatio === '16:9' ? 16 / 9 : 9 / 16;
  return size.w > 0 && size.h > 0 && Math.abs(size.w / size.h - target) / target < 0.02;
}

/**
 * The scene with the frames its clip should start and end on. Unchanged when
 * its pictures are already in shape, or when frames made from the same
 * pictures are already there (a clip redone costs no picture).
 */
export async function wideFrames(scene: Scene, modelId: string, deps: ClipFrameDeps): Promise<Scene> {
  const piece = scene.images.piece;
  const alive = scene.images.alive;
  if (!piece || !alive) return scene;
  if (scene.clipFrames && scene.clipFrames.from.piece === piece && scene.clipFrames.from.alive === alive) return scene;
  const { aspectRatio } = clipShape(scene.aspectRatio);
  const [a, b] = await Promise.all([deps.sizeOf(piece), deps.sizeOf(alive)]);
  if (inShape(a, aspectRatio) && inShape(b, aspectRatio)) {
    const next = { ...scene };
    delete next.clipFrames;
    return next;
  }
  const widePiece = (await deps.generate({ prompt: WIDEN_PIECE_PROMPT, aspectRatio, modelId, editImagePath: piece })).path;
  // A model that kept the old shape: the second picture is not paid for, the clip widens as before.
  const pa = await deps.sizeOf(widePiece);
  if (!inShape(pa, aspectRatio)) {
    console.warn(`[vitrine-studio] the widened frame came back ${pa.w}x${pa.h}, not ${aspectRatio}: the clip widens it instead`);
    return scene;
  }
  let wideAlive = (await deps.generate({ prompt: WIDEN_ALIVE_PROMPT, aspectRatio, modelId, editImagePath: widePiece, refImagePaths: [alive] })).path;
  // The video model refuses two frames of different sizes: the living one is cropped to the first.
  const pb = await deps.sizeOf(wideAlive);
  if (pa.w !== pb.w || pa.h !== pb.h) wideAlive = await deps.conform(wideAlive, pa, `${scene.id}-clip-alive`);
  return { ...scene, clipFrames: { piece: widePiece, alive: wideAlive, from: { piece, alive } } };
}
