import type { Film } from './filmRecord';
import type { FilmStep } from './film';

/** `film-2026-10-10-1432`: one file per export, never one written over another. */
export function filmFileStem(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `film-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

/** The film's parts in their order, each with its cut, as ffmpeg will read them. */
export function filmParts(film: Film, steps: FilmStep[]): Array<{ path: string; in?: number; out?: number }> {
  return steps.slice(1).filter((s) => film.clips[s.id]).map((s) => ({ path: film.clips[s.id]!, ...(film.cuts[s.id] ?? {}) }));
}
