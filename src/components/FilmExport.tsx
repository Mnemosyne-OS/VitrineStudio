import { useCallback, useEffect, useRef, useState } from 'react';
import { Film as FilmIcon, Settings } from 'lucide-react';
import { useI18n } from '../i18n';
import { joinFilm, openVideoSettings, videoToolsStatus, type VideoToolsState } from '../data/host';
import { baseName, joinPath } from '../data/folderStore';
import type { Film } from '../model/filmRecord';
import type { FilmStep } from '../model/film';
import { filmFileStem, filmParts } from '../model/filmExport';
import { ClipClock } from './ClipClock';
import { describeError, errorText } from './errors';

const ENCODERS = ['h264_nvenc', 'h264_qsv', 'h264_amf', 'h264_mf', 'libvpx-vp9'];

/**
 * The film as ONE file (Instagram, YouTube): its parts joined where they are
 * cut, by ffmpeg on this machine. ffmpeg is installed in Mnemosyne's Settings
 * > Video, never from here; the card opens that page and notices the install.
 */
export function FilmExport({ film, steps, folder }: { film: Film; steps: FilmStep[]; folder: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<VideoToolsState | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [done, setDone] = useState<{ path: string; encoder: string; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const check = useCallback(async () => {
    try {
      const s = await videoToolsStatus();
      if (alive.current) setState(s);
    } catch (err) {
      if (alive.current) setError(errorText(describeError(err)));
    }
  }, []);
  useEffect(() => {
    void check();
    const onFocus = () => { void check(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [check]);
  // The install happens in Settings, often beside this window: asked again while it is missing.
  const missing = !!state && state.supported && !state.installed;
  useEffect(() => {
    if (!missing) return;
    const id = setInterval(() => { void check(); }, 3_000);
    return () => clearInterval(id);
  }, [missing, check]);

  const run = async () => {
    setError(null);
    setDone(null);
    setStartedAt(new Date().toISOString());
    try {
      const res = await joinFilm(filmParts(film, steps), joinPath(folder, 'film', filmFileStem(new Date())));
      if (alive.current) setDone(res);
    } catch (err) {
      console.warn('[vitrine-studio] the film was not joined:', err);
      if (alive.current) setError(errorText(describeError(err)));
    } finally {
      if (alive.current) setStartedAt(null);
    }
  };

  const openSettings = async () => {
    try {
      await openVideoSettings();
    } catch (err) {
      setError(errorText(describeError(err)));
    }
  };

  return (
    <div className="film-export">
      {!state && !error && <p className="muted small"><span className="spinner small-spin" aria-hidden /> {t('film.export.checking')}</p>}
      {state && !state.supported && <p className="muted small">{t('film.export.unsupported')}</p>}
      {missing && (
        <div className="row">
          <button className="primary" onClick={() => void openSettings()}><Settings className="ico" aria-hidden />{t('film.export.openSettings')}</button>
          <button className="link" onClick={() => void check()}>{t('upscale.recheck')}</button>
        </div>
      )}
      {state?.installed && (startedAt
        ? <ClipClock startedAt={startedAt} label="film.export.running" />
        : <button className="primary" onClick={() => void run()}><FilmIcon className="ico" aria-hidden />{t('film.export.run')}</button>)}
      {done && (
        <p className="small ok-line">
          ✓ {t('film.export.done', { file: `film/${baseName(done.path)}`, seconds: done.seconds.toLocaleString() })}
          {' · '}{ENCODERS.includes(done.encoder) ? t(`film.export.encoder.${done.encoder.replace(/-/g, '_')}`) : done.encoder}
        </p>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
