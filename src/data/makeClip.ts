/**
 * The clip of a scene, from the creation to the living (doc 145 lot 4).
 *
 * Veo takes the scene's "your creation" picture as its FIRST frame and the
 * "living" picture as its LAST: the clip can only show the change between
 * two pictures that share one camera, which is what the three beats are made
 * for. It answers a job at once; the clip itself takes 11 s to 6 min.
 *
 * The job id is saved in the scene (`clipJob`), so a studio reloaded mid-way
 * picks the follow-up back. A job the host no longer knows (the app was
 * restarted) is dropped with a sentence, never followed forever.
 *
 * The host calls are injected: tested without credits.
 */
import { clipNegative, clipPrompt, type TradeProfile } from '../model/profiles';
import type { Scene } from '../model/types';
import { promptFor } from '../model/records';
import { keepTakes } from '../model/takes';

export interface ClipJob {
  id: string;
  state: 'running' | 'done' | 'failed';
  path: string | null;
  error?: string | null;
  /** What the gate debited, micro-USD, once the clip is done; null when it did not say. */
  billedUsdMicro?: number | null;
  model?: string;
}

export interface ClipDeps {
  start: (params: Record<string, unknown>) => Promise<ClipJob>;
  status: (jobId: string) => Promise<ClipJob>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export const CLIP_SECONDS = 6;
export const CLIP_POLL_MS = 10_000;
/** The host gives up near 6 minutes; past this the follow-up stops and says so. */
export const CLIP_WAIT_MS = 9 * 60_000;

export class ClipError extends Error {
  constructor(public readonly code: 'CLIP_NEEDS_TWO_PICTURES' | 'CLIP_TIMEOUT' | 'CLIP_FAILED' | 'CLIP_LOST', detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'ClipError';
  }
}

/**
 * Veo makes 16:9 or 9:16. The DECLARED shape picks which; the pictures
 * themselves may differ (a scene started from the person's own 4:3 photo), so
 * `fit: widen` is ALWAYS sent: it changes nothing on a frame already in shape
 * and widens one that is not, by mirroring its edges.
 */
export function clipShape(aspectRatio: string): { aspectRatio: '16:9' | '9:16' } {
  return { aspectRatio: aspectRatio === '9:16' || aspectRatio === '3:4' ? '9:16' : '16:9' };
}

/** Starts the clip. Resolves the scene with its job recorded. */
export async function startClip(scene: Scene, profile: TradeProfile, deps: ClipDeps, now: Date = new Date()): Promise<Scene> {
  if (!scene.images.piece || !scene.images.alive) throw new ClipError('CLIP_NEEDS_TWO_PICTURES');
  const shape = clipShape(scene.aspectRatio);
  const job = await deps.start({
    prompt: promptFor(scene, 'clip', clipPrompt(profile, scene.animation, scene.clipStyle)),
    negativePrompt: clipNegative(profile, scene.animation),
    durationSeconds: CLIP_SECONDS,
    aspectRatio: shape.aspectRatio,
    fit: 'widen',
    // The wide frames when the scene has them (data/clipFrames.ts), its own pictures otherwise.
    startImagePath: scene.clipFrames?.piece ?? scene.images.piece,
    endImagePath: scene.clipFrames?.alive ?? scene.images.alive,
  });
  // The clip being replaced is kept as a take: it can be put back.
  const next: Scene = { ...keepTakes(scene, [], true), clipJob: { id: job.id, startedAt: now.toISOString() }, validated: false, updatedAt: now.toISOString() };
  delete next.clipPath;
  delete next.clipCut;
  return next;
}

/**
 * Follows a started clip until the host says done or failed. Resolves the
 * scene with its clip (and no job), or throws a named error; `onTick` hears
 * the seconds elapsed, for the screen's clock.
 */
export async function followClip(scene: Scene, deps: ClipDeps, onTick: (elapsedS: number) => void): Promise<Scene> {
  if (!scene.clipJob) throw new ClipError('CLIP_LOST');
  const path = await followJob(scene.clipJob, deps, onTick);
  // A new clip has not been seen yet: it goes online only once validated again.
  const next: Scene = { ...scene, clipPath: path, validated: false, updatedAt: new Date(deps.now()).toISOString() };
  delete next.clipJob;
  return next;
}

/**
 * Follows one video job to its end and resolves the clip's path (the scene's
 * clip and every clip of the home film go through here). A job the host
 * forgot is LOST; a passing read error is asked again, never let go: the clip
 * is still being made and paid for.
 */
export async function followJob(job: { id: string; startedAt: string }, deps: ClipDeps, onTick: (elapsedS: number) => void): Promise<string> {
  const started = Date.parse(job.startedAt);
  const deadline = deps.now() + CLIP_WAIT_MS;
  for (;;) {
    let state: ClipJob | null = null;
    try {
      state = await deps.status(job.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // The host forgot the job (it restarted): following it would wait forever.
      if (msg.startsWith('UNKNOWN_JOB')) throw new ClipError('CLIP_LOST');
      console.warn('[vitrine-studio] clip status unreadable, asking again:', msg);
    }
    if (!state) {
      if (deps.now() > deadline) throw new ClipError('CLIP_TIMEOUT');
      await deps.sleep(CLIP_POLL_MS);
      continue;
    }
    if (state.state === 'done' && state.path) return state.path;
    if (state.state === 'failed') throw new ClipError('CLIP_FAILED', state.error ?? undefined);
    if (deps.now() > deadline) throw new ClipError('CLIP_TIMEOUT');
    onTick(Math.max(0, Math.round((deps.now() - started) / 1000)));
    await deps.sleep(CLIP_POLL_MS);
  }
}
