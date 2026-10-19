/**
 * The forms of a scene's workbench (Lightbox), each asked before a paid or
 * visible change: redo a picture, make the clip, set the words over the scene;
 * and the row of a picture's kept versions. Each form keeps its own draft; the
 * words' draft lives in the Lightbox because the stage previews it live.
 */
import { useState } from 'react';
import { Clapperboard, Monitor, RefreshCw, Smartphone, Tablet, Trash2, Video } from 'lucide-react';
import { useI18n, getLanguage } from '../i18n';
import { CAPTION_ANIMS, CAPTION_FIELDS, CAPTION_PLACES, CAPTION_SCREENS, captionLines, captionToSave, type CaptionScreen, type SceneCaption } from '../model/caption';
import { BEATS, CLIP_CAMERAS, CLIP_LIGHTS, type Beat, type ClipStyle, type Piece, type Scene } from '../model/types';
import { companionsFor, type TradeProfile } from '../model/profiles';
import type { PieceShow } from '../model/showcase';
import type { CurrencySettings } from '../model/currency';
import type { RemakeChange } from '../hooks/useScenes';
import { estimateClip, formatUsd } from '../model/costs';
import { CLIP_SECONDS } from '../data/makeClip';
import { Thumb } from './Thumb';

const SCREEN_ICON = { desktop: Monitor, tablet: Tablet, mobile: Smartphone } as const;

/** What a redone picture is made from, filled from the scene when the form opens. */
export function RedoForm({ scene, beat, profile, busy, each, onRemake, onCancel }: {
  scene: Scene; beat: Beat; profile: TradeProfile; busy: boolean;
  /** One picture's estimated price, or null when costs are not shown. */
  each: number | null;
  onRemake: (change: RemakeChange) => void; onCancel: () => void;
}) {
  const { t } = useI18n();
  const lang = getLanguage();
  const animations = [...profile.animations, ...companionsFor(profile)];
  const [redo, setRedo] = useState(() => {
    const known = animations.some((a) => a.id === scene.animation);
    return { note: scene.beatNotes?.[beat] ?? '', place: scene.placeDescription, animation: known ? scene.animation : '__own', own: known ? '' : scene.animation };
  });
  return (
    <div className="studio-form">
      {beat === 'place' && !scene.placeSourcePath && (
        <>
          <span className="form-label">{t('studio.redo.place')}</span>
          <textarea rows={3} value={redo.place} maxLength={600} onChange={(e) => setRedo((r) => ({ ...r, place: e.target.value }))} />
        </>
      )}
      {beat === 'alive' && (
        <>
          <span className="form-label">{t('studio.redo.alive')}</span>
          <div className="chip-row">
            {animations.map((a) => (
              <button key={a.id} className={`chip-tile glass ${redo.animation === a.id ? 'chosen' : ''}`} onClick={() => setRedo((r) => ({ ...r, animation: a.id }))}>{a.label[lang]}</button>
            ))}
            <button className={`chip-tile glass ${redo.animation === '__own' ? 'chosen' : ''}`} onClick={() => setRedo((r) => ({ ...r, animation: '__own' }))}>{t('scenes.ownAnimation')}</button>
          </div>
          {redo.animation === '__own' && <input value={redo.own} maxLength={300} placeholder={t('scenes.ownAnimationHint')} onChange={(e) => setRedo((r) => ({ ...r, own: e.target.value }))} />}
        </>
      )}
      <span className="form-label">{t('studio.redo.note')}</span>
      <input value={redo.note} maxLength={300} placeholder={t(`studio.redo.noteHint.${beat}`)} onChange={(e) => setRedo((r) => ({ ...r, note: e.target.value }))} />
      <div className="form-actions">
        <button className="primary" disabled={busy || (beat === 'alive' && redo.animation === '__own' && !redo.own.trim())} onClick={() => {
          const change: RemakeChange = { note: redo.note };
          if (beat === 'place' && !scene.placeSourcePath) change.placeDescription = redo.place;
          if (beat === 'alive') change.animation = redo.animation === '__own' ? redo.own : redo.animation;
          onRemake(change);
        }}>
          <RefreshCw className="ico" aria-hidden />{t('scenes.remakeThis', { beat: profile.beats[beat][lang] })}{each !== null ? ` · ≈ ${formatUsd(each * (BEATS.length - BEATS.indexOf(beat)), lang)}` : ''}
        </button>
        <button className="link" onClick={onCancel}>{t('remove.cancel')}</button>
      </div>
      {beat !== 'alive' && <p className="studio-note small muted">{t('studio.redo.after')}</p>}
    </div>
  );
}

/** How the clip moves between its two pictures, asked before it is made. */
export function ClipForm({ scene, busy, onMake, onCancel }: { scene: Scene; busy: boolean; onMake: (style: ClipStyle) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const lang = getLanguage();
  const [draft, setDraft] = useState<ClipStyle>(scene.clipStyle ?? {});
  return (
    <div className="studio-form">
      <span className="form-label">{t('clip.camera')}</span>
      <div className="chip-row">
        {CLIP_CAMERAS.map((c) => (
          <button key={c} className={`chip-tile glass ${(draft.camera ?? 'still') === c ? 'chosen' : ''}`} onClick={() => setDraft((d) => ({ ...d, camera: c }))}>{t(`clip.camera.${c}`)}</button>
        ))}
      </div>
      <span className="form-label">{t('clip.light')}</span>
      <div className="chip-row">
        {CLIP_LIGHTS.map((l) => (
          <button key={l} className={`chip-tile glass ${(draft.light ?? 'steady') === l ? 'chosen' : ''}`} onClick={() => setDraft((d) => ({ ...d, light: l }))}>{t(`clip.light.${l}`)}</button>
        ))}
      </div>
      <input value={draft.note ?? ''} maxLength={300} placeholder={t('clip.noteHint')} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
      <div className="form-actions">
        <button className="primary" disabled={busy} onClick={() => {
          const style: ClipStyle = {};
          if (draft.camera && draft.camera !== 'still') style.camera = draft.camera;
          if (draft.light && draft.light !== 'steady') style.light = draft.light;
          if (draft.note?.trim()) style.note = draft.note.trim();
          onMake(style);
        }}>
          <Clapperboard className="ico" aria-hidden />{t(scene.clipPath ? 'clip.remake' : 'clip.make')} · ≈ {formatUsd(estimateClip(CLIP_SECONDS), lang)}
        </button>
        <button className="link" onClick={onCancel}>{t('remove.cancel')}</button>
      </div>
    </div>
  );
}

/** The words over the scene: which fields of the piece, a line of her own, where, how they come in, per screen. */
export function CaptionForm({ draft, setDraft, screen, setScreen, onReplay, piece, show, currency, busy, saved, onSave, onCancel }: {
  draft: SceneCaption; setDraft: (fn: (c: SceneCaption) => SceneCaption) => void;
  screen: CaptionScreen; setScreen: (s: CaptionScreen) => void; onReplay: () => void;
  piece: Piece | undefined; show: PieceShow | undefined; currency: CurrencySettings; busy: boolean;
  /** The scene already carries words (they can be taken off). */
  saved: boolean;
  onSave: (caption: SceneCaption | null) => void; onCancel: () => void;
}) {
  const { t } = useI18n();
  const lang = getLanguage();
  return (
    <div className="studio-form">
      <span className="form-label">{t('caption.fields')}</span>
      <div className="chip-row">
        {CAPTION_FIELDS.map((f) => {
          const on = draft.fields.includes(f);
          return <button key={f} className={`chip-tile glass ${on ? 'chosen' : ''}`} aria-pressed={on} onClick={() => setDraft((c) => ({ ...c, fields: on ? c.fields.filter((x) => x !== f) : [...c.fields, f] }))}>{t(`caption.field.${f}`)}</button>;
        })}
      </div>
      <input value={draft.text ?? ''} maxLength={200} placeholder={t('caption.textHint')} onChange={(e) => setDraft((c) => ({ ...c, text: e.target.value }))} />
      <span className="form-label">{t('caption.screen')}</span>
      <nav className="segmented glass screen-pick" aria-label={t('caption.screen')}>
        {CAPTION_SCREENS.map((sc) => {
          const Icon = SCREEN_ICON[sc];
          return <button key={sc} className={`icon-btn ${screen === sc ? 'on' : ''}`} aria-pressed={screen === sc} aria-label={t(`caption.screen.${sc}`)} data-tip={t(`caption.screen.${sc}`)} onClick={() => setScreen(sc)}><Icon className="ico solo" aria-hidden />{draft.pos?.[sc] && <span className="tool-dot" aria-hidden />}</button>;
        })}
      </nav>
      <p className="studio-note small muted">{t('caption.dragHint')}</p>
      {draft.pos?.[screen] && (
        <button className="link" onClick={() => setDraft((c) => { const pos = { ...(c.pos ?? {}) }; delete pos[screen]; return { ...c, pos }; })}>{t('caption.unpin')}</button>
      )}
      <span className="form-label">{t('caption.anim')}</span>
      <div className="chip-row">
        {CAPTION_ANIMS.map((a) => (
          <button key={a} className={`chip-tile glass ${(draft.anim ?? 'rise') === a ? 'chosen' : ''}`} onClick={() => { setDraft((c) => ({ ...c, anim: a })); onReplay(); }}>{t(`caption.anim.${a}`)}</button>
        ))}
        <button className="link" onClick={onReplay}>{t('caption.replay')}</button>
      </div>
      <span className="form-label">{t('caption.place')}</span>
      <div className="chip-row">
        {CAPTION_PLACES.map((p) => (
          <button key={p} className={`chip-tile glass ${(draft.place ?? 'br') === p ? 'chosen' : ''}`} onClick={() => setDraft((c) => ({ ...c, place: p }))}>{t(`caption.place.${p}`)}</button>
        ))}
      </div>
      {!captionLines(draft, piece, show, lang, currency) && <p className="studio-note small muted">{t('caption.empty')}</p>}
      <div className="form-actions">
        <button className="primary" disabled={busy} onClick={() => onSave(captionToSave(draft))}>{t('caption.save')}</button>
        {saved && <button className="link" onClick={() => onSave(null)}>{t('caption.remove')}</button>}
        <button className="link" onClick={onCancel}>{t('remove.cancel')}</button>
      </div>
    </div>
  );
}

/** The versions of what is shown: the one in use in green, the kept ones to put back or delete (a second press). */
export function TakesRow({ scene, subject, title, busy, armed, confirm, onChoose, onDelete }: {
  scene: Scene; subject: Beat | 'clip'; title: string; busy: boolean;
  armed: string | null; confirm: (key: string, run: () => void) => void;
  onChoose: (path: string) => void; onDelete: (path: string) => void;
}) {
  const { t } = useI18n();
  const onClip = subject === 'clip';
  const kept = onClip ? (scene.clipTakes ?? []).map((c) => c.path) : scene.takes?.[subject] ?? [];
  if (!kept.length) return null;
  return (
    <div className="studio-takes">
      <span className="form-label">{t('studio.versions')} · {title}</span>
      <div className="takes-row">
        <span className="take chosen" data-tip={t('studio.versionNow')}>
          {onClip ? <span className="take-pic take-video"><Video className="ico" aria-hidden /></span> : <span className="take-pic"><Thumb path={scene.images[subject]} alt="" /></span>}
        </span>
        {kept.map((p, i) => (
          <span key={p} className="take">
            <button className="take-pic" disabled={busy} data-tip={t('studio.versionUse')} aria-label={t('studio.versionUse')} onClick={() => onChoose(p)}>
              {onClip ? <span className="take-video"><Video className="ico" aria-hidden /><small>{kept.length - i}</small></span> : <Thumb path={p} alt="" />}
            </button>
            <button className={`take-del ${armed === `del-${p}` ? 'armed' : ''}`} disabled={busy} data-tip={t('studio.versionDelete')} aria-label={t('studio.versionDelete')}
              onClick={() => confirm(`del-${p}`, () => onDelete(p))}><Trash2 className="ico" aria-hidden /></button>
          </span>
        ))}
      </div>
    </div>
  );
}
