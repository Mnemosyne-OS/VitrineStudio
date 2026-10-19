import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, History, Image as ImageIcon, RotateCcw, Scissors, Trash2, Video } from 'lucide-react';
import { useI18n, getLanguage } from '../i18n';
import { BEATS, type Beat, type Piece, type Scene } from '../model/types';
import type { TradeProfile } from '../model/profiles';
import { pieceEvolution, type PieceEvolution, type Version } from '../model/evolution';
import { Thumb } from './Thumb';
import { useArmed } from '../hooks/useArmed';
import { readImage } from '../data/host';

/** A picture read only once it comes near the screen: a piece with ten scenes keeps a hundred versions. */
function LazyThumb({ path, alt }: { path: string; alt: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (seen || !box.current) return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setSeen(true); }, { rootMargin: '200px' });
    io.observe(box.current);
    return () => io.disconnect();
  }, [seen]);
  return <span ref={box} className="evo-pic">{seen ? <Thumb path={path} alt={alt} /> : <span className="thumb thumb-loading" />}</span>;
}

/** What a picked version is: where it lives and what can be done with it. */
interface Picked { version: Version; scene?: Scene; beat?: Beat | 'clip'; label: string }

/** The pick read again in today's lists (a version put back is no longer the same one); null once it is gone. */
function followPick(picked: Picked | null, ev: PieceEvolution): Picked | null {
  if (!picked || !picked.scene) return picked;
  const s = ev.scenes.find((x) => x.scene.id === picked.scene!.id);
  if (!s) return null;
  const list = picked.beat === 'clip' ? s.clips : s.beats[picked.beat as Beat] ?? [];
  const version = list.find((x) => x.path === picked.version.path);
  return version ? { ...picked, scene: s.scene, version } : null;
}

export interface EvolutionActions {
  /** Opens the scene full screen on this picture. */
  onOpenScene: (scene: Scene, beat: Beat) => void;
  /** Puts a kept version back in use (the one in use becomes kept). */
  onChooseTake: (scene: Scene, beat: Beat | 'clip', path: string) => void;
  /** Deletes a kept version and its file, unless something else shows it. */
  onDeleteTake: (scene: Scene, beat: Beat | 'clip', path: string) => void;
}

/**
 * Every picture of one piece, over time (Tony: « le suivi des évolutions des
 * images par produit, link produit »): her photos, then each scene, each step
 * as a line from the oldest version to the one in use. A version picked shows
 * large beside the lines, with what can be done with it (open its scene, put
 * it back, delete it). Opened from the piece's tile and from a scene's panel.
 */
export function EvolutionView({ piece, scenes, profileOf, busy, onClose, actions }: {
  piece: Piece;
  scenes: Scene[];
  profileOf: (scene: Scene) => TradeProfile;
  /** A picture or clip being made: versions are not swapped under it. */
  busy: (scene: Scene) => boolean;
  onClose: () => void;
  actions: EvolutionActions;
}) {
  const { t, tc } = useI18n();
  const lang = getLanguage();
  const ev = useMemo(() => pieceEvolution(piece, scenes), [piece, scenes]);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [big, setBig] = useState<{ path: string; src?: string; error?: boolean } | null>(null);
  const { armed, confirm } = useArmed();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The picked version, read large (a clip shows its icon: it plays in its scene).
  const pickedPath = picked && picked.beat !== 'clip' ? picked.version.path : null;
  useEffect(() => {
    if (!pickedPath) { setBig(null); return; }
    let alive = true;
    setBig({ path: pickedPath });
    readImage(pickedPath).then(
      (src) => alive && setBig({ path: pickedPath, src }),
      (err: unknown) => { console.warn('[vitrine-studio] a version could not be read:', err); if (alive) setBig({ path: pickedPath, error: true }); },
    );
    return () => { alive = false; };
  }, [pickedPath]);

  // A version put back or deleted changes the lists: the pick follows its path, or leaves.
  const live = followPick(picked, ev);

  const when = (v: Version) => (v.at ? v.at.toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);
  const pick = (p: Picked) => setPicked((cur) => (cur && cur.version.path === p.version.path ? null : p));

  const row = (versions: Version[], label: string, scene?: Scene, beat?: Beat | 'clip') => (
    <div className="evo-line" role="group" aria-label={label}>
      {versions.map((v, i) => {
        const on = live?.version.path === v.path;
        const date = when(v);
        const tip = [v.current ? t('evolution.current') : v.cutout ? t('evolution.cutout') : t('evolution.kept'), date].filter(Boolean).join(' · ');
        return (
          <button key={v.path} className={`evo-version ${v.current ? 'current' : ''} ${on ? 'picked' : ''}`} data-tip={tip} aria-label={`${label} · ${tip}`}
            aria-pressed={on} onClick={() => pick({ version: v, ...(scene ? { scene } : {}), ...(beat ? { beat } : {}), label })}>
            {beat === 'clip' ? <span className="evo-pic evo-clip"><Video className="ico" aria-hidden /><small>{i + 1}</small></span> : <LazyThumb path={v.path} alt="" />}
            {v.cutout && <span className="evo-badge" aria-hidden><Scissors className="ico" /></span>}
            {v.current && <span className="evo-badge now" aria-hidden>✓</span>}
          </button>
        );
      })}
    </div>
  );

  const pickedBusy = live?.scene ? busy(live.scene) : false;

  return (
    <div className="lightbox evolution" role="dialog" aria-modal="true" aria-label={t('evolution.title', { name: piece.name })} onClick={onClose}>
      <div className="evo-main" onClick={(e) => e.stopPropagation()}>
        <header className="evo-head glass">
          <span className="evo-head-pic"><Thumb path={piece.photoPath} alt="" empty="" /></span>
          <span className="evo-head-text">
            <strong>{piece.name}</strong>
            <span className="muted small"><History className="ico" aria-hidden /> {tc('evolution.count', ev.count)} · {tc('evolution.scenes', ev.scenes.length)}</span>
          </span>
        </header>

        {ev.photos.length > 0 && (
          <section className="evo-scene glass">
            <h3><ImageIcon className="ico" aria-hidden />{t('evolution.photos')}</h3>
            {row(ev.photos, t('evolution.photos'))}
          </section>
        )}
        {ev.scenes.map(({ scene, beats, clips }) => {
          const profile = profileOf(scene);
          const name = [scene.universe, scene.variant].filter(Boolean).join(' · ') || t('scenes.noVariant');
          const first = BEATS.find((b) => scene.images[b]);
          return (
            <section key={scene.id} className="evo-scene glass">
              <h3>
                <span>{name}</span>
                {scene.validated && <span className="evo-online" data-tip={t('scenes.onSite')} aria-label={t('scenes.onSite')} />}
                {first && (
                  <button className="tool" aria-label={t('evolution.openScene')} data-tip={t('evolution.openScene')} onClick={() => actions.onOpenScene(scene, first)}>
                    <ArrowUpRight className="ico" aria-hidden />
                  </button>
                )}
              </h3>
              {BEATS.map((b) => beats[b] && (
                <div key={b} className="evo-beat">
                  <span className="evo-label">{profile.beats[b][lang]}</span>
                  {row(beats[b], `${name} · ${profile.beats[b][lang]}`, scene, b)}
                </div>
              ))}
              {clips.length > 0 && (
                <div className="evo-beat">
                  <span className="evo-label">{t('studio.video')}</span>
                  {row(clips, `${name} · ${t('studio.video')}`, scene, 'clip')}
                </div>
              )}
            </section>
          );
        })}
        {ev.scenes.length === 0 && <p className="muted evo-empty">{t('evolution.noScene')}</p>}
      </div>

      <aside className="evo-side glass" onClick={(e) => e.stopPropagation()} aria-live="polite">
        {!live && <p className="muted evo-hint"><History className="ico" aria-hidden />{t('evolution.pick')}</p>}
        {live && (
          <>
            <div className="evo-big">
              {live.beat === 'clip'
                ? <span className="evo-big-clip"><Video className="ico" aria-hidden /></span>
                : big?.error ? <p className="error small">{t('thumb.unreadable')}</p>
                : big?.src ? <img src={big.src} alt={live.label} />
                : <span className="spinner" aria-hidden />}
            </div>
            <p className="evo-big-label">
              <strong>{live.label}</strong>
              <span className="muted small">{[live.version.current ? t('evolution.current') : live.version.cutout ? t('evolution.cutout') : t('evolution.kept'), when(live.version) ?? t('evolution.noDate')].join(' · ')}</span>
            </p>
            {live.scene && (
              <div className="studio-tools" role="toolbar" aria-label={live.label}>
                {live.beat !== 'clip' && (
                  <button className="tool" aria-label={t('evolution.openScene')} data-tip={t('evolution.openScene')} onClick={() => actions.onOpenScene(live.scene!, live.beat as Beat)}>
                    <ArrowUpRight className="ico" aria-hidden />
                  </button>
                )}
                {!live.version.current && (
                  <>
                    <button className="tool" disabled={pickedBusy} aria-label={t('studio.versionUse')} data-tip={t('studio.versionUse')}
                      onClick={() => actions.onChooseTake(live.scene!, live.beat!, live.version.path)}>
                      <RotateCcw className="ico" aria-hidden />
                    </button>
                    <button className={`tool tool-danger ${armed === live.version.path ? 'armed' : ''}`} disabled={pickedBusy}
                      aria-label={t('studio.versionDelete')} data-tip={armed === live.version.path ? t('studio.confirm') : t('studio.versionDelete')}
                      onClick={() => confirm(live.version.path, () => { actions.onDeleteTake(live.scene!, live.beat!, live.version.path); setPicked(null); })}>
                      <Trash2 className="ico" aria-hidden />
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </aside>

      <button className="lightbox-close glass" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label={t('wizard.close')} data-tip={t('wizard.close')}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 4l10 10M14 4L4 14" /></svg>
      </button>
    </div>
  );
}
