/**
 * Makes the home film (doc 145 §10.7): the keyframes one by one, each an edit
 * of the one before, then one clip per consecutive pair.
 *
 * The host calls are injected: tested without credits. Every function returns
 * the NEXT film and saves nothing; the caller writes `film.json` after each
 * step, so a refusal keeps everything made before it.
 */
import { filmOf, filmPrompts, FILM_NEGATIVE, type FilmStep } from '../model/film';
import type { TradeProfile } from '../model/profiles';
import type { Film } from '../model/filmRecord';
import type { Piece, StudioSettings } from '../model/types';
import type { GenerateRequest } from './host';
import { CLIP_SECONDS, type ClipDeps } from './makeClip';
import { sameSize, type Size } from './frames';

export interface FilmDeps {
  generate: (req: GenerateRequest) => Promise<{ path: string; model: string }>;
  modelFor: (quality: StudioSettings['quality']) => string;
  /** A picture's size on disk. */
  sizeOf: (path: string) => Promise<Size>;
  /** A copy of the picture cropped to `size`; resolves the copy's path. */
  conform: (path: string, size: Size, stem: string) => Promise<string>;
  now: () => Date;
}

export class FilmError extends Error {
  constructor(public readonly code: 'FILM_NO_PIECE' | 'PIECE_HAS_NO_PHOTO' | 'FILM_NO_PREVIOUS' | 'FILM_KEYFRAMES_MISSING', detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'FilmError';
  }
}

const promptsOf = (film: Film, profile: TradeProfile, piece: Piece | undefined) => filmPrompts({
  profile,
  workshopDescription: film.workshopDescription,
  fromPhoto: !!film.workshopPhotoPath,
  hasPortrait: !!film.portraitPath,
  ...(piece?.description ? { pieceDescription: piece.description } : {}),
  animation: film.animation,
});

/** Makes ONE keyframe. The steps after it must already be cleared by the caller. */
export async function makeKeyframe(film: Film, step: FilmStep, piece: Piece | undefined, profile: TradeProfile, quality: StudioSettings['quality'], deps: FilmDeps): Promise<Film> {
  const steps = filmOf(profile).steps;
  const i = steps.findIndex((s) => s.id === step.id);
  const prompt = film.prompts[step.id]?.image ?? promptsOf(film, profile, piece)[i]!.prompt;
  const refs: string[] = [];
  for (const ref of step.refs) {
    if (ref === 'portrait' && film.portraitPath) refs.push(film.portraitPath);
    if (ref === 'animationRef' && film.animationRefPath) refs.push(film.animationRefPath);
    if (ref === 'piece') {
      // Drawing the piece from words alone would stage a piece they never made.
      if (!piece) throw new FilmError('FILM_NO_PIECE');
      if (!piece.photoPath) throw new FilmError('PIECE_HAS_NO_PHOTO', piece.name);
      refs.push(piece.photoPath);
    }
  }
  const modelId = deps.modelFor(quality);
  let req: GenerateRequest;
  if (i === 0) {
    req = film.workshopPhotoPath
      ? { prompt, modelId, editImagePath: film.workshopPhotoPath, aspectRatio: film.aspectRatio }
      : { prompt, modelId, aspectRatio: film.aspectRatio };
  } else {
    const before = film.keyframes[steps[i - 1]!.id];
    if (!before) throw new FilmError('FILM_NO_PREVIOUS', steps[i - 1]!.id);
    req = { prompt, modelId, editImagePath: before, ...(refs.length ? { refImagePaths: refs } : {}) };
  }
  const made = await deps.generate(req);
  const conformed = { ...film.conformed };
  delete conformed[step.id];
  return { ...film, keyframes: { ...film.keyframes, [step.id]: made.path }, conformed, validated: false, updatedAt: deps.now().toISOString() };
}

/**
 * Measures every keyframe against the first and crops a copy of each one that
 * differs. The first keyframe is the reference and is never copied.
 */
export async function conformKeyframes(film: Film, steps: FilmStep[], deps: FilmDeps): Promise<Film> {
  const missing = steps.filter((s) => !film.keyframes[s.id]).map((s) => s.id);
  if (missing.length) throw new FilmError('FILM_KEYFRAMES_MISSING', missing.join(', '));
  const target = await deps.sizeOf(film.keyframes[steps[0]!.id]!);
  const conformed: Record<string, string> = {};
  for (const s of steps.slice(1)) {
    const path = film.keyframes[s.id]!;
    if (sameSize(await deps.sizeOf(path), target)) continue;
    // An earlier copy of THIS keyframe is reused: the crop is deterministic.
    conformed[s.id] = film.conformed[s.id] ?? await deps.conform(path, target, `film-${s.id}-${target.w}x${target.h}-${deps.now().getTime().toString(36)}`);
  }
  return { ...film, conformed, updatedAt: deps.now().toISOString() };
}

/** The picture a clip receives for a step: the cropped copy when there is one. */
export const frameFor = (film: Film, stepId: string): string | undefined => film.conformed[stepId] ?? film.keyframes[stepId];

/** Starts the clip that ENDS on `step`. Resolves the film with its job recorded. */
export async function startFilmClip(film: Film, step: FilmStep, piece: Piece | undefined, profile: TradeProfile, clip: ClipDeps, now: Date = new Date()): Promise<Film> {
  const steps = filmOf(profile).steps;
  const i = steps.findIndex((s) => s.id === step.id);
  if (i < 1) throw new FilmError('FILM_NO_PREVIOUS', step.id);
  const start = frameFor(film, steps[i - 1]!.id);
  const end = frameFor(film, step.id);
  if (!start || !end) throw new FilmError('FILM_KEYFRAMES_MISSING', !start ? steps[i - 1]!.id : step.id);
  const job = await clip.start({
    prompt: film.prompts[step.id]?.clip ?? promptsOf(film, profile, piece)[i]!.clip,
    negativePrompt: FILM_NEGATIVE,
    durationSeconds: CLIP_SECONDS,
    aspectRatio: film.aspectRatio,
    fit: 'widen',
    startImagePath: start,
    endImagePath: end,
  });
  const clips = { ...film.clips };
  delete clips[step.id];
  // A new clip has its own timing: the old cut does not apply to it.
  const cuts = { ...film.cuts };
  delete cuts[step.id];
  return { ...film, clips, cuts, clipJobs: { ...film.clipJobs, [step.id]: { id: job.id, startedAt: now.toISOString() } }, validated: false, updatedAt: now.toISOString() };
}
