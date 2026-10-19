import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { hostIO } from '../data/host';
import { FILM_FILE, FILMS_DIR, saveRecord, saveStudioJson } from '../data/folderStore';
import { followJob } from '../data/makeClip';
import { newId } from '../model/records';
import { LEGACY_FILM_ID, newFilm, withOnSite, type Film } from '../model/filmRecord';
import { describeError } from '../components/errors';
import { archiveFilm, deleteFilmForGood, filesOwnedByFilm } from '../data/removeFilm';
import type { RemoveMode, RemoveOutcome } from '../components/RemoveSceneDialog';
import type { Scene } from '../model/types';
import type { Costs } from './useCosts';
import type { Studio } from './useStudio';

/** What a new film starts from (the film wizard). */
export type FilmStart = Pick<Film, 'name' | 'pieceId' | 'animation' | 'workshopDescription' | 'workshopPhotoPath' | 'portraitPath' | 'animationRefPath' | 'aspectRatio'>;

/**
 * The films' writes and their clips' follow-ups. They live here, in the
 * studio, never in the Film tab: a clip takes minutes and the person switches
 * tabs (or films) meanwhile, and the host forgets a finished job after ONE read.
 * Every write names its film: a clip finishing on one film while another is
 * open is written to ITS film, never to the one on screen.
 */
export function useFilm(studio: Studio, costs: Costs) {
  const { t } = useI18n();
  const { folder, alive, putFilm, dropFilm, filmsRef, loaded, setNotice, setFilmId, settings } = studio;
  // The last clip that ended without a clip, and its film: shown only under that film.
  const [clipError, setClipError] = useState<{ filmId: string; error: { key: string; raw?: string } } | null>(null);

  /** Shows the film, then writes it to its own file. A failed write is said; the film stays on screen. */
  const saveFilm = async (next: Film): Promise<boolean> => {
    putFilm(next);
    if (!folder) return false;
    try {
      if (next.id === LEGACY_FILM_ID) await saveStudioJson(hostIO, folder, FILM_FILE, next);
      else await saveRecord(hostIO, folder, FILMS_DIR, next);
      return true;
    } catch (err) {
      console.error(`[vitrine-studio] film ${next.id} not written:`, err);
      if (alive.current) setNotice({ kind: 'error', text: t('film.notSaved') });
      return false;
    }
  };

  const getFilm = (id: string): Film | null => filmsRef.current.find((f) => f.id === id) ?? null;

  /** Applies a change to the LATEST state of that film (never the one of a render) and writes it. */
  const updateFilm = async (id: string, change: (f: Film) => Film): Promise<boolean> => {
    const current = getFilm(id);
    if (!current) return false;
    return saveFilm({ ...change(current), updatedAt: new Date().toISOString() });
  };

  /** Puts a film on the website (taking any other off), or takes it off. */
  const setOnSite = async (id: string, on: boolean): Promise<boolean> => {
    const next = withOnSite(filmsRef.current, id, on);
    let ok = true;
    for (const f of next) if (f !== filmsRef.current.find((x) => x.id === f.id)) ok = (await saveFilm({ ...f, updatedAt: new Date().toISOString() })) && ok;
    return ok;
  };

  /** A new film from the wizard, written, then opened. */
  const createFilm = async (start: FilmStart): Promise<Film | null> => {
    const film: Film = { ...newFilm(settings.profileId, start.aspectRatio, new Date(), newId(LEGACY_FILM_ID)), ...start };
    if (!(await saveFilm(film))) return null;
    setFilmId(film.id);
    return film;
  };

  /**
   * A copy of a film under a new id (Tony: « dupliquer une série de vidéos,
   * si on veut juste changer le produit de fin »): the same pictures, videos and
   * cuts, pointing at the same files (no file is copied; a removal never takes
   * a file another film uses), off the site, no video being made. Then opened.
   */
  const duplicateFilm = async (id: string, name: string): Promise<Film | null> => {
    const from = getFilm(id);
    if (!from) return null;
    const copy: Film = { ...from, id: newId(LEGACY_FILM_ID), name, validated: false, clipJobs: {}, updatedAt: new Date().toISOString() };
    if (!(await saveFilm(copy))) return null;
    setFilmId(copy.id);
    return copy;
  };

  /**
   * Follows one film clip to its end, ONCE per film and job id (a redone clip
   * reuses its step id, never its job id). Its path is written the moment it is
   * read. A job replaced meanwhile (the keyframes were redone) is left alone.
   */
  const followed = useRef(new Set<string>());
  const followFilmClip = (filmId: string, stepId: string, job: { id: string; startedAt: string }) => {
    const key = `${filmId}:${job.id}`;
    if (followed.current.has(key)) return;
    followed.current.add(key);
    const withoutJob = (f: Film, clip?: string): Film => {
      if (f.clipJobs[stepId]?.id !== job.id) return f;
      const { [stepId]: _done, ...jobs } = f.clipJobs;
      if (!clip) return { ...f, clipJobs: jobs };
      const { [stepId]: _oldCut, ...cuts } = f.cuts;
      return { ...f, clips: { ...f.clips, [stepId]: clip }, cuts, clipJobs: jobs, validated: false };
    };
    setClipError(null);
    void (async () => {
      try {
        const path = await followJob(job, costs.spendingClips(filmId), () => {});
        await updateFilm(filmId, (f) => withoutJob(f, path));
      } catch (err) {
        console.warn(`[vitrine-studio] film ${filmId} clip ${stepId} ended without a clip:`, err);
        // The job is over either way: forget it, so the button comes back.
        await updateFilm(filmId, (f) => withoutJob(f));
        if (alive.current) setClipError({ filmId, error: describeError(err) });
      }
    })();
  };

  // A studio reloaded while clips were being made picks their follow-up back, every film.
  useEffect(() => {
    if (!loaded) return;
    for (const f of filmsRef.current) for (const [stepId, job] of Object.entries(f.clipJobs)) followFilmClip(f.id, stepId, job);
    // followFilmClip reads the latest films through the ref; once per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /**
   * A film out of the studio, archived or deleted for good (data/removeFilm.ts).
   * Refused for the film on the site and for one with a clip being made: that
   * clip is paid and would arrive with nowhere to go.
   */
  const removeFilm = async (id: string, mode: RemoveMode, scenes: readonly Scene[]): Promise<RemoveOutcome> => {
    const film = getFilm(id);
    if (!folder || !film) return { ok: false, error: { key: 'error.unknown' } };
    if (film.validated) return { ok: false, error: { key: 'film.remove.onSite' } };
    if (Object.keys(film.clipJobs).length) return { ok: false, error: { key: 'film.remove.running' } };
    try {
      let left: string[] = [];
      if (mode === 'archive') await archiveFilm(hostIO, folder, film, new Date().toISOString());
      else left = await deleteFilmForGood(hostIO, folder, film, filesOwnedByFilm(film, filmsRef.current, scenes));
      dropFilm(id);
      return { ok: true, left };
    } catch (err) {
      console.error(`[vitrine-studio] film ${id} was not removed:`, err);
      return { ok: false, error: describeError(err) };
    }
  };

  const clipErrorOf = (filmId: string) => (clipError?.filmId === filmId ? clipError.error : null);

  return { clipErrorOf, removeFilm, duplicateFilm, updateFilm, followFilmClip, getFilm, setOnSite, createFilm };
}
