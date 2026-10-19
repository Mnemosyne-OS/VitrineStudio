import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n, getLanguage } from '../i18n';
import type { Piece } from '../model/types';
import type { TradeProfile } from '../model/profiles';
import { STYLES, composePlace } from '../model/styles';
import { companionsFor, outdoorIdeas } from '../model/profiles';
import type { Upload } from '../data/photos';
import { nameWords } from '../data/agentFind';
import { DropZone } from './DropZone';
import { describeError, errorText } from './errors';
import { Thumb } from './Thumb';
import type { NewSceneInput } from './ScenesPanel';

type Step = 0 | 1 | 2;

/**
 * What an agent already heard when it opens the wizard (« crée une nouvelle
 * scène dans le jardin »): the person finishes the rest on screen.
 */
export interface SceneWizardInitial {
  /** A piece with its photo: the wizard opens on the place. */
  pieceId?: string;
  /** The room, as the person said it. A room the profile knows also fills the place's description. */
  universe?: string;
}

/** A room as said and as listed, articles off: « le jardin » is the room Jardin. */
const roomKey = (s: string) => nameWords(s).join(' ');

/**
 * A new scene in three steps, each one split in two: the usual way on the
 * left, the other way on the right, and one line saying what is expected.
 *
 * 1. The creation: a photo of the person's own object (new) | one already added.
 * 2. The place: generated from a room and a style | the person's own photo of a room.
 * 3. What brings it to life: a ready choice | the person's own photo of it.
 *
 * Nothing is spent here: the last button creates the scene and, if asked,
 * starts the pictures still to make.
 */
export function SceneWizard({ pieces, profile, aspectRatio, initial, onClose, onCreate, onAddPieces, onPickPiece, uploads, busyUpload, onSavePhoto, onPickPhoto }: {
  pieces: Piece[];
  /** Read once, when the wizard opens. */
  initial?: SceneWizardInitial;
  profile: TradeProfile;
  aspectRatio: string;
  onClose: () => void;
  onCreate: (input: NewSceneInput, makeNow: boolean) => Promise<void>;
  /** Dropped photos become creations; resolves the ones made. */
  onAddPieces: (files: File[]) => Promise<Piece[]>;
  /** The system picker: resolves the creation made, or null when cancelled. */
  onPickPiece: () => Promise<Piece | null>;
  uploads: Upload[];
  busyUpload: boolean;
  /** Keeps a dropped photo on disk (a room, a plant) and resolves its path. */
  onSavePhoto: (file: File) => Promise<string>;
  onPickPhoto: () => Promise<string | null>;
}) {
  const { t } = useI18n();
  const lang = getLanguage();
  // What an agent heard: a piece without its photo cannot be staged, so it is not taken.
  const [start] = useState(() => {
    const piece = initial?.pieceId && pieces.some((p) => p.id === initial.pieceId && p.photoPath) ? initial.pieceId : '';
    const said = initial?.universe?.trim() ?? '';
    const room = roomKey(said) ? [...profile.placeIdeas, ...outdoorIdeas(profile)].find((i) => Object.values(i.label).some((l) => roomKey(l) === roomKey(said))) : undefined;
    return { piece, universe: said, roomId: room?.id ?? '', place: room ? composePlace(room.prompt, undefined) : '' };
  });
  const [step, setStep] = useState<Step>(start.piece ? 1 : 0);
  const [pieceId, setPieceId] = useState(start.piece);
  const [roomId, setRoomId] = useState(start.roomId);
  const [styleId, setStyleId] = useState('');
  const [universe, setUniverse] = useState(start.universe);
  const [variant, setVariant] = useState('');
  const [place, setPlace] = useState(start.place);
  const [placePhoto, setPlacePhoto] = useState<string | undefined>();
  const [enhance, setEnhance] = useState(false);
  const [animation, setAnimation] = useState(profile.animations[0]?.id ?? '');
  const [ownAnimation, setOwnAnimation] = useState('');
  const [refPath, setRefPath] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes, like every dialog of the shell.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const usable = pieces.filter((p) => p.photoPath);
  const chosenAnimation = animation === '__own' ? ownAnimation.trim() : animation;
  const can = [!!pieceId, !!place.trim() || !!placePhoto, !!chosenAnimation];

  // A room and a style compose the description; typing in it afterwards wins.
  const compose = (nextRoom: string, nextStyle: string) => {
    const room = [...profile.placeIdeas, ...outdoorIdeas(profile)].find((i) => i.id === nextRoom);
    const style = STYLES.find((s) => s.id === nextStyle);
    setPlace(composePlace(room?.prompt, style?.prompt));
    if (room && !universe.trim()) setUniverse(room.label[lang]);
    if (style && !variant.trim()) setVariant(style.label[lang]);
  };

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      console.warn('[vitrine-studio] wizard step refused:', err);
      // Through describeError: a raw code (PICTURE_DECODE_TIMEOUT) is not a sentence.
      const d = describeError(err);
      setError(`${errorText(d)}`);
    } finally {
      setBusy(false);
    }
  };

  const create = (makeNow: boolean) => guard(async () => {
    await onCreate({
      pieceId,
      universe: universe.trim(),
      variant: variant.trim(),
      placeDescription: place.trim(),
      ...(placePhoto ? { placePhotoPath: placePhoto, ...(enhance ? { enhancePlace: true } : {}) } : {}),
      animation: chosenAnimation,
      ...(refPath ? { animationRefPath: refPath } : {}),
      aspectRatio,
    }, makeNow);
    onClose();
  });

  const titles = [t('wizard.step.piece'), t('wizard.step.place'), profile.beats.alive[lang]];

  return (
    <div className="veil" role="dialog" aria-modal="true" aria-label={t('scenes.new')}>
      <div className="wizard glass">
        <header className="wizard-head">
          <h2>{t('scenes.new')}</h2>
          <ol className="stepper">
            {titles.map((label, i) => (
              <li key={i} className={i === step ? 'on' : can[i] ? 'done' : ''}>
                <button onClick={() => setStep(i as Step)} disabled={i > 0 && !can[i - 1]}>{i + 1}. {label}</button>
              </li>
            ))}
          </ol>
          <button className="close" onClick={onClose} aria-label={t('wizard.close')} disabled={busy}><X className="ico solo" aria-hidden /></button>
        </header>

        {step === 0 && (
          <div className="split pick">
            <section className="split-col">
              <h4>{t('wizard.piece.newTitle')}</h4>
              <DropZone compact title={t('wizard.piece.drop')} busy={busy || busyUpload} uploads={uploads}
                onFiles={(files) => void guard(async () => { const made = await onAddPieces(files); if (made[0]) setPieceId(made[0].id); })}
                onPick={() => void guard(async () => { const made = await onPickPiece(); if (made) setPieceId(made.id); })} />
            </section>
            <section className="split-col">
              <h4>{t('wizard.piece.pickTitle')}</h4>
              {usable.length === 0 ? <p className="muted small">{t('wizard.piece.none')}</p> : (
                <div className="tiles pick-tiles">
                  {usable.map((p) => (
                    <button key={p.id} className={`tile glass choice ${pieceId === p.id ? 'chosen' : ''}`} onClick={() => setPieceId(p.id)}>
                      <Thumb path={p.photoPath} alt={p.name} />
                      <span className="choice-label">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {step === 1 && (
          <div className="split">
            <section className={`split-col ${placePhoto ? 'dimmed' : ''}`}>
              <h4>{t('wizard.place.genTitle')}</h4>
              <span className="mini-label">{t('wizard.place.room')}</span>
              <div className="idea-row">
                {profile.placeIdeas.map((i) => (
                  <button key={i.id} className={`chip-tile glass ${roomId === i.id ? 'chosen' : ''}`} onClick={() => { setRoomId(i.id); compose(i.id, styleId); }}>{i.label[lang]}</button>
                ))}
                {/* Outside on the same line, after a marker: one more row would make the step scroll. */}
                {outdoorIdeas(profile).length > 0 && <span className="idea-sep">{t('wizard.place.outdoor')}</span>}
                {outdoorIdeas(profile).map((i) => (
                  <button key={i.id} className={`chip-tile glass ${roomId === i.id ? 'chosen' : ''}`} onClick={() => { setRoomId(i.id); compose(i.id, styleId); }}>{i.label[lang]}</button>
                ))}
              </div>
              <span className="mini-label">{t('wizard.place.style')}</span>
              <div className="idea-row">
                {STYLES.map((s) => (
                  <button key={s.id} className={`style-tile glass ${styleId === s.id ? 'chosen' : ''}`} onClick={() => { setStyleId(s.id); compose(roomId, s.id); }}>
                    <span className="swatch" aria-hidden>{s.swatch.map((c) => <i key={c} style={{ background: c }} />)}</span>
                    {s.label[lang]}
                  </button>
                ))}
              </div>
            </section>
            <section className="split-col">
              {/* What the choices compose, and the scene's names (they name the site's row), above the
                  other way: the person's own photo. Two balanced columns, no scroll. */}
              <label className={placePhoto ? 'dimmed' : ''}>{t('wizard.place.describe')}<textarea value={place} onChange={(e) => setPlace(e.target.value)} rows={2} maxLength={1500} placeholder={t('scenes.placeHint')} /></label>
              <div className="row names">
                <label>{t('scenes.universe')}<input value={universe} onChange={(e) => setUniverse(e.target.value)} placeholder={t('scenes.universeHint')} maxLength={60} /></label>
                <label>{t('scenes.variant')}<input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder={t('scenes.variantHint')} maxLength={60} /></label>
              </div>
              <h4 className="spaced">{t('wizard.place.photoTitle')}</h4>
              {placePhoto ? (
                <>
                <div className="ref-chosen glass">
                  <Thumb path={placePhoto} alt={t('wizard.place.photoTitle')} />
                  <span>{t(enhance ? 'wizard.photoEnhanced' : 'wizard.photoKept')}</span>
                  <button onClick={() => setPlacePhoto(undefined)}>{t('wizard.removeRef')}</button>
                </div>
                <label className="toggle-row">
                  <input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} />
                  <span><strong>{t('wizard.enhance')}</strong></span>
                </label>
                </>
              ) : (
                <DropZone compact title={t('wizard.place.photoDrop')} busy={busy}
                  onFiles={(files) => files[0] && void guard(async () => setPlacePhoto(await onSavePhoto(files[0]!)))}
                  onPick={() => void guard(async () => { const p = await onPickPhoto(); if (p) setPlacePhoto(p); })} />
              )}
            </section>
          </div>
        )}

        {step === 2 && (
          <div className="split">
            <section className="split-col">
              <h4>{t('wizard.alive.pickTitle')}</h4>
              <div className="idea-row">
                {profile.animations.map((a) => (
                  <button key={a.id} className={`chip-tile glass ${animation === a.id ? 'chosen' : ''}`} onClick={() => setAnimation(a.id)}>{a.label[lang]}</button>
                ))}
                {/* Company on the same line, after a marker, like the places elsewhere. */}
                {companionsFor(profile).length > 0 && <span className="idea-sep">{t('wizard.alive.company')}</span>}
                {companionsFor(profile).map((a) => (
                  <button key={a.id} className={`chip-tile glass ${animation === a.id ? 'chosen' : ''}`} onClick={() => setAnimation(a.id)}>{a.label[lang]}</button>
                ))}
                <button className={`chip-tile glass ${animation === '__own' ? 'chosen' : ''}`} onClick={() => setAnimation('__own')}>{t('scenes.ownAnimation')}</button>
              </div>
              {animation === '__own' && <input value={ownAnimation} onChange={(e) => setOwnAnimation(e.target.value)} placeholder={t('scenes.ownAnimationHint')} maxLength={300} />}
            </section>
            <section className="split-col">
              <h4>{t('wizard.alive.photoTitle')}</h4>
              {refPath ? (
                <div className="ref-chosen glass">
                  <Thumb path={refPath} alt={t('scenes.animationRefChosen')} />
                  <span>{t('wizard.photoKept')}</span>
                  <button onClick={() => setRefPath(undefined)}>{t('wizard.removeRef')}</button>
                </div>
              ) : (
                <DropZone compact title={t('wizard.dropRef')} busy={busy}
                  onFiles={(files) => files[0] && void guard(async () => setRefPath(await onSavePhoto(files[0]!)))}
                  onPick={() => void guard(async () => { const p = await onPickPhoto(); if (p) setRefPath(p); })} />
              )}
            </section>
          </div>
        )}

        {error && <p className="error small">{error}</p>}
        <footer className="wizard-foot">
          <span className="muted small">{step === 2 ? t('wizard.costNow') : ''}</span>
          <div className="row">
            {step > 0 && <button onClick={() => setStep((step - 1) as Step)} disabled={busy}>{t('wizard.back')}</button>}
            {step < 2 && <button className="primary" disabled={!can[step] || busy} onClick={() => setStep((step + 1) as Step)}>{t('wizard.next')}</button>}
            {step === 2 && (
              <>
                <button disabled={!can.every(Boolean) || busy} onClick={() => void create(false)}>{t('wizard.createOnly')}</button>
                <button className="primary" disabled={!can.every(Boolean) || busy} onClick={() => void create(true)}>{t('wizard.createAndMake')}</button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
