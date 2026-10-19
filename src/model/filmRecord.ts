/**
 * A film's record (doc 145 §10.7), written after every keyframe and every clip.
 * A studio holds several (Tony: « faire une nouvelle vidéo, tout le process
 * comme la création de scène »): the first one keeps its file, `studio/film.json`,
 * and its id `film` forever (kits write it, older studios have it); every new
 * one is `studio/films/<id>.json`. Only one is on the website at a time.
 *
 * Read through `normalizeFilm`, never trusted as is: a field that cannot be
 * read is ABSENT, and a step id the trade does not know is dropped (a trade
 * changed under a film half made must not leave orphan paths that look made).
 */
import { PROFILES } from './profiles';
import { filmOf, type FilmStep } from './film';
import { readPrompts } from './records';
import { isSafeId } from '../data/folderStore';

export const FILM_SCHEMA = 1 as const;
/** The first film's id, the one in `studio/film.json`. */
export const LEGACY_FILM_ID = 'film';
/** A cost line of any film: the first one's id, or a new one's (`film-…`). */
export const isFilmRecord = (record: string) => record === LEGACY_FILM_ID || record.startsWith(`${LEGACY_FILM_ID}-`);

export interface FilmJob { id: string; startedAt: string }

/** Where a part starts and ends inside its clip, in seconds. Absent = the whole clip. */
export interface Cut { in: number; out: number }

/** The shortest part kept: under it a cut is a mistake of the slider, not a choice. */
export const MIN_PART_SECONDS = 0.2;
/** No clip is this long (they are 6 s): a larger number is a broken file, never a cut. */
const MAX_CUT_SECONDS = 120;

export interface Film {
  schema: typeof FILM_SCHEMA;
  /** `film` for the first one; `film-…` for the ones made after. */
  id: string;
  /** Her name for it; empty = the studio says « Film N ». */
  name: string;
  profileId: string;
  /** The person's words about their workshop. Empty = the trade's default. */
  workshopDescription: string;
  /** Their own photo of the workshop, edited into the first keyframe. */
  workshopPhotoPath?: string;
  /** Their portrait: without it the person is framed without a face. */
  portraitPath?: string;
  pieceId?: string;
  animation: string;
  animationRefPath?: string;
  /** '16:9' or '9:16': the only shapes the video model makes. */
  aspectRatio: '16:9' | '9:16';
  /** The steps whose picture is HER photo, put in place as it is: never deleted with the film. */
  ownFrames?: string[];
  /** Keyframe per step id, absolute paths. A step not made yet is ABSENT. */
  keyframes: Record<string, string>;
  /**
   * The keyframe as a clip receives it: a copy cropped to the first keyframe's
   * size when an edit came back a few pixels off. Absent when it already matched.
   */
  conformed: Record<string, string>;
  /** Clip per step id it ENDS on (the first step has none). */
  clips: Record<string, string>;
  /** Clips being made, so a reloaded studio picks their follow-up back. */
  clipJobs: Record<string, FilmJob>;
  /**
   * The part of each clip that is played, per step id, to make the cuts
   * between clips land where the person wants. Nothing is re-encoded: the
   * site plays the clip from `in` to `out`. A new clip forgets its cut.
   */
  cuts: Record<string, Cut>;
  /** Instructions the person rewrote by hand (advanced mode), per step: the keyframe and the clip that ends on it. */
  prompts: Record<string, { image?: string; clip?: string }>;
  /** Only a validated, complete film goes on the website. */
  validated: boolean;
  updatedAt: string;
}

const text = (v: unknown, max = 200): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const isInstant = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

function pathsOf(raw: unknown, ids: Set<string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const p = text(v, 1000);
    if (ids.has(k) && p) out[k] = p;
  }
  return out;
}

export function newFilm(profileId: string, aspectRatio: string, now: Date = new Date(), id: string = LEGACY_FILM_ID, name = ''): Film {
  return {
    schema: FILM_SCHEMA, id, name, profileId, workshopDescription: '', animation: '',
    aspectRatio: aspectRatio === '9:16' || aspectRatio === '3:4' ? '9:16' : '16:9',
    keyframes: {}, conformed: {}, clips: {}, clipJobs: {}, cuts: {}, prompts: {}, validated: false, updatedAt: now.toISOString(),
  };
}

export function normalizeFilm(raw: unknown): Film | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const profile = PROFILES.find((p) => p.id === r.profileId);
  if (!profile) return null;
  const ids = new Set(filmOf(profile).steps.map((s) => s.id));
  const film: Film = {
    ...newFilm(profile.id, typeof r.aspectRatio === 'string' ? r.aspectRatio : '16:9', undefined, typeof r.id === 'string' && isSafeId(r.id) ? r.id : LEGACY_FILM_ID, text(r.name, 80) ?? ''),
    workshopDescription: text(r.workshopDescription, 1500) ?? '',
    animation: text(r.animation, 500) ?? '',
    keyframes: pathsOf(r.keyframes, ids),
    conformed: pathsOf(r.conformed, ids),
    clips: pathsOf(r.clips, ids),
    validated: r.validated === true,
    updatedAt: isInstant(r.updatedAt) ? r.updatedAt : new Date(0).toISOString(),
  };
  for (const key of ['workshopPhotoPath', 'portraitPath', 'animationRefPath'] as const) {
    const p = text(r[key], 1000);
    if (p) film[key] = p;
  }
  const pieceId = text(r.pieceId, 80);
  if (pieceId) film.pieceId = pieceId;
  if (Array.isArray(r.ownFrames)) {
    const own = r.ownFrames.filter((s): s is string => typeof s === 'string' && !!film.keyframes[s]);
    if (own.length) film.ownFrames = [...new Set(own)];
  }
  if (r.prompts && typeof r.prompts === 'object') {
    for (const [k, v] of Object.entries(r.prompts as Record<string, unknown>)) {
      const p = ids.has(k) ? readPrompts(v, ['image', 'clip']) : undefined;
      if (p) film.prompts[k] = p;
    }
  }
  // A cut only for a clip that is there, and only one that leaves a part to play.
  if (r.cuts && typeof r.cuts === 'object') {
    for (const [k, v] of Object.entries(r.cuts as Record<string, unknown>)) {
      const cut = readCut(v);
      if (film.clips[k] && cut) film.cuts[k] = cut;
    }
  }
  if (r.clipJobs && typeof r.clipJobs === 'object') {
    for (const [k, v] of Object.entries(r.clipJobs as Record<string, unknown>)) {
      const j = v as Record<string, unknown> | null;
      if (ids.has(k) && j && typeof j.id === 'string' && j.id && isInstant(j.startedAt)) film.clipJobs[k] = { id: j.id, startedAt: j.startedAt };
    }
  }
  return film;
}

/** A cut as written, or null when it is not one (absent, reversed, too short, not numbers). */
export function readCut(raw: unknown): Cut | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= MAX_CUT_SECONDS;
  if (!ok(r.in) || !ok(r.out) || r.out - r.in < MIN_PART_SECONDS) return null;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return { in: round(r.in), out: round(r.out) };
}

/**
 * The film with one part's cut set, or taken off (`null`). A cut that keeps
 * the whole clip (from 0 to its end) is no cut: it is not written.
 */
export function withCut(film: Film, stepId: string, cut: Cut | null, duration?: number): Film {
  const cuts = { ...film.cuts };
  const read = cut && readCut(cut);
  const whole = !!read && read.in <= 0.001 && duration !== undefined && read.out >= duration - 0.001;
  if (read && !whole && film.clips[stepId]) cuts[stepId] = read;
  else delete cuts[stepId];
  return { ...film, cuts };
}

/** The first step without its keyframe, or null when all are made. */
export function nextKeyframe(film: Film, steps: FilmStep[]): FilmStep | null {
  return steps.find((s) => !film.keyframes[s.id]) ?? null;
}

/**
 * Remaking a keyframe throws away every keyframe after it (they were edits of
 * the old picture) and every clip that touches it or them.
 */
export function filmWithoutFrom(film: Film, stepId: string, steps: FilmStep[]): Film {
  const from = steps.findIndex((s) => s.id === stepId);
  const keep = (rec: Record<string, string>) => Object.fromEntries(Object.entries(rec).filter(([k]) => steps.findIndex((s) => s.id === k) < from));
  return {
    ...film,
    keyframes: keep(film.keyframes),
    conformed: keep(film.conformed),
    clips: keep(film.clips),
    cuts: Object.fromEntries(Object.entries(film.cuts).filter(([k]) => steps.findIndex((s) => s.id === k) < from)),
    clipJobs: Object.fromEntries(Object.entries(film.clipJobs).filter(([k]) => steps.findIndex((s) => s.id === k) < from)),
    ...(film.ownFrames ? { ownFrames: film.ownFrames.filter((k) => steps.findIndex((s) => s.id === k) < from) } : {}),
    validated: false,
  };
}

/**
 * One keyframe replaced by another picture (her own photo, or the same one with
 * its setting changed): the keyframes after it are thrown away (they were edits
 * of the old one and are made again from the new), and so is every clip that
 * touches it, the one that ends on it included.
 */
export function withKeyframe(film: Film, stepId: string, path: string, steps: FilmStep[], own = false): Film {
  const i = steps.findIndex((s) => s.id === stepId);
  if (i < 0) return film;
  const next = steps[i + 1];
  const base = next ? filmWithoutFrom(film, next.id, steps) : { ...film, validated: false };
  const drop = <T,>(rec: Record<string, T>) => Object.fromEntries(Object.entries(rec).filter(([k]) => k !== stepId));
  // Which pictures are hers: the ones still there, and this one when it is.
  const ownFrames = (base.ownFrames ?? []).filter((s) => s !== stepId && base.keyframes[s]).concat(own ? [stepId] : []);
  const out: Film = { ...base, keyframes: { ...base.keyframes, [stepId]: path }, conformed: drop(base.conformed), clips: drop(base.clips), cuts: drop(base.cuts), clipJobs: drop(base.clipJobs) };
  if (ownFrames.length) out.ownFrames = ownFrames;
  else delete out.ownFrames;
  return out;
}

/**
 * One film on the website, or none: putting one on takes every other off
 * (the site has one home film). Taking one off touches only it.
 */
export function withOnSite(films: Film[], id: string, on: boolean): Film[] {
  return films.map((f) => (f.id === id ? { ...f, validated: on } : on && f.validated ? { ...f, validated: false } : f));
}

/** The film the website shows: the one put on it. */
export const filmOnSite = (films: readonly Film[]): Film | null => films.find((f) => f.validated) ?? null;

/** The steps whose clip is still to make: neither there nor being made. */
export function clipsToMake(film: Film, steps: FilmStep[]): FilmStep[] {
  return steps.slice(1).filter((s) => !film.clips[s.id] && !film.clipJobs[s.id]);
}

/** Every keyframe and every clip is there. */
export function filmComplete(film: Film, steps: FilmStep[]): boolean {
  return steps.every((s) => film.keyframes[s.id]) && steps.slice(1).every((s) => film.clips[s.id]);
}
