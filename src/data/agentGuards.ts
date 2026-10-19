/**
 * The refusals an agent meets at the studio's door (doc 149), kept pure so a
 * test holds each one: removing a guard breaks a test, never only a comment.
 *
 * 🚨 One scene's pictures at a time, whichever door started them (the person's
 * « Faire » button, the agent's `makeScene`, a request file): each picture is
 * paid, two makes in parallel pay twice.
 */
import { nextBeat } from '../model/records';
import type { Scene } from '../model/types';
import type { SceneWork } from '../components/ScenesPanel';

type Work = Readonly<Record<string, SceneWork | undefined>>;

/**
 * True while pictures are being made for any scene. `agentMake.state ===
 * 'making'` counts too: the request door writes it to disk BEFORE its first
 * picture, so during that save the screen's `work` says nothing yet.
 */
export function anyMaking(work: Work, scenes: readonly Scene[] = []): boolean {
  return Object.values(work).some((w) => !!w?.making)
    || scenes.some((s) => s.agentMake?.state === 'making' && !!nextBeat(s));
}

/** True while this scene is being worked on in any way (pictures, clip, layers). */
export function sceneBusy(work: Work, sceneId: string): boolean {
  const w = work[sceneId];
  return !!(w?.making || w?.clipping || w?.layering);
}

/** Why `makeScene` refuses, or null when it may start. */
export function makeSceneRefusal(scene: Scene, work: Work, scenes: readonly Scene[]): string | null {
  if (!nextBeat(scene)) return 'NOTHING_TO_MAKE: this scene already has its three pictures';
  const w = work[scene.id];
  if (w?.clipping || w?.layering) return 'BUSY: this scene is being worked on now';
  if (anyMaking(work, scenes)) return 'BUSY: pictures are being made for a scene now; one scene at a time, call scenes and try again when it is done';
  return null;
}

/** Why `validateScene` refuses, or null. Taking a scene OFF the site is always allowed. */
export function validateSceneRefusal(scene: Scene, online: boolean): string | null {
  if (online && nextBeat(scene)) return 'NOT_MADE: a scene goes on the site once its pictures are made';
  return null;
}
