import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { hostIO, pickFolder, readMirroredFolder, readRememberedFolder, rememberFolder } from '../data/host';
import { FILM_FILE, FILMS_DIR, loadRecords, loadSettingsRaw, loadStudioJson, MARKETS_DIR, PIECES_DIR, saveRecord, saveSettings, saveStudioJson, SCENES_DIR, SITE_FILE } from '../data/folderStore';
import { normalizeMarket, normalizePiece, normalizeScene, normalizeSettings, normalizeSiteSettings } from '../model/records';
import { LEGACY_FILM_ID, newFilm, normalizeFilm, type Film } from '../model/filmRecord';
import { COSTS_FILE, normalizeCosts, type CostEntry } from '../model/costs';
import { DEFAULT_SETTINGS, type Piece, type Scene, type StudioSettings } from '../model/types';
import type { Market, SiteSettings } from '../site/buildSite';
import { describeError, errorText } from '../components/errors';
import { useAlive } from './useAlive';
import { keepOwn } from '../data/folderWatch';

export type Notice = { kind: 'error' | 'info'; text: string } | null;

const byName = (a: Piece, b: Piece) => a.name.localeCompare(b.name);
export const sortPieces = (all: Piece[]) => [...all].sort(byName);

/**
 * The studio's folder and everything read from it. The folder the person
 * picked is the source of truth: this hook reads it, holds what it read, and
 * writes the settings and the site back. The other hooks act on what it holds.
 */
export function useStudio() {
  const { t } = useI18n();
  const alive = useAlive();
  const [folder, setFolder] = useState<string | null | undefined>(undefined);
  const [notice, setNotice] = useState<Notice>(null);
  const [loaded, setLoaded] = useState(false);
  const [pieces, setPieces] = useState<Piece[]>([]);
  // A save that waited on a long job (a cut-out, a picture) reads the piece as it is NOW,
  // never the copy it started from: a rename made meanwhile is never undone.
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const [scenes, setScenes] = useState<Scene[]>([]);
  // Loops that save one record after another read the scenes as they are NOW.
  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [unreadable, setUnreadable] = useState<string[]>([]);
  const [site, setSite] = useState<SiteSettings>(normalizeSiteSettings(null, ''));
  const siteRef = useRef(site);
  siteRef.current = site;
  const [markets, setMarkets] = useState<Market[]>([]);
  /** Every film, the first one first; null until the folder is read. */
  const [films, setFilms] = useState<Film[] | null>(null);
  /** The latest films, read by the clips' follow-ups which outlive any render. */
  const filmsRef = useRef<Film[]>([]);
  /** The film open in the Film tab. */
  const [filmId, setFilmId] = useState(LEGACY_FILM_ID);
  const film = films?.find((f) => f.id === filmId) ?? films?.[0] ?? null;
  /** A film shown as it is now (added if new); writing it is the caller's. */
  const putFilm = useCallback((next: Film) => {
    const at = filmsRef.current.findIndex((f) => f.id === next.id);
    filmsRef.current = at < 0 ? [...filmsRef.current, next] : filmsRef.current.map((f, i) => (i === at ? next : f));
    setFilms(filmsRef.current);
  }, []);
  /**
   * A film gone from the studio; the open one becomes the first left. With none
   * left, a new first film (not written until its first change) takes the place.
   */
  const dropFilm = useCallback((id: string) => {
    const left = filmsRef.current.filter((f) => f.id !== id);
    filmsRef.current = left.length ? left : [newFilm(settingsRef.current.profileId, settingsRef.current.aspectRatio)];
    setFilms(filmsRef.current);
    setFilmId(filmsRef.current[0]!.id);
  }, []);
  /** What was spent (studio/costs.json, append only). */
  const [costs, setCosts] = useState<CostEntry[]>([]);
  /** False when the file exists but cannot be read: then nothing is written over it. */
  const [costsReadable, setCostsReadable] = useState(true);

  // Where the studio lives: this origin's memory first, the host mirror second.
  useEffect(() => {
    const local = readRememberedFolder();
    if (local) {
      setFolder(local);
      return;
    }
    readMirroredFolder().then(
      (f) => alive.current && setFolder(f),
      (err: unknown) => {
        console.warn('[vitrine-studio] the remembered folder could not be read:', err);
        if (alive.current) setFolder(null);
      },
    );
  }, [alive]);

  const fail = useCallback((err: unknown) => {
    console.error('[vitrine-studio]', err);
    if (alive.current) setNotice({ kind: 'error', text: errorText(describeError(err)) });
  }, [alive]);

  const load = useCallback(async (root: string) => {
    setLoaded(false);
    setNotice(null);
    try {
      const [p, s, rawSettings, rawSite, m, rawFilm, more] = await Promise.all([
        loadRecords(hostIO, root, PIECES_DIR, normalizePiece),
        loadRecords(hostIO, root, SCENES_DIR, normalizeScene),
        loadSettingsRaw(hostIO, root),
        loadStudioJson(hostIO, root, SITE_FILE),
        // The markets are MnemoCRM's; a folder without them simply has no events.
        loadRecords(hostIO, root, MARKETS_DIR, normalizeMarket, false),
        loadStudioJson(hostIO, root, FILM_FILE),
        // The films made after the first; a studio without them simply has none.
        loadRecords(hostIO, root, FILMS_DIR, normalizeFilm, false),
      ]);
      if (!alive.current) return;
      setSite(normalizeSiteSettings(rawSite, ''));
      setMarkets(m.records);
      setPieces(sortPieces(p.records));
      setScenes([...s.records].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      const st = normalizeSettings(rawSettings);
      setSettings(st);
      // No film yet, or one that cannot be read: a new one, written only on the first change.
      if (rawFilm !== null && !normalizeFilm(rawFilm)) console.warn('[vitrine-studio] studio/film.json could not be read; a new film starts.');
      // The first film is always the one in film.json, whatever id its file says.
      const first = { ...(normalizeFilm(rawFilm) ?? newFilm(st.profileId, st.aspectRatio)), id: LEGACY_FILM_ID };
      // A file there without its own id reads as the first film's: said, never merged into it.
      const stray = more.records.filter((f) => f.id === LEGACY_FILM_ID).length;
      if (stray) console.warn(`[vitrine-studio] ${stray} file(s) in studio/films have no film id and are left aside.`);
      const others = more.records.filter((f) => f.id !== LEGACY_FILM_ID).sort((a, b) => a.id.localeCompare(b.id));
      if (more.unreadable.length) console.warn('[vitrine-studio] films not readable:', more.unreadable);
      filmsRef.current = [first, ...others];
      setFilms(filmsRef.current);
      try {
        setCosts(normalizeCosts(await loadStudioJson(hostIO, root, COSTS_FILE)));
        setCostsReadable(true);
      } catch (err) {
        console.error('[vitrine-studio] studio/costs.json could not be read; nothing will be written over it:', err);
        setCosts([]);
        setCostsReadable(false);
      }
      setUnreadable([...p.unreadable, ...s.unreadable]);
      setLoaded(true);
    } catch (err) {
      console.error('[vitrine-studio] the folder could not be read:', err);
      if (alive.current) setNotice({ kind: 'error', text: t('app.loadError', { what: err instanceof Error ? err.message : String(err) }) });
    }
  }, [t, alive]);

  useEffect(() => {
    if (folder) void load(folder);
  }, [folder, load]);

  /**
   * The records someone else changed in the folder, read again WITHOUT the
   * loading screen (an open scene stays open). Pieces, scenes and markets
   * only: the folder watch looks at nothing else. A record the studio itself
   * wrote in the last seconds keeps the copy in hand: its save may still be on
   * its way, and the disk would put the version before it back.
   */
  const refresh = async (): Promise<boolean> => {
    if (!folder) return false;
    const root = folder;
    try {
      const [p, s, m] = await Promise.all([
        loadRecords(hostIO, root, PIECES_DIR, normalizePiece),
        loadRecords(hostIO, root, SCENES_DIR, normalizeScene),
        loadRecords(hostIO, root, MARKETS_DIR, normalizeMarket, false),
      ]);
      if (!alive.current || folder !== root) return false;
      const nextPieces = sortPieces(keepOwn(root, PIECES_DIR, p.records, piecesRef.current));
      const nextScenes = keepOwn(root, SCENES_DIR, s.records, scenesRef.current).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      piecesRef.current = nextPieces;
      scenesRef.current = nextScenes;
      setPieces(nextPieces);
      setScenes(nextScenes);
      setMarkets(m.records);
      setUnreadable([...p.unreadable, ...s.unreadable]);
      return true;
    } catch (err) {
      console.warn('[vitrine-studio] the folder changed but could not be read again:', err);
      return false;
    }
  };

  const chooseFolder = async () => {
    try {
      const f = await pickFolder();
      if (!f) return;
      try {
        await rememberFolder(f);
      } catch (err) {
        console.warn('[vitrine-studio] the folder choice was not mirrored to the host:', err);
      }
      setFolder(f);
    } catch (err) {
      fail(err);
    }
  };

  const replaceScene = (s: Scene) => {
    // The ref too: a loop that saves one scene after another reads it before the next render.
    scenesRef.current = scenesRef.current.map((x) => (x.id === s.id ? s : x));
    setScenes((all) => all.map((x) => (x.id === s.id ? s : x)));
  };
  const replacePiece = (p: Piece) => {
    piecesRef.current = piecesRef.current.map((x) => (x.id === p.id ? p : x));
    setPieces((all) => sortPieces(all.map((x) => (x.id === p.id ? p : x))));
  };

  /** Writes a scene; throws when it cannot (the caller says it where the scene is). */
  const saveScene = async (scene: Scene) => {
    if (!folder) throw new Error('NO_FOLDER');
    await saveRecord(hostIO, folder, SCENES_DIR, scene);
  };

  const savePiece = async (piece: Piece): Promise<boolean> => {
    if (!folder) return false;
    try {
      await saveRecord(hostIO, folder, PIECES_DIR, piece);
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  };

  const changeSettings = async (next: StudioSettings) => {
    setSettings(next);
    if (!folder) return;
    try {
      await saveSettings(hostIO, folder, next);
    } catch (err) {
      console.error('[vitrine-studio] settings not saved:', err);
      if (alive.current) setNotice({ kind: 'error', text: t('settings.notSaved') });
    }
  };

  /** True once the file is written; a refusal is shown on the screen and answers false. */
  const saveSite = async (next: SiteSettings): Promise<boolean> => {
    siteRef.current = next;
    setSite(next);
    if (!folder) return false;
    try {
      await saveStudioJson(hostIO, folder, SITE_FILE, next);
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  };

  /**
   * Changes PART of the site's settings, applied to the file as it is NOW:
   * after an export of several minutes, or from the preview window opened
   * long ago, the settings of the render that started the gesture are stale
   * (the measured weight, a new logo, a corrected text would be written back
   * to their old values). One patch at a time; a file that cannot be read is
   * patched from what this window holds. Answers whether the file was written.
   */
  const sitePatches = useRef<Promise<boolean>>(Promise.resolve(true));
  const patchSite = (change: (current: SiteSettings) => SiteSettings): Promise<boolean> => {
    const run = async () => {
      let current = siteRef.current;
      if (folder) {
        try {
          const raw = await loadStudioJson(hostIO, folder, SITE_FILE);
          if (raw) current = normalizeSiteSettings(raw, '');
        } catch (err) {
          console.warn('[vitrine-studio] site.json not re-read before a change; patching what this window holds:', err);
        }
      }
      return alive.current ? saveSite(change(current)) : false;
    };
    sitePatches.current = sitePatches.current.then(run, run);
    return sitePatches.current;
  };

  return {
    alive, folder, chooseFolder, notice, setNotice, fail, loaded, load, refresh,
    pieces, setPieces, replacePiece, savePiece,
    scenes, setScenes, scenesRef, replaceScene, saveScene, piecesRef,
    settings, changeSettings, unreadable,
    site, siteRef, setSite, saveSite, patchSite, markets,
    films, filmsRef, film, filmId, setFilmId, putFilm, dropFilm,
    costs, setCosts, costsReadable,
  };
}

export type Studio = ReturnType<typeof useStudio>;
