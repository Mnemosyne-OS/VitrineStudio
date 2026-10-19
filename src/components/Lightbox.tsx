import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Eye, EyeOff, History, Images, Layers, Pause, Play, RefreshCw, Scissors, Sparkles, Trash2, Type, Video } from 'lucide-react';
import { captionLines, posFor, type CaptionLines, type CaptionScreen, type SceneCaption } from '../model/caption';
import type { PieceShow } from '../model/showcase';
import type { CurrencySettings } from '../model/currency';
import { useI18n, getLanguage } from '../i18n';
import { BEATS, SCENE_MOTIONS, type Beat, type ClipStyle, type Piece, type PromptKey, type Scene, type SceneMotion } from '../model/types';
import type { TradeProfile } from '../model/profiles';
import type { RemakeChange } from '../hooks/useScenes';
import { readImage, readMedia } from '../data/host';
import { LivingStage } from './LivingStage';
import { LAYER_STEPS } from '../data/sceneLayersMake';
import { layersCurrent } from '../model/sceneLayers';
import { DECOR_WARN_SHARE } from '../model/decor';
import { nextBeat } from '../model/records';
import { estimateImage, formatUsd, totalOf, type CostEntry } from '../model/costs';
import { errorText } from './errors';
import { PartEditor } from './FilmParts';
import { ClipMaking, PictureMaking } from './ClipMaking';
import { Thumb } from './Thumb';
import { useArmed } from '../hooks/useArmed';
import { ScenePrompts, type SceneWork } from './ScenesPanel';
import { CaptionForm, ClipForm, RedoForm, TakesRow } from './LightboxForms';

/** The shape of each screen the site is seen on, for the words' preview (portrait for the tablet and the phone). */
const SCREEN_RATIO: Record<CaptionScreen, number> = { desktop: 16 / 10, tablet: 3 / 4, mobile: 9 / 19.5 };

/** The words as a glass card: in a corner, or where she dragged them on this screen. */
function CaptionCard({ lines, screen, onDrag }: { lines: CaptionLines; screen: CaptionScreen; onDrag?: (e: React.PointerEvent<HTMLDivElement>) => void }) {
  const items = [...(lines.title ? [{ b: true, text: lines.title }] : []), ...lines.lines.map((text) => ({ b: false, text }))];
  const pos = posFor(lines.pos, screen);
  return (
    <div className={`stage-caption cap-${lines.place} cap-anim-${lines.anim} ${pos ? 'free' : ''} ${onDrag ? 'draggable' : ''} screen-${screen}`}
      style={pos ? { left: `${pos.x}%`, top: `${pos.y}%` } : undefined} onPointerDown={onDrag}>
      {items.map((it, i) => (it.b ? <b key={i} style={{ '--i': i } as React.CSSProperties}>{it.text}</b> : <span key={i} style={{ '--i': i } as React.CSSProperties}>{it.text}</span>))}
    </div>
  );
}

/** How long each picture stays when the scene plays, as on the website. */
const PLAY_STEP_MS = 1800;

/** What the scene's workbench can do: the same actions the card used to carry. */
export interface SceneTools {
  piece: Piece | undefined;
  /** The piece's showing on the site (its measures), for the words over the scene. */
  show: PieceShow | undefined;
  currency: CurrencySettings;
  work: SceneWork;
  advanced: boolean;
  costs: CostEntry[] | null;
  imageModel: string;
  onMakeAll: (scene: Scene) => void;
  /** Redoes a picture, made from what `change` says. */
  onRemake: (scene: Scene, beat: Beat, change: RemakeChange) => void;
  onValidate: (scene: Scene, validated: boolean) => void;
  /** Makes the clip the way `style` says (saved with the scene first). */
  onMakeClip: (scene: Scene, style: ClipStyle) => void;
  onCut: (scene: Scene, cut: { in: number; out: number } | null) => void;
  onPrompt: (scene: Scene, key: PromptKey, own: string | undefined) => void;
  onRemove: (scene: Scene) => void;
  /** The words over the scene; `null` takes them off. */
  onCaption: (scene: Scene, caption: SceneCaption | null) => void;
  /** Puts a kept version back. */
  onChooseTake: (scene: Scene, beat: Beat | 'clip', path: string) => void;
  /** Deletes a kept version (its file too, when nothing else shows it). */
  onDeleteTake: (scene: Scene, beat: Beat | 'clip', path: string) => void;
  /** How the scene moves on the site; « living » makes its layers first when needed. */
  onMotion: (scene: Scene, motion: SceneMotion) => void;
  /** Every picture of the scene's piece over time (EvolutionView). */
  onEvolution: (piece: Piece) => void;
}

/**
 * A scene full screen, and its workbench (Tony: « photo à gauche, outils à
 * droite »): the pictures large on the left, one at a time, with "Play" which
 * dissolves place → creation → living the way the website will; on the right
 * everything that changes the scene — redo a picture, make or trim the clip,
 * put it on the site, its instructions, remove it.
 *
 * The pictures are stacked and cross-faded, so the dissolve shows exactly
 * what the visitor will see: the room must not move between them. A click on
 * the dark around closes; the panel keeps its clicks.
 */
export function Lightbox({ scene, profile, start, onClose, tools }: { scene: Scene; profile: TradeProfile; start: Beat; onClose: () => void; tools: SceneTools }) {
  const { t, tc } = useI18n();
  const lang = getLanguage();
  const { piece, work, advanced, costs, imageModel } = tools;
  const made = BEATS.filter((b) => scene.images[b]);
  const [chosen, setCurrent] = useState<Beat>(made.includes(start) ? start : made[made.length - 1] ?? 'place');
  // A picture redone here leaves the scene: the view falls back on the last one that exists.
  const current = made.includes(chosen) ? chosen : made[made.length - 1] ?? 'place';
  const [playing, setPlaying] = useState(false);
  const [srcs, setSrcs] = useState<Partial<Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  // The clip, when the scene has one: it plays in place of the last dissolve.
  // Played from a blob: a data: URL of several megabytes loads slowly and stutters.
  const [clip, setClip] = useState<string | null>(null);
  const [clipError, setClipError] = useState(false);
  const [clipOn, setClipOn] = useState(false);
  const [cutting, setCutting] = useState(false);
  // The living scene shown on the stage (its layers, the life swaying). A scene set to living
  // opens on it: stepping through its pictures first showed the cut (Tony, 2026-10-12).
  const [livingOn, setLivingOn] = useState(() => scene.motion === 'living');
  // The clip's settings, asked before it is made (Tony: « faut des paramètres, sinon ça génère dans le vide »).
  const [videoForm, setVideoForm] = useState(false);
  // A picture's options, asked before it is redone, like the clip's.
  const [redoForm, setRedoForm] = useState(false);
  // Words over the scene, from the piece's record: previewed live while chosen.
  const [capForm, setCapForm] = useState(false);
  const [capDraft, setCapDraft] = useState<SceneCaption>(scene.caption ?? { fields: ['name', 'size'] });
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [screen, setScreen] = useState<CaptionScreen>('desktop');
  // Bumped to play the words' entrance again in the preview.
  const [replay, setReplay] = useState(0);
  // Dragging the words inside the screen's frame: their centre, in % of it, kept off the very edge.
  const dragCaption = (e: React.PointerEvent<HTMLDivElement>) => {
    const frame = e.currentTarget.parentElement;
    if (!frame) return;
    e.preventDefault();
    const box = frame.getBoundingClientRect();
    const card = e.currentTarget.getBoundingClientRect();
    // Grab where the pointer is on the card, not by its centre: no jump on the first move.
    const dx = e.clientX - (card.left + card.width / 2), dy = e.clientY - (card.top + card.height / 2);
    const clamp = (v: number) => Math.round(Math.min(97, Math.max(3, v)) * 10) / 10;
    const move = (ev: PointerEvent) => {
      const x = clamp(((ev.clientX - dx - box.left) / box.width) * 100);
      const y = clamp(((ev.clientY - dy - box.top) / box.height) * 100);
      setCapDraft((c) => ({ ...c, pos: { ...(c.pos ?? {}), [screen]: { x, y } } }));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const shownCaption = captionLines(capForm ? capDraft : scene.caption, piece, tools.show, lang, tools.currency);
  const closeForms = () => { setVideoForm(false); setRedoForm(false); setCapForm(false); };
  const openRedo = () => {
    setVideoForm(false);
    setCapForm(false);
    setCutting(false);
    setRedoForm((v) => !v);
  };
  const video = useRef<HTMLVideoElement>(null);
  // The living picture's own shape: the clip is shown cut to it, since the video model
  // widens a square scene to 16:9 and invents its sides (often a mirror of the room).
  const [picRatio, setPicRatio] = useState<number | null>(null);
  const [clipRatio, setClipRatio] = useState<number | null>(null);
  // Cut only when the two shapes really differ: a 16:9 scene's 16:9 clip is shown whole.
  const cropTo = picRatio && clipRatio && !scene.clipFrames && Math.abs(picRatio - clipRatio) / clipRatio > 0.03 ? picRatio : null;
  // Every picture or clip is paid: a second press confirms.
  const { armed, confirm: confirmed } = useArmed();

  useEffect(() => {
    setClip(null);
    setClipError(false);
    if (!scene.clipPath) return;
    let alive = true;
    let url: string | null = null;
    readMedia(scene.clipPath)
      .then((data) => fetch(data))
      .then((r) => r.blob())
      .then(
        (blob) => {
          url = URL.createObjectURL(blob);
          if (alive) setClip(url);
          else URL.revokeObjectURL(url);
        },
        (err: unknown) => {
          console.warn('[vitrine-studio] the clip could not be read:', err);
          if (alive) setClipError(true);
        },
      );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [scene.clipPath]);

  // Read every picture once, so switching and playing never wait. Keyed by path: a redone picture is read anew.
  useEffect(() => {
    let alive = true;
    for (const b of made) {
      const path = scene.images[b]!;
      if (srcs[path]) continue;
      readImage(path).then(
        (src) => alive && setSrcs((s) => ({ ...s, [path]: src })),
        (err: unknown) => alive && setError(err instanceof Error ? err.message : String(err)),
      );
    }
    return () => {
      alive = false;
    };
    // The pictures' paths are what matters, not the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, made.map((b) => scene.images[b]).join()]);

  const move = (dir: 1 | -1) => {
    setPlaying(false);
    setClipOn(false);
    const i = made.indexOf(current);
    setCurrent(made[(i + dir + made.length) % made.length]!);
  };

  // The keys, listened to once: the listener reads today's `move` and `onClose` through a ref
  // (it was added and removed again on every render, a few times a second while playing).
  const keys = useRef({ move, onClose });
  keys.current = { move, onClose };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { keys.current.onClose(); return; }
      // Inside the workbench the keys belong to its fields and to the trim's timeline.
      if (e.target instanceof Element && e.target.closest('.lightbox-studio')) return;
      if (e.key === 'ArrowRight') keys.current.move(1);
      else if (e.key === 'ArrowLeft') keys.current.move(-1);
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Play: from the first beat to the last, and stop on the last, as the site does.
  useEffect(() => {
    // While the clip plays it is the clip that ends the step: a timer here would start it over every 1.8 s.
    if (!playing || clipOn) return;
    const i = made.indexOf(current);
    const timer = setTimeout(() => {
      if (i >= made.length - 1) setPlaying(false);
      // From the creation to the living, the clip plays instead of a dissolve.
      else if (clip && made[i + 1] === 'alive' && video.current) {
        setClipOn(true);
        video.current.currentTime = scene.clipCut?.in ?? 0;
        video.current.play().catch((err: unknown) => { console.warn('[vitrine-studio] the clip did not play:', err); setClipOn(false); setCurrent('alive'); });
      } else setCurrent(made[i + 1]!);
    }, PLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, clipOn, current, made, clip, scene.clipCut]);

  const startPlay = () => {
    setCutting(false);
    setLivingOn(false);
    setClipOn(false);
    setCurrent(made[0]!);
    setPlaying(true);
  };

  // A click on the dark closes; the controls and the panel keep their clicks.
  const own = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const todo = nextBeat(scene);
  const busy = !!work.making || !!work.clipping || !!work.layering;
  // How the scene shows on the site: what she chose, else what it did before the choice existed.
  const motion: SceneMotion = scene.motion ?? (scene.clipPath ? 'video' : 'images');
  const living = layersCurrent(scene.layers, scene.images) ? scene.layers : null;
  // Asked for while the layers are still being made: the pictures stay until they exist.
  const showLiving = livingOn && !!living;
  const moved = typeof scene.decorChange === 'number' && scene.decorChange > DECOR_WARN_SHARE;
  const spent = costs ? totalOf(costs, (e) => e.record === scene.id) : null;
  const each = estimateImage(imageModel);
  const toMake = BEATS.filter((b) => !scene.images[b]).length;
  const name = scene.variant || t('scenes.noVariant');

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={name} onClick={onClose}>
      <div className="lightbox-stage">
        {made.map((b) => {
          const src = srcs[scene.images[b]!];
          return src
            ? <img key={b} src={src} alt={`${profile.beats[b][lang]} · ${scene.variant}`} className={b === current && !clipOn && !cutting && !showLiving ? 'on' : ''}
                onLoad={(e) => { const i = e.currentTarget; if (!i.naturalWidth || !i.naturalHeight) return; const r = i.naturalWidth / i.naturalHeight; setRatios((m) => ({ ...m, [b]: r })); if (b === 'alive') setPicRatio(r); }} />
            : <div key={b} className={`lightbox-loading ${b === current ? 'on' : ''}`}><span className="spinner" aria-hidden /></div>;
        })}
        {living && <LivingStage layers={living} on={showLiving && !cutting} label={`${t('motion.living')} · ${scene.variant}`} unreadable={t('motion.unreadable')} />}
        {clip && !cutting && (
          <video ref={video} src={clip} muted playsInline className={`stage-clip ${clipOn ? 'on' : ''}`}
            // A clip made from wide frames has real sides: it is shown whole.
            style={cropTo ? ({ '--r': String(cropTo) } as React.CSSProperties) : undefined}
            onLoadedMetadata={(e) => { const v = e.currentTarget; if (v.videoWidth && v.videoHeight) setClipRatio(v.videoWidth / v.videoHeight); }}
            onEnded={() => { setClipOn(false); setCurrent('alive'); setPlaying(false); }}
            onPause={(e) => { if (clipOn && !playing && e.currentTarget.ended) setClipOn(false); }}
            // The part she kept ends the clip: the living takes over there.
            onTimeUpdate={(e) => { if (scene.clipCut && clipOn && e.currentTarget.currentTime >= scene.clipCut.out) { e.currentTarget.pause(); setClipOn(false); setCurrent('alive'); setPlaying(false); } }} />
        )}
        {/* Trimming: the clip takes the stage, its timeline sits in the panel's place under it. */}
        {cutting && clip && (
          <div className="lightbox-cut" onClick={(e) => e.stopPropagation()}>
            <PartEditor src={clip} cut={scene.clipCut} label={t('clip.cut')} onCut={(cut) => tools.onCut(scene, cut)} />
          </div>
        )}
        {(scene.clipJob || work.clipping) && !work.making && <ClipMaking startedAt={scene.clipJob?.startedAt} />}
        {/* The layers being made: the studio's film over the scene, the step, how far, the clock. */}
        {work.layering && (
          <ClipMaking startedAt={work.layeringAt} icon={work.layering.startsWith('cut') ? Scissors : Layers}
            title={`${t(`motion.step.${work.layering}`)} · ${LAYER_STEPS.indexOf(work.layering) + 1}/${LAYER_STEPS.length}`} />
        )}
        {/* The words, in a box fitted to the picture (not to the dark around it). */}
        {/* While the words are set: the picture as each screen crops it, and the words dragged on it. */}
        {capForm && shownCaption && scene.images[current] && (
          <div className="device-stage" onClick={(e) => e.stopPropagation()}>
            <div className={`device-frame screen-${screen}`} style={{ '--r': String(SCREEN_RATIO[screen]) } as React.CSSProperties}>
              {srcs[scene.images[current]] && <img src={srcs[scene.images[current]]} alt="" draggable={false} />}
              <CaptionCard key={`${replay}-${shownCaption.anim}-${screen}`} lines={shownCaption} screen={screen} onDrag={dragCaption} />
            </div>
          </div>
        )}
        {shownCaption && !capForm && !cutting && !work.making && (
          <div className="stage-fit" style={{ '--r': String(ratios[current] ?? 16 / 9) } as React.CSSProperties}>
            <CaptionCard lines={shownCaption} screen="desktop" />
          </div>
        )}
        {work.making && <PictureMaking beat={profile.beats[work.making][lang]} />}
        {made.length > 1 && !cutting && (
          <>
            <button className="lightbox-arrow left glass" onClick={own(() => move(-1))} aria-label={t('lightbox.previous')}>‹</button>
            <button className="lightbox-arrow right glass" onClick={own(() => move(1))} aria-label={t('lightbox.next')}>›</button>
          </>
        )}
      </div>

      <aside className="lightbox-studio glass" onClick={(e) => e.stopPropagation()}>
        <header className="studio-head">
          <strong>{name}</strong>
          {/* The piece the scene shows: its pictures over time, every scene of it. */}
          {piece ? (
            <button className="studio-piece" data-tip={t('evolution.open')} aria-label={`${piece.name} · ${t('evolution.open')}`} onClick={() => tools.onEvolution(piece)}>
              <span className="studio-piece-pic"><Thumb path={piece.photoPath} alt="" empty="" /></span>
              <span className="studio-piece-name">{piece.name}</span>
              <History className="ico" aria-hidden />
            </button>
          ) : <span className="muted">{t('scenes.unknownPiece')}</span>}
        </header>

        {/* The scene as a strip: each step as its own small picture, the clip after them. */}
        <div className="studio-strip" role="tablist">
          {BEATS.map((b, i) => {
            const src = scene.images[b] ? srcs[scene.images[b]] : undefined;
            const on = b === current && !clipOn && !cutting && !showLiving;
            return (
              <button key={b} role="tab" aria-selected={on} disabled={!scene.images[b]} className={`strip-tile ${on ? 'chosen' : ''} ${scene.images[b] ? '' : 'empty'}`}
                onClick={() => { setPlaying(false); setClipOn(false); setCutting(false); setLivingOn(false); setCurrent(b); }}>
                <span className="strip-pic">{src ? <img src={src} alt="" /> : <span className="strip-num">{i + 1}</span>}</span>
                <span className="strip-label">{profile.beats[b][lang]}</span>
              </button>
            );
          })}
          {living && (
            <button role="tab" aria-selected={showLiving} className={`strip-tile ${showLiving ? 'chosen' : ''}`}
              onClick={() => { setPlaying(false); setClipOn(false); setCutting(false); setLivingOn(true); }}>
              <span className="strip-pic strip-video"><Sparkles className="ico" aria-hidden /></span>
              <span className="strip-label">{t('motion.living')}</span>
            </button>
          )}
          {scene.clipPath && (
            <button role="tab" aria-selected={clipOn || cutting} disabled={!clip} className={`strip-tile ${clipOn || cutting ? 'chosen' : ''}`}
              onClick={() => { setCutting(false); setPlaying(false); setLivingOn(false); setClipOn(true); const v = video.current; if (v) { v.currentTime = scene.clipCut?.in ?? 0; v.play().catch((err: unknown) => console.warn('[vitrine-studio] the clip did not play:', err)); } }}>
              <span className="strip-pic strip-video"><Video className="ico" aria-hidden /></span>
              <span className="strip-label">{t('studio.video')}</span>
            </button>
          )}
        </div>
        {/* The versions of what is shown: the current one in green, the kept ones to put back or delete. */}
        {(() => {
          const subject: Beat | 'clip' = (clipOn || cutting) && scene.clipPath ? 'clip' : current;
          return <TakesRow key={subject} scene={scene} subject={subject} title={subject === 'clip' ? t('studio.video') : profile.beats[current][lang]} busy={busy} armed={armed} confirm={confirmed}
            onChoose={(p) => tools.onChooseTake(scene, subject, p)} onDelete={(p) => tools.onDeleteTake(scene, subject, p)} />;
        })()}
        {/* Making the missing pictures stays a full button: it is the next thing to do. */}
        {todo && (
          <button className={`primary studio-make ${armed === 'make' ? 'armed' : ''}`} disabled={busy} onClick={() => confirmed('make', () => tools.onMakeAll(scene))}>
            {armed === 'make' ? t('studio.confirm') : todo === 'place' ? t('scenes.makeAll') : t('scenes.makeNamed', { beats: BEATS.filter((b) => !scene.images[b]).map((b) => profile.beats[b][lang]).join(' + ') })}
            {costs && each !== null && <span className="estimate"> · ≈ {formatUsd(toMake * each, lang)}</span>}
          </button>
        )}

        {/* The tools: round icons, each named by its bubble (Tony: « optimise les boutons avec tooltip »). */}
        <div className="studio-tools" role="toolbar" aria-label={name}>
          {made.length > 1 && (
            <button className={`tool ${playing ? 'chosen' : ''}`} aria-pressed={playing} aria-label={t(playing ? 'lightbox.pause' : 'studio.playScene')} data-tip={t(playing ? 'lightbox.pause' : 'studio.playScene')}
              onClick={() => (playing ? setPlaying(false) : startPlay())}>
              {playing ? <Pause className="ico" aria-hidden /> : <Play className="ico" aria-hidden />}
            </button>
          )}
          {/* A place that is the person's own photo has nothing to redo: redoing it would erase it. */}
          {scene.images[current] && !(current === 'place' && scene.placeFromPhoto) && (
            <button className={`tool ${redoForm ? 'chosen' : ''}`} disabled={busy} aria-label={t('scenes.remakeThis', { beat: profile.beats[current][lang] })}
              data-tip={`${t('scenes.remakeThis', { beat: profile.beats[current][lang] })}${costs && each !== null ? ` · ≈ ${formatUsd(each, lang)}` : ''}`}
              aria-pressed={redoForm} onClick={openRedo}>
              <RefreshCw className="ico" aria-hidden />
            </button>
          )}
          {!todo && !scene.clipJob && (
            <button className={`tool ${videoForm ? 'chosen' : ''}`} disabled={busy} aria-label={t(scene.clipPath ? 'clip.remake' : 'clip.make')}
              data-tip={`${t(scene.clipPath ? 'clip.remake' : 'clip.make')} · ${t('clip.cost')}`}
              aria-pressed={videoForm} onClick={() => { setCutting(false); setRedoForm(false); setCapForm(false); setVideoForm((v) => !v); }}>
              <Clapperboard className="ico" aria-hidden />
            </button>
          )}
          {scene.clipPath && (
            <button className={`tool ${cutting ? 'chosen' : ''}`} aria-pressed={cutting} disabled={!clip}
              aria-label={t('clip.cut')} data-tip={`${t('clip.cut')}${scene.clipCut ? ` · ${scene.clipCut.in.toFixed(1)} → ${scene.clipCut.out.toFixed(1)} s` : ''}`}
              onClick={() => { setPlaying(false); setClipOn(false); setCutting((c) => !c); }}>
              <Scissors className="ico" aria-hidden />
              {scene.clipCut && <span className="tool-dot" aria-hidden />}
            </button>
          )}
          <button className={`tool ${capForm ? 'chosen' : ''}`} disabled={busy} aria-pressed={capForm} aria-label={t('caption.tool')} data-tip={t('caption.tool')}
            onClick={() => { const open = !capForm; closeForms(); setCutting(false); setCapDraft(scene.caption ?? { fields: ['name', 'size'] }); setCapForm(open); }}>
            <Type className="ico" aria-hidden />
            {scene.caption && <span className="tool-dot" aria-hidden />}
          </button>
          <button className="tool tool-danger" disabled={busy || !!scene.clipJob} aria-label={t('remove.button')} data-tip={t('remove.button')}
            onClick={() => tools.onRemove(scene)}>
            <Trash2 className="ico" aria-hidden />
          </button>
        </div>

        {capForm && (
          <CaptionForm draft={capDraft} setDraft={setCapDraft} screen={screen} setScreen={setScreen} onReplay={() => setReplay((n) => n + 1)}
            piece={piece} show={tools.show} currency={tools.currency} busy={busy} saved={!!scene.caption}
            onSave={(next) => { setCapForm(false); tools.onCaption(scene, next); }} onCancel={() => setCapForm(false)} />
        )}
        {redoForm && scene.images[current] && (
          <RedoForm key={current} scene={scene} beat={current} profile={profile} busy={busy} each={each}
            onRemake={(change) => { setRedoForm(false); tools.onRemake(scene, current, change); }} onCancel={() => setRedoForm(false)} />
        )}
        {videoForm && !todo && (
          <ClipForm scene={scene} busy={busy} onMake={(style) => { setVideoForm(false); tools.onMakeClip(scene, style); }} onCancel={() => setVideoForm(false)} />
        )}
        {/* On the site: shown or not, and how it moves (three icons, each named by its bubble). */}
        <div className="studio-site">
          <span className="form-label">{t('motion.title')}</span>
          <div className="studio-site-row">
            <button className={`tool ${scene.validated ? 'chosen' : ''}`} aria-pressed={!!scene.validated} disabled={!!todo || busy}
              aria-label={t('scenes.onSite')} data-tip={todo ? t('scenes.onSiteNotMade') : t(scene.validated ? 'scenes.validated' : 'scenes.notOnSite')}
              onClick={() => tools.onValidate(scene, !scene.validated)}>
              {scene.validated ? <Eye className="ico" aria-hidden /> : <EyeOff className="ico" aria-hidden />}
            </button>
            <nav className="segmented glass motion-pick" aria-label={t('motion.title')}>
              {SCENE_MOTIONS.map((m) => {
                const Icon = m === 'images' ? Images : m === 'living' ? Sparkles : Video;
                const off = busy || (m === 'video' && !scene.clipPath) || (m === 'living' && toMake > 0);
                const ask = m === 'living' && armed === 'living';
                return (
                  <button key={m} className={`icon-btn ${motion === m ? 'on' : ''} ${ask ? 'armed' : ''} ${m === 'living' && work.layering ? 'is-making' : ''}`} disabled={off} aria-pressed={motion === m}
                    aria-label={t(`motion.${m}`)} data-tip={ask ? t('studio.confirm') : `${t(`motion.${m}`)} · ${t(`motion.${m}Hint`)}`}
                    // Making the layers takes a minute or two: a second press asks for it, like every long job here.
                    onClick={() => { const go = () => { tools.onMotion(scene, m); if (m === 'living') setLivingOn(true); }; if (m === 'living' && !living) confirmed('living', go); else go(); }}>
                    <Icon className="ico" aria-hidden />
                  </button>
                );
              })}
            </nav>
            <span className="studio-site-now">{t(`motion.${motion}`)}</span>
          </div>
          {armed === 'living' && <p className="studio-note small studio-armed">{t('motion.livingAsk')}</p>}
          {work.layering && (
            <ol className="layer-steps">
              {LAYER_STEPS.map((st, i) => {
                const at = LAYER_STEPS.indexOf(work.layering!);
                return <li key={st} className={i < at ? 'done' : i === at ? 'now' : ''}>{t(`motion.step.${st}`)}</li>;
              })}
            </ol>
          )}
          {motion === 'living' && !living && !work.layering && <p className="studio-note small warn">{t('motion.stale')}</p>}
        </div>
        {/* The bubble hides on a press: the second press is asked here. */}
        {armed && armed !== 'living' && <p className="studio-note small studio-armed">{t('studio.confirm')}</p>}
        {clipError && <p className="error small">{t('clip.unreadable')}</p>}
        {typeof scene.decorChange === 'number' && (
          <p className={`studio-note small ${moved ? 'warn' : 'muted'}`}>{t(moved ? 'scenes.decorMoved' : 'scenes.decorStill', { pct: (scene.decorChange * 100).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}</p>
        )}

        {work.error && <p className="error small">{errorText(work.error)}</p>}
        {error && <p className="error small">{t('thumb.unreadable')}</p>}
        {spent && spent.count > 0 && (
          <p className="small muted studio-cost">{tc('costs.calls', spent.count)} · {spent.unmeasured ? '≥ ' : ''}{formatUsd(spent.count === spent.unmeasured ? null : spent.usd, lang)}</p>
        )}
        {advanced && <ScenePrompts scene={scene} piece={piece} profile={profile} disabled={busy} onPrompt={tools.onPrompt} />}

      </aside>

      <button className="lightbox-close glass" onClick={own(onClose)} aria-label={t('wizard.close')} title={t('wizard.close')}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 4l10 10M14 4L4 14" /></svg>
      </button>
    </div>
  );
}
