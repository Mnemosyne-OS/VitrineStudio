import { Maximize2, ScanSearch, Settings } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getLanguage, useI18n } from '../i18n';
import { openImageSettings, readImage, upscaleImage, upscaleStatus, type UpscaleState } from '../data/host';
import { upscaleJobs, withEnlarged, type UpscaleJob } from '../data/upscale';
import { UpscaleCompare } from './UpscaleCompare';
import { UPSCALE_SCALES, type Scene, type UpscaleScale } from '../model/types';
import { describeError, errorText } from './errors';
import { ClipClock } from './ClipClock';
import { baseName } from '../data/folderStore';

type Phase =
  | { kind: 'idle' }
  | { kind: 'trying'; startedAt: string }
  | { kind: 'tried'; job: UpscaleJob; path: string; before: string; after: string }
  | { kind: 'running'; done: number; total: number; startedAt: string };

/**
 * Enlarging the pictures already made, on this machine (doc 88). The three
 * states the host can be in are each SAID: no image engine, no upscaler yet
 * (both installed in Mnemosyne's Settings > Images, where the download has
 * its real bar, never from here), ready (how many pictures, at which width).
 * Coming back to this window checks again, so an install made meanwhile shows.
 *
 * One picture is tried FIRST and shown before/after (Tony: « faudrait faire
 * un test avant d'envoyer 50 images »). Nothing is recorded until the person
 * keeps it; the tried file stays beside its source, and the batch adopts it.
 */
export function UpscaleCard({ scenes, getScenes, scale, onScale, onEnlarged }: {
  scenes: Scene[];
  /** The scenes as they are NOW: the loop saves one picture after another. */
  getScenes: () => Scene[];
  scale: UpscaleScale;
  onScale: (s: UpscaleScale) => void;
  onEnlarged: (scene: Scene) => Promise<void>;
}) {
  const { t, tc } = useI18n();
  const [state, setState] = useState<UpscaleState | null>(null);
  const [stateError, setStateError] = useState<{ key: string; raw?: string } | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [errors, setErrors] = useState<string[]>([]);
  const stop = useRef(false);
  const alive = useRef(true);
  const checking = useRef(false);
  // Leaving the card stops the batch after the picture in flight (one can take minutes).
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, []);

  const check = useCallback(async () => {
    // The poll, the focus and the button may ask together: one question at a time.
    if (checking.current) return;
    checking.current = true;
    setStateError(null);
    try {
      const next = await upscaleStatus();
      if (alive.current) setState(next);
    } catch (err) {
      if (alive.current) setStateError(describeError(err));
    } finally {
      checking.current = false;
    }
  }, []);
  useEffect(() => {
    void check();
    // The install happens in another window: coming back here checks again.
    const onFocus = () => { void check(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [check]);

  // Not installed yet: the install happens in Settings, often open right beside
  // this window, so no focus change ever tells us. Ask again every few seconds,
  // and only while something is missing.
  const missing = !!state && (!state.engine || !state.weights);
  useEffect(() => {
    if (!missing) return;
    const timer = setInterval(() => { void check(); }, 3_000);
    return () => clearInterval(timer);
  }, [missing, check]);

  const jobs = upscaleJobs(scenes, scale);
  const times = `×${scale.toLocaleString(getLanguage())}`;

  // A host from before the link answers with a refusal: it is said, never swallowed.
  const openSettings = async () => {
    try {
      await openImageSettings();
    } catch (err) {
      const e = describeError(err);
      setErrors([`${errorText(e)}`]);
    }
  };
  const busy = phase.kind === 'running' || phase.kind === 'trying';

  /** Records one enlargement into its scene, if the scene still holds that picture. */
  const keep = async (job: UpscaleJob, path: string) => {
    const scene = getScenes().find((s) => s.id === job.sceneId);
    // Removed or remade meanwhile: the enlargement no longer belongs to anything.
    if (scene && (scene.images[job.beat] === job.from || scene.enlarged?.[job.beat]?.from === job.from)) {
      await onEnlarged(withEnlarged(scene, job, path, scale, new Date().toISOString()));
    }
  };

  /** One picture, shown before and after; nothing recorded yet. */
  const tryOne = async () => {
    const job = upscaleJobs(getScenes(), scale)[0];
    if (!job) return;
    setErrors([]);
    setPhase({ kind: 'trying', startedAt: new Date().toISOString() });
    try {
      const res = await upscaleImage(job.from, scale);
      const [before, after] = await Promise.all([readImage(job.from), readImage(res.path)]);
      if (!alive.current) return;
      setPhase({ kind: 'tried', job, path: res.path, before, after });
    } catch (err) {
      const e = describeError(err);
      if (!alive.current) return;
      setErrors([`${baseName(job.from)}: ${errorText(e)}`]);
      setPhase({ kind: 'idle' });
    }
  };

  const run = async () => {
    const todo = upscaleJobs(getScenes(), scale);
    stop.current = false;
    setErrors([]);
    const startedAt = new Date().toISOString();
    setPhase({ kind: 'running', done: 0, total: todo.length, startedAt });
    const failed: string[] = [];
    for (let i = 0; i < todo.length; i++) {
      if (stop.current) break;
      const job = todo[i]!;
      try {
        const res = await upscaleImage(job.from, scale);
        await keep(job, res.path);
      } catch (err) {
        const e = describeError(err);
        failed.push(`${baseName(job.from)}: ${errorText(e)}`);
      }
      if (alive.current) setPhase({ kind: 'running', done: i + 1, total: todo.length, startedAt });
    }
    if (!alive.current) return;
    setErrors(failed);
    setPhase({ kind: 'idle' });
  };

  return (
    <div className="glass card-pad full upscale-card">
      <h3>{t('upscale.title')}</h3>
      <div className="idea-row">
        {UPSCALE_SCALES.map((s) => (
          <button key={s} disabled={busy} className={`chip-tile glass ${scale === s ? 'chosen' : ''}`} onClick={() => onScale(s)}>
            <strong>×{s.toLocaleString(getLanguage())}</strong>
            <span className="muted small">{t(`upscale.scaleHint.${String(s).replace('.', '_')}`)}</span>
          </button>
        ))}
      </div>

      {stateError && <p className="error small">{errorText(stateError)} <button className="link" onClick={() => void check()}>{t('upscale.recheck')}</button></p>}
      {!state && !stateError && <p className="muted small"><span className="spinner small-spin" aria-hidden /> {t('upscale.checking')}</p>}

      {state && !state.engine && (
        <p className="warn small">{t('upscale.noEngine')} <button className="link" onClick={() => void check()}>{t('upscale.recheck')}</button></p>
      )}

      {state && (!state.engine || !state.weights) && (
        <div className="upscale-row">
          <button className="primary" onClick={() => void openSettings()}><Settings className="ico" aria-hidden />{t('upscale.openSettings')}</button>
          <button className="link" onClick={() => void check()}>{t('upscale.recheck')}</button>
        </div>
      )}
      {state?.engine && !state.weights && (
        <p className="muted small">{t('upscale.notInstalled', { size: Math.round(state.downloadBytes / 1_000_000) })}</p>
      )}

      {state?.engine && state.weights && (
        phase.kind === 'running' ? (
          <div className="upscale-row">
            <ClipClock startedAt={phase.startedAt} label="upscale.running" values={{ done: phase.done, total: phase.total }} />
            <button onClick={() => { stop.current = true; }}>{t('upscale.stop')}</button>
          </div>
        ) : phase.kind === 'trying' ? (
          <ClipClock startedAt={phase.startedAt} label="upscale.trying" />
        ) : phase.kind === 'tried' ? (
          <div className="upscale-trial">
            <UpscaleCompare before={phase.before} after={phase.after} />
            <div className="upscale-row">
              <button className="primary" onClick={() => void (async () => { await keep(phase.job, phase.path); await run(); })()}><Maximize2 className="ico" aria-hidden />{tc('upscale.keepAll', jobs.length, { scale: times })}</button>
              <button onClick={() => void (async () => { await keep(phase.job, phase.path); setPhase({ kind: 'idle' }); })()}>{t('upscale.keepOne')}</button>
              <button className="link" onClick={() => setPhase({ kind: 'idle' })}>{t('upscale.cancelTrial')}</button>
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <p className="small ok-line">✓ {t('upscale.allDone', { scale: times })}</p>
        ) : (
          <div className="upscale-row">
            <button className="primary" onClick={() => void tryOne()}><ScanSearch className="ico" aria-hidden />{t('upscale.try')}</button>
            <button onClick={() => void run()}><Maximize2 className="ico" aria-hidden />{tc('upscale.run', jobs.length, { scale: times })}</button>
          </div>
        )
      )}

      {errors.length > 0 && (
        <ul className="error small upscale-errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
    </div>
  );
}
