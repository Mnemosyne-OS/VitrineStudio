import { Check, Eye, EyeOff, Maximize2, Play, Plus, Settings, Square, Video } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { readMedia } from '../data/host';
import { errorText } from './errors';
import { useI18n, getLanguage } from '../i18n';
import { BEATS, type Beat, type Piece, type PromptKey, type Scene } from '../model/types';
import { clipPrompt, ENHANCE_PLACE_PROMPT, promptsFor, type TradeProfile } from '../model/profiles';
import { PromptEditor } from './PromptEditor';
import { ClipMaking, PictureMaking } from './ClipMaking';
import { useArmed } from '../hooks/useArmed';
import { nextBeat } from '../model/records';
import { Thumb } from './Thumb';
import { CategoryDock } from './CategoryDock';
import { SceneMapSettings } from './SceneMapSettings';
import type { SceneMap } from '../model/sceneMap';
import { moveId } from '../model/showcase';

const SCENE_DRAG = 'application/x-atelier-scene';
import { estimateImage, formatUsd, totalOf, type CostEntry } from '../model/costs';

export interface NewSceneInput {
  pieceId: string;
  universe: string;
  variant: string;
  placeDescription: string;
  /** The person's own photo of the place, used as the first picture instead of generating one. */
  placePhotoPath?: string;
  /** Make that photo more appealing (an edit, one picture spent) instead of taking it exactly. */
  enhancePlace?: boolean;
  animation: string;
  animationRefPath?: string;
  aspectRatio: string;
}

export interface SceneWork {
  /** The beat being made right now, if any. */
  making?: Beat;
  /** A clip is being started or followed. */
  clipping?: boolean;
  /** The scene's layers being made (doc 145 §10.18): which step. */
  layering?: import('../data/sceneLayersMake').LayerStep;
  /** When the layers began: the clock over the stage counts from it. */
  layeringAt?: string;
  /** The last refusal for this scene: an i18n key and, for an unknown one, the raw message. */
  error?: { key: string; raw?: string };
}

interface Props {
  scenes: Scene[];
  pieces: Piece[];
  /** The trade each scene was made under (its beats are named by it). */
  profileOf: (scene: Scene) => TradeProfile;
  work: Record<string, SceneWork>;
  onNew: () => void;
  onMakeAll: (scene: Scene) => void;
  onValidate: (scene: Scene, validated: boolean) => void;
  /** Files the scene under another place; `''` = no place. */
  onMove: (scene: Scene, universe: string) => void;
  /** The scenes' new order, every id. */
  onReorder: (ids: string[]) => void;
  /** The site's little map of the places: its model and colour. */
  sceneMap: SceneMap;
  onSceneMap: (next: SceneMap) => void;
  /** Opens the scene full screen on this beat. */
  onOpen: (scene: Scene, beat: Beat) => void;
  /** Asks how the scene leaves the studio (archive or delete for good). */
  onRemove: (scene: Scene) => void;
  /** The project's spending, when the person chose to see it on the cards; null hides it. */
  costs: CostEntry[] | null;
  /** The model the next pictures use, for the estimate on the button. */
  imageModel: string;
}

/** The last beat that exists: what a scene looks like today. */
function latest(scene: Scene): Beat | null {
  return [...BEATS].reverse().find((b) => scene.images[b]) ?? null;
}

type CardSize = 's' | 'm' | 'l';

/** The grid density as a file browser shows it: many small squares, four, one large. */
function SizeIcon({ size }: { size: CardSize }) {
  const n = size === 's' ? 3 : size === 'm' ? 2 : 1;
  const gap = 1.6;
  const cell = (16 - gap * (n - 1)) / n;
  const rects = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) rects.push(<rect key={`${r}-${c}`} x={1 + c * (cell + gap)} y={1 + r * (cell + gap)} width={cell} height={cell} rx={n === 1 ? 2.5 : 1.2} />);
  return <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor" aria-hidden>{rects}</svg>;
}
const SIZES: CardSize[] = ['s', 'm', 'l'];
const VIEW_KEY = 'artisan_studio_scenes_view';

/** The viewer's own way of looking (size, place shown): a convenience, never a record. */
function readView(): { size: CardSize; place: string | null } {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null') as { size?: unknown; place?: unknown } | null;
    return { size: SIZES.includes(v?.size as CardSize) ? (v!.size as CardSize) : 'm', place: typeof v?.place === 'string' ? v.place : null };
  } catch (err) {
    console.warn('[vitrine-studio] the scenes view could not be read:', err);
    return { size: 'm', place: null };
  }
}

export function ScenesPanel({ scenes, pieces, profileOf, work, onNew, onMakeAll, onValidate, onMove, onReorder, sceneMap, onSceneMap, onOpen, onRemove, costs, imageModel }: Props) {
  const { t } = useI18n();
  const all = [...new Set(scenes.map((s) => s.universe || t('scenes.noUniverse')))];
  const [view, setView] = useState(readView);
  const [mapOpen, setMapOpen] = useState(false);
  const change = (next: Partial<typeof view>) => {
    const v = { ...view, ...next };
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(v));
    } catch (err) {
      console.warn('[vitrine-studio] the scenes view could not be remembered:', err);
    }
  };
  // A place that no longer has scenes shows everything rather than nothing.
  const place = view.place && all.includes(view.place) ? view.place : null;
  const universes = place ? [place] : all;
  // The scene being dragged: a big square per place rises while it is held.
  const [dragging, setDragging] = useState<Scene | null>(null);
  const [filed, setFiled] = useState<{ name: string; at: number } | null>(null);
  // The filed line goes after a moment; leaving the panel cancels the timer.
  useEffect(() => {
    if (!filed) return;
    const id = setTimeout(() => setFiled(null), 1600);
    return () => clearTimeout(id);
  }, [filed]);
  const noPlace = t('scenes.noUniverse');
  const fileUnder = (u: string) => {
    const s = dragging;
    setDragging(null);
    if (!s) return;
    if ((s.universe || noPlace) !== u) onMove(s, u === noPlace ? '' : u);
    const at = Date.now();
    setFiled({ name: `${s.variant || u} → ${u}`, at });
  };

  return (
    <>
      {/* The big tile is the first-run invitation; afterwards the header button does the job. */}
      {scenes.length === 0 && (
        <section className="tiles">
          <button className="tile glass new-tile" onClick={onNew}>
            <span className="drop-icon" aria-hidden><Plus className="ico solo" /></span>
            <span className="drop-label">{t('scenes.new')}</span>
            <span className="drop-hint">{t('scenes.newHint')}</span>
          </button>
          <p className="muted empty-note">{t('scenes.none')}</p>
        </section>
      )}
      {scenes.length > 0 && (
        <div className="scenes-bar">
          <div className="idea-row" role="group" aria-label={t('scenes.filter')}>
            <button className={`chip-tile glass ${place === null ? 'chosen' : ''}`} onClick={() => change({ place: null })}>{t('scenes.allPlaces')} · {scenes.length}</button>
            {all.map((u) => (
              <button key={u} className={`chip-tile glass ${place === u ? 'chosen' : ''}`} onClick={() => change({ place: u })}>
                {u} · {scenes.filter((s) => (s.universe || t('scenes.noUniverse')) === u).length}
              </button>
            ))}
          </div>
          {/* After the places, what is done to them: a new one, and the page as the visitor sees it. */}
          <div className="scenes-actions">
            <button className="primary new-btn" onClick={onNew}><Plus className="ico" aria-hidden />{t('scenes.new')}</button>
            <button className={`icon-btn glass ${mapOpen ? 'on' : ''}`} aria-pressed={mapOpen} aria-label={t('sceneMap.title')} data-tip={t('sceneMap.title')} onClick={() => setMapOpen((o) => !o)}><Settings className="ico solo" aria-hidden /></button>
          </div>
          <nav className="segmented glass" aria-label={t('scenes.size')}>
            {SIZES.map((sz) => (
              <button key={sz} className={`icon-btn ${view.size === sz ? 'on' : ''}`} aria-pressed={view.size === sz} aria-label={t(`scenes.size.${sz}`)} title={t(`scenes.size.${sz}`)} onClick={() => change({ size: sz })}><SizeIcon size={sz} /></button>
            ))}
          </nav>
        </div>
      )}
      {mapOpen && scenes.length > 0 && <SceneMapSettings value={sceneMap} onChange={onSceneMap} />}
      <div className={`scenes-view size-${view.size}`}>
      {universes.map((u) => {
        const inPlace = scenes.filter((s) => (s.universe || t('scenes.noUniverse')) === u);
        // A place takes the width of its scenes: two small places share a row instead of one each.
        return (
        <section key={u} className="place" style={{ '--n': inPlace.length } as CSSProperties}>
          <h3 className="universe">{u}</h3>
          <div className="scene-grid">
            {inPlace.map((s) => (
              <SceneCard key={s.id} scene={s} piece={pieces.find((p) => p.id === s.pieceId)} profile={profileOf(s)} work={work[s.id] ?? {}}
                onMakeAll={onMakeAll} onValidate={onValidate} onOpen={onOpen} onRemove={onRemove} costs={costs} imageModel={imageModel}
                onDragging={(on) => setDragging(on ? s : null)}
                onPlace={(id, after) => {
                  const moved = scenes.find((x) => x.id === id);
                  setDragging(null);
                  if (!moved) return;
                  // Dropped on a scene of another place: it joins that place, next to it.
                  if ((moved.universe || noPlace) !== u) onMove(moved, u === noPlace ? '' : u);
                  onReorder(moveId(scenes.map((x) => x.id), id, s.id, after));
                }} />
            ))}
          </div>
        </section>
        );
      })}
      </div>
      <CategoryDock open={dragging !== null} categories={all.map((u) => ({ id: u, name: u }))} onDrop={(u) => fileUnder(u)}
        has={(u) => !!dragging && (dragging.universe || noPlace) === u} />
      {filed && <div className="cat-toast" key={filed.at}><Check className="ico" aria-hidden />{filed.name}</div>}
    </>
  );
}

function SceneCard({ scene, piece, profile, work, onMakeAll, onValidate, onOpen, onRemove, costs, imageModel, onDragging, onPlace }: {
  scene: Scene;
  piece: Piece | undefined;
  profile: TradeProfile;
  work: SceneWork;
  onMakeAll: Props['onMakeAll'];
  onValidate: Props['onValidate'];
  onOpen: Props['onOpen'];
  onRemove: Props['onRemove'];
  costs: CostEntry[] | null;
  imageModel: string;
  /** This card is being dragged, or no longer. */
  onDragging: (on: boolean) => void;
  /** Another scene dropped on this one: before it, or after. */
  onPlace: (id: string, after: boolean) => void;
}) {
  const { t, tc } = useI18n();
  const lang = getLanguage();
  const [moving, setMoving] = useState<'before' | 'after' | null>(null);
  // Making the pictures is paid: a second press confirms.
  const { armed, confirm } = useArmed();
  // The clip, read on the first play and played in the card itself.
  const [clip, setClip] = useState<{ path: string; src: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [clipError, setClipError] = useState(false);
  const [loadingClip, setLoadingClip] = useState(false);
  // Read once, as early as the pointer comes over the picture, and played from a blob:
  // a data: URL of several megabytes loads slowly and plays in slow motion.
  const loadClip = () => {
    const path = scene.clipPath;
    if (!path || loadingClip || clip?.path === path) return;
    setLoadingClip(true);
    readMedia(path)
      .then((data) => fetch(data))
      .then((r) => r.blob())
      .then(
        (blob) => setClip({ path, src: URL.createObjectURL(blob) }),
        (err: unknown) => { console.warn('[vitrine-studio] the clip could not be read:', err); setClipError(true); setPlaying(false); },
      )
      .finally(() => setLoadingClip(false));
  };
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.src); }, [clip]);
  // Without a clip, the play button runs the pictures one after the other, as the site does.
  const made = BEATS.filter((b) => scene.images[b]);
  const [slide, setSlide] = useState<number | null>(null);
  useEffect(() => {
    if (slide === null) return;
    const timer = setTimeout(() => setSlide((i) => (i !== null && i + 1 < made.length ? i + 1 : null)), slide + 1 < made.length ? 1400 : 1800);
    return () => clearTimeout(timer);
    // The pictures made are what matters, not the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, made.join()]);
  const canPlay = !!scene.clipPath || made.length > 1;
  const running = playing || slide !== null;
  const playClip = () => {
    if (running) { setPlaying(false); setSlide(null); return; }
    const path = scene.clipPath;
    if (!path) { setSlide(0); return; }
    setClipError(false);
    if (clip?.path === path) { setPlaying(true); return; }
    setPlaying(true);
    loadClip();
  };
  const sideOf = (e: React.DragEvent) => { const r = e.currentTarget.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? 'before' as const : 'after' as const; };
  const beat = latest(scene);
  const todo = nextBeat(scene);
  const spent = costs ? totalOf(costs, (e) => e.record === scene.id) : null;
  const toMake = BEATS.filter((b) => !scene.images[b]).length;
  const each = estimateImage(imageModel);

  return (
    <article onMouseEnter={loadClip} className={`scene-card glass ${playing && clip ? 'clip-running' : ''} ${scene.validated ? 'validated' : ''} ${work.making ? 'making' : ''} ${moving ? `move-${moving}` : ''}`} draggable
      onDragOver={(e) => { if (!e.dataTransfer.types.includes(SCENE_DRAG)) return; e.preventDefault(); setMoving(sideOf(e)); }}
      onDragLeave={() => setMoving(null)}
      onDrop={(e) => { const id = e.dataTransfer.getData(SCENE_DRAG); setMoving(null); if (!id) return; e.preventDefault(); if (id !== scene.id) onPlace(id, sideOf(e) === 'after'); }}
      onDragStart={(e) => { e.dataTransfer.setData(SCENE_DRAG, scene.id); e.dataTransfer.effectAllowed = 'copyMove'; onDragging(true); }}
      onDragEnd={() => onDragging(false)}>
      <div className="scene-media">
        {beat ? (
          <button className="media-open" onClick={() => onOpen(scene, beat)} title={t('lightbox.open')}>
            <Thumb path={scene.images[beat]} alt={`${profile.beats[beat][lang]} · ${scene.variant}`} />
            <span className="open-hint glass" aria-hidden><Maximize2 className="ico" aria-hidden />{t('lightbox.open')}</span>
          </button>
        ) : <div className="thumb thumb-empty">{t('scenes.notMadeYet')}</div>}
        {(scene.clipJob || work.clipping) && !work.making && <ClipMaking compact startedAt={scene.clipJob?.startedAt} />}
        {work.making && <PictureMaking compact beat={profile.beats[work.making][lang]} />}
        {/* On the site or not: the same eye as the pieces' tiles. A scene still being made has nothing to show yet. */}
        <button className={`tile-onpage ${scene.validated ? 'chosen' : ''}`} aria-pressed={!!scene.validated} disabled={!!todo || !!work.making}
          aria-label={t('scenes.onSite')} data-tip={todo ? t('scenes.onSiteNotMade') : t(scene.validated ? 'scenes.validated' : 'scenes.notOnSite')}
          onClick={() => onValidate(scene, !scene.validated)}>
          {scene.validated ? <Eye className="ico solo" aria-hidden /> : <EyeOff className="ico solo" aria-hidden />}
        </button>
        {/* Every picture stacked, each fading in over the last: read once, no blink between them. */}
        {slide !== null && (
          <div className="scene-slides" aria-hidden>
            {made.map((b, i) => <div key={b} className={`scene-slide ${i <= slide ? 'on' : ''}`}><Thumb path={scene.images[b]} alt="" /></div>)}
          </div>
        )}
        {playing && clip && (
          <video className="scene-clip" src={clip.src} autoPlay muted playsInline onEnded={() => setPlaying(false)}
            // Only the part she kept: from its start, and it stops at its end.
            onLoadedMetadata={(e) => { if (scene.clipCut) e.currentTarget.currentTime = scene.clipCut.in; }}
            onTimeUpdate={(e) => { if (scene.clipCut && e.currentTarget.currentTime >= scene.clipCut.out) setPlaying(false); }}
            onError={() => { setPlaying(false); setClipError(true); }} />
        )}
        {scene.clipPath && (
            <span className={`clip-mark ${clipError ? 'broken' : ''}`} data-tip={clipError ? t('clip.unreadable') : t('clip.badge')} aria-label={t('clip.badge')}><Video className="ico solo" aria-hidden /></span>
        )}
        {canPlay && !work.making && (
          <button className={`clip-play ${running ? 'on' : ''}`} aria-label={t(running ? 'clip.stop' : 'clip.play')} data-tip={t(running ? 'clip.stop' : 'clip.play')} onClick={playClip}>
            {playing && !clip ? <span className="spinner" aria-hidden /> : running ? <Square className="ico solo" aria-hidden /> : <Play className="ico solo" aria-hidden />}
          </button>
        )}
        {spent && (
          <span className="badge on-media cost-badge" title={spent.count ? tc('costs.calls', spent.count) : t('costs.noLine')}>
            {spent.count ? `${spent.unmeasured ? '≥ ' : ''}${formatUsd(spent.count === spent.unmeasured ? null : spent.usd, lang)}` : '—'}
          </span>
        )}
        {/* On the picture, so it is there at every card size; never while something is being made for the scene. */}
        <button className="icon-btn glass scene-trash" disabled={!!work.making || !!work.clipping || !!scene.clipJob}
          onClick={() => onRemove(scene)} title={t('remove.button')} aria-label={t('remove.button')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" /></svg>
        </button>
      </div>
      <div className="scene-body">
        <strong>{scene.variant || t('scenes.noVariant')}</strong>
        <span className="muted"> · {piece?.name ?? t('scenes.unknownPiece')}</span>
        {work.error && <p className="error small">{errorText(work.error)}</p>}
      </div>
      {/* The changes are made in the scene's workbench (the large view); a scene with no picture yet has nothing to open. */}
      {todo && !beat && (
        <div className="scene-actions">
          <button className={`primary ${armed === 'make' ? 'armed' : ''}`} disabled={!!work.making} onClick={() => confirm('make', () => onMakeAll(scene))}>
            {armed === 'make' ? t('studio.confirm') : t('scenes.makeAll')}
            {costs && each !== null && <span className="estimate"> · ≈ {formatUsd(toMake * each, lang)}</span>}
          </button>
        </div>
      )}
    </article>
  );
}

/** The four instructions of a scene (three pictures and the clip), as the studio will send them. */
export function ScenePrompts({ scene, piece, profile, disabled, onPrompt }: { scene: Scene; piece: Piece | undefined; profile: TradeProfile; disabled: boolean; onPrompt: (scene: Scene, key: PromptKey, own: string | undefined) => void }) {
  const { t } = useI18n();
  const lang = getLanguage();
  const auto = promptsFor({ profile, placeDescription: scene.placeDescription, ...(piece?.description ? { pieceDescription: piece.description } : {}), animation: scene.animation });
  const items = [
    // The place of a scene started from the person's own photo is never generated: nothing to instruct.
    ...BEATS.filter((b) => !(b === 'place' && scene.placeFromPhoto)).map((b) => ({ key: b, label: profile.beats[b][lang], auto: b === 'place' && scene.placeSourcePath ? ENHANCE_PLACE_PROMPT : auto[b], own: scene.prompts?.[b] })),
    { key: 'clip', label: t('clip.badge'), auto: clipPrompt(profile, scene.animation), own: scene.prompts?.clip },
  ];
  return <PromptEditor items={items} disabled={disabled} onChange={(key, own) => onPrompt(scene, key as PromptKey, own)} />;
}
