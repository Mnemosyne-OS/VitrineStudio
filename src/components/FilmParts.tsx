import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, RotateCcw, Square } from 'lucide-react';
import { getLanguage, useI18n } from '../i18n';
import { MIN_PART_SECONDS, type Cut, type Film } from '../model/filmRecord';
import type { FilmStep } from '../model/film';

/** Veo makes 24 images a second: one step of the arrows is one image. */
const FRAME = 1 / 24;

const secs = (n: number) => n.toLocaleString(getLanguage(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The parts that have their clip, in the order of the chain. */
const partsOf = (film: Film, steps: FilmStep[]) => steps.slice(1).filter((s) => film.clips[s.id]);

/**
 * The clips of the film, part by part: each one played where it is cut, its
 * start and its end set on the image the person stops on. Nothing is
 * re-encoded: the site plays each clip between its two points. The part
 * shown (`chosen`) and the clips (`srcs`) are the Film tab's, because the
 * joins of that part are drawn in its other column.
 */
export function FilmParts({ film, steps, chosen, onChoose, srcs, error, onCut }: {
  film: Film;
  steps: FilmStep[];
  chosen: string | null;
  onChoose: (stepId: string) => void;
  srcs: Record<string, string>;
  error: string | null;
  /** Sets one part's cut, or takes it off (`null`), with the clip's length. */
  onCut: (stepId: string, cut: Cut | null, duration: number) => void;
}) {
  const { t } = useI18n();
  const lang = getLanguage();
  const parts = partsOf(film, steps);
  const part = parts.find((s) => s.id === chosen) ?? parts[0];
  if (!part) return null;
  const index = steps.findIndex((s) => s.id === part.id);
  const src = srcs[film.clips[part.id]!];

  return (
    <div className="film-parts">
      <div className="idea-row compact">
        {parts.map((s) => {
          const i = steps.findIndex((x) => x.id === s.id);
          return (
            <button key={s.id} className={`chip-tile glass ${s.id === part.id ? 'chosen' : ''}`} onClick={() => onChoose(s.id)}>
              <strong>{i} → {i + 1}</strong>
              <span className="muted small">{s.label[lang]}{film.cuts[s.id] ? ' · ✂' : ''}</span>
            </button>
          );
        })}
      </div>
      {src
        ? <PartEditor key={part.id} src={src} cut={film.cuts[part.id]} label={`${index} → ${index + 1}`} onCut={(cut, d) => onCut(part.id, cut, d)} />
        : <p className="muted small"><span className="spinner small-spin" aria-hidden /> {t('film.parts.loading')}</p>}
      {error && <p className="error small">{error}</p>}
    </div>
  );
}

/** The joins of the part shown: the end of the part before beside its start, and its end beside the next one's start. */
export function FilmJoins({ film, steps, chosen, srcs }: { film: Film; steps: FilmStep[]; chosen: string | null; srcs: Record<string, string> }) {
  const { t } = useI18n();
  const parts = partsOf(film, steps);
  const part = parts.find((s) => s.id === chosen) ?? parts[0];
  if (!part) return null;
  const prev = parts[parts.indexOf(part) - 1];
  const next = parts[parts.indexOf(part) + 1];
  const srcOf = (s: FilmStep | undefined) => (s ? srcs[film.clips[s.id]!] : undefined);
  return (
    <div className="film-joins">
      {prev && <Join title={t('film.parts.joinIn')} before={srcOf(prev)} beforeAt={film.cuts[prev.id]?.out ?? 'end'} after={srcOf(part)} afterAt={film.cuts[part.id]?.in ?? 0} />}
      {next && <Join title={t('film.parts.joinOut')} before={srcOf(part)} beforeAt={film.cuts[part.id]?.out ?? 'end'} after={srcOf(next)} afterAt={film.cuts[next.id]?.in ?? 0} />}
    </div>
  );
}

/** One clip: the player, the kept span on a timeline, and its start and end set on the current image. */
export function PartEditor({ src, cut, label, onCut }: { src: string; cut?: Cut; label: string; onCut: (cut: Cut | null, duration: number) => void }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const span: Cut = { in: cut?.in ?? 0, out: cut?.out ?? duration ?? 0 };
  // Playing the part stops at its end, frame by frame where the browser can.
  const stopAt = useRef<number | null>(null);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let frame = 0;
    const check = () => {
      if (stopAt.current !== null && v.currentTime >= stopAt.current - 0.02) {
        v.pause();
        v.currentTime = stopAt.current;
        stopAt.current = null;
      }
    };
    const tick = () => {
      setNow(v.currentTime);
      check();
      if (!v.paused) frame = requestAnimationFrame(tick);
    };
    const onPlay = () => { setPlaying(true); frame = requestAnimationFrame(tick); };
    const onPause = () => { setPlaying(false); cancelAnimationFrame(frame); setNow(v.currentTime); };
    const onSeek = () => setNow(v.currentTime);
    // Frames can be held back (a window in the background): the time updates still stop the part.
    v.addEventListener('timeupdate', check);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('seeked', onSeek);
    return () => {
      cancelAnimationFrame(frame);
      v.removeEventListener('timeupdate', check);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('seeked', onSeek);
    };
  }, []);

  const seek = (s: number) => {
    const v = video.current;
    if (!v || duration === null) return;
    v.pause();
    v.currentTime = Math.max(0, Math.min(duration, s));
  };
  const playPart = () => {
    const v = video.current;
    if (!v) return;
    if (playing) { v.pause(); return; }
    stopAt.current = span.out;
    v.currentTime = span.in;
    v.play().catch((err: unknown) => console.warn('[vitrine-studio] the part did not play:', err));
  };
  const set = (side: 'in' | 'out') => {
    if (duration === null) return;
    const next = side === 'in' ? { in: Math.min(now, span.out - MIN_PART_SECONDS), out: span.out } : { in: span.in, out: Math.max(now, span.in + MIN_PART_SECONDS) };
    onCut({ in: Math.max(0, next.in), out: Math.min(duration, next.out) }, duration);
  };
  const pct = (s: number) => `${duration ? (s / duration) * 100 : 0}%`;

  return (
    <div className="part-editor">
      <video ref={video} src={src} muted playsInline preload="auto" className="part-video"
        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); e.currentTarget.currentTime = cut?.in ?? 0; }} />
      <div className="part-timeline" role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={duration ?? 0} aria-valuenow={now} tabIndex={0}
        onPointerDown={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const at = (x: number) => seek(((x - box.left) / box.width) * (duration ?? 0));
          at(e.clientX);
          const move = (ev: PointerEvent) => at(ev.clientX);
          const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); seek(now - FRAME); }
          if (e.key === 'ArrowRight') { e.preventDefault(); seek(now + FRAME); }
        }}>
        <span className="part-kept" style={{ left: pct(span.in), width: `calc(${pct(span.out)} - ${pct(span.in)})` }} />
        <span className="part-head" style={{ left: pct(now) }} />
      </div>
      <div className="row part-controls">
        <button onClick={() => seek(now - FRAME)} aria-label={t('film.parts.prevFrame')} title={t('film.parts.prevFrame')}><ChevronLeft className="ico solo" aria-hidden /></button>
        <button onClick={() => seek(now + FRAME)} aria-label={t('film.parts.nextFrame')} title={t('film.parts.nextFrame')}><ChevronRight className="ico solo" aria-hidden /></button>
        <span className="small part-time">{secs(now)} s</span>
        <button disabled={duration === null} onClick={() => set('in')}>{t('film.parts.setIn')}</button>
        <button disabled={duration === null} onClick={() => set('out')}>{t('film.parts.setOut')}</button>
        <button className="primary" disabled={duration === null} onClick={playPart}>
          {playing ? <Square className="ico" aria-hidden /> : <Play className="ico" aria-hidden />}{t(playing ? 'film.parts.stop' : 'film.parts.play')}
        </button>
        {cut && duration !== null && <button className="link" onClick={() => onCut(null, duration)}><RotateCcw className="ico" aria-hidden />{t('film.parts.whole')}</button>}
      </div>
      {duration !== null && <p className="small muted">{t('film.parts.span', { from: secs(span.in), to: secs(span.out), len: secs(span.out - span.in) })}</p>}
    </div>
  );
}

/** A join: the last image of one part beside the first image of the next. */
function Join({ title, before, beforeAt, after, afterAt }: { title: string; before?: string; beforeAt: number | 'end'; after?: string; afterAt: number }) {
  return (
    <figure className="film-join">
      <div className="film-join-frames">
        <Still src={before} at={beforeAt} />
        <Still src={after} at={afterAt} />
      </div>
      <figcaption className="small muted">{title}</figcaption>
    </figure>
  );
}

/** One image of a clip, held still. */
function Still({ src, at }: { src?: string; at: number | 'end' }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    const place = () => { v.currentTime = at === 'end' ? Math.max(0, v.duration - FRAME) : at; };
    if (v.readyState >= 1) place();
    else v.addEventListener('loadedmetadata', place, { once: true });
    return () => v.removeEventListener('loadedmetadata', place);
  }, [src, at]);
  return src ? <video ref={ref} src={src} muted playsInline preload="auto" className="film-still" /> : <div className="film-still" />;
}
