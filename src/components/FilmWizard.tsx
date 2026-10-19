import { RectangleHorizontal, RectangleVertical, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getLanguage, useI18n } from '../i18n';
import { pickImage } from '../data/host';
import { isUsablePhoto, saveDroppedPhoto } from '../data/photos';
import { newId } from '../model/records';
import type { Piece } from '../model/types';
import type { TradeProfile } from '../model/profiles';
import type { FilmStart } from '../hooks/useFilm';
import { useArmed } from '../hooks/useArmed';
import { DropZone } from './DropZone';
import { describeError, errorText } from './errors';
import { Thumb } from './Thumb';

type Step = 0 | 1 | 2 | 3;
/** Workshops to start from, in the site's words (locales film.workshop.ideas.*). */
const WORKSHOP_IDEAS = ['bright', 'wood', 'stone', 'concrete', 'garden'] as const;

/**
 * A new film in four steps, like a new scene (Tony: « faire une nouvelle
 * vidéo, tout le process comme la création de scène »):
 *
 * 1. The creation it shows (only one with a photo: the film draws the real piece).
 * 2. The workshop: in words | her own photo of it.
 * 3. How it comes alive.
 * 4. Her: her portrait (optional), the shape of the film, its name.
 *
 * Nothing is spent until the last button; « create and make » says how many
 * pictures and what they cost, and asks a second press.
 */
export function FilmWizard({ pieces, profile, aspectRatio, imageCount, imageCost, onClose, onCreate }: {
  pieces: Piece[];
  profile: TradeProfile;
  aspectRatio: string;
  /** The pictures « create and make » draws, and their price (null = not known). */
  imageCount: number;
  imageCost: string;
  onClose: () => void;
  onCreate: (start: FilmStart, makeNow: boolean) => Promise<void>;
}) {
  const { t, tc } = useI18n();
  const lang = getLanguage();
  const { armed, confirm } = useArmed();
  const [step, setStep] = useState<Step>(0);
  const [pieceId, setPieceId] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [workshopPhoto, setWorkshopPhoto] = useState<string | undefined>();
  const [animation, setAnimation] = useState(profile.animations[0]?.id ?? '');
  const [ownAnimation, setOwnAnimation] = useState('');
  const [animationRef, setAnimationRef] = useState<string | undefined>();
  const [portrait, setPortrait] = useState<string | undefined>();
  const [shape, setShape] = useState<'16:9' | '9:16'>(aspectRatio === '9:16' || aspectRatio === '3:4' ? '9:16' : '16:9');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const usable = pieces.filter((p) => p.photoPath);
  // The workshop may stay the trade's default: words are not required.
  // Her own words for it ('__own'), sent as they are in the instructions.
  const chosenAnimation = animation === '__own' ? ownAnimation.trim() : animation;
  const can = [!!pieceId, true, !!chosenAnimation, true];

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      console.warn('[vitrine-studio] film wizard step refused:', err);
      setError(errorText(describeError(err)));
    } finally {
      setBusy(false);
    }
  };
  /** A dropped or picked photo kept on disk; resolves its path, or null when cancelled. */
  const photo = async (file: File | null, stem: string): Promise<string | null> => {
    if (!file) return pickImage(t('pieces.photoFilter'));
    if (!isUsablePhoto(file)) throw new Error('NOT_A_PHOTO');
    return saveDroppedPhoto(file, newId(stem));
  };

  const create = (makeNow: boolean) => guard(async () => {
    await onCreate({
      name: name.trim(), pieceId, animation: chosenAnimation, workshopDescription: workshop.trim(), aspectRatio: shape,
      ...(workshopPhoto ? { workshopPhotoPath: workshopPhoto } : {}),
      ...(portrait ? { portraitPath: portrait } : {}),
      ...(animationRef ? { animationRefPath: animationRef } : {}),
    }, makeNow);
    onClose();
  });

  const titles = [t('wizard.step.piece'), t('film.workshop.title'), t('film.alive.title'), t('film.wizard.you')];

  return (
    <div className="veil" role="dialog" aria-modal="true" aria-label={t('film.wizard.title')}>
      <div className="wizard glass">
        <header className="wizard-head">
          <h2>{t('film.wizard.title')}</h2>
          <ol className="stepper">
            {titles.map((label, i) => (
              <li key={i} className={i === step ? 'on' : can[i] && i < step ? 'done' : ''}>
                <button onClick={() => setStep(i as Step)} disabled={i > 0 && !can.slice(0, i).every(Boolean)}>{i + 1}. {label}</button>
              </li>
            ))}
          </ol>
          <button className="close" onClick={onClose} aria-label={t('wizard.close')} disabled={busy}><X className="ico solo" aria-hidden /></button>
        </header>

        {step === 0 && (
          <div className="split one">
            <section className="split-col">
              <h4>{t('film.piece.title')}</h4>
              {usable.length === 0 ? <p className="muted small">{t('film.piece.none')}</p> : (
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
            <section className={`split-col ${workshopPhoto ? 'dimmed' : ''}`}>
              <h4>{t('wizard.place.describe')}</h4>
              {/* Examples to start from: a press writes the words, which stay hers to change. */}
              <div className="idea-row">
                {WORKSHOP_IDEAS.map((k) => {
                  const words = t(`film.workshop.ideaText.${k}`);
                  return <button key={k} className={`chip-tile glass ${workshop === words ? 'chosen' : ''}`} aria-pressed={workshop === words} onClick={() => setWorkshop(words)}>{t(`film.workshop.ideas.${k}`)}</button>;
                })}
              </div>
              <textarea rows={4} value={workshop} maxLength={1500} placeholder={t('film.workshop.placeholder')} onChange={(e) => setWorkshop(e.target.value)} />
            </section>
            <section className="split-col">
              <h4>{t('wizard.place.photoTitle')}</h4>
              {workshopPhoto ? (
                <div className="ref-chosen glass">
                  <Thumb path={workshopPhoto} alt={t('film.workshop.title')} />
                  <span>{t('wizard.photoKept')}</span>
                  <button onClick={() => setWorkshopPhoto(undefined)}>{t('wizard.removeRef')}</button>
                </div>
              ) : (
                <DropZone compact title={t('film.workshop.drop')} busy={busy}
                  onFiles={(files) => files[0] && void guard(async () => { const p = await photo(files[0]!, 'film-workshop'); if (p) setWorkshopPhoto(p); })}
                  onPick={() => void guard(async () => { const p = await photo(null, 'film-workshop'); if (p) setWorkshopPhoto(p); })} />
              )}
            </section>
          </div>
        )}

        {step === 2 && (
          <div className="split">
            <section className="split-col">
              <h4>{t('film.alive.title')}</h4>
              <div className="idea-row">
                {profile.animations.map((a) => (
                  <button key={a.id} className={`chip-tile glass ${animation === a.id ? 'chosen' : ''}`} onClick={() => setAnimation(a.id)}>{a.label[lang]}</button>
                ))}
                <button className={`chip-tile glass ${animation === '__own' ? 'chosen' : ''}`} onClick={() => setAnimation('__own')}>{t('scenes.ownAnimation')}</button>
              </div>
              {animation === '__own' && <input value={ownAnimation} maxLength={300} placeholder={t('scenes.ownAnimationHint')} autoFocus onChange={(e) => setOwnAnimation(e.target.value)} />}
            </section>
            <section className="split-col">
              <h4>{t('wizard.alive.photoTitle')}</h4>
              {animationRef ? (
                <div className="ref-chosen glass">
                  <Thumb path={animationRef} alt={t('scenes.animationRefChosen')} />
                  <span>{t('wizard.photoKept')}</span>
                  <button onClick={() => setAnimationRef(undefined)}>{t('wizard.removeRef')}</button>
                </div>
              ) : (
                <DropZone compact title={t('wizard.dropRef')} busy={busy}
                  onFiles={(files) => files[0] && void guard(async () => { const p = await photo(files[0]!, 'film-alive'); if (p) setAnimationRef(p); })}
                  onPick={() => void guard(async () => { const p = await photo(null, 'film-alive'); if (p) setAnimationRef(p); })} />
              )}
            </section>
          </div>
        )}

        {step === 3 && (
          <div className="split">
            <section className="split-col">
              <h4>{t('film.portrait.title')}</h4>
              {portrait ? (
                <div className="ref-chosen glass">
                  <Thumb path={portrait} alt={t('film.portrait.title')} />
                  <span>{t('wizard.photoKept')}</span>
                  <button onClick={() => setPortrait(undefined)}>{t('wizard.removeRef')}</button>
                </div>
              ) : (
                <DropZone compact title={t('film.portrait.drop')} busy={busy}
                  onFiles={(files) => files[0] && void guard(async () => { const p = await photo(files[0]!, 'film-portrait'); if (p) setPortrait(p); })}
                  onPick={() => void guard(async () => { const p = await photo(null, 'film-portrait'); if (p) setPortrait(p); })} />
              )}
            </section>
            <section className="split-col">
              <h4>{t('film.wizard.shape')}</h4>
              <div className="idea-row">
                {(['16:9', '9:16'] as const).map((s) => {
                  const Icon = s === '16:9' ? RectangleHorizontal : RectangleVertical;
                  return (
                    <button key={s} className={`chip-tile glass ${shape === s ? 'chosen' : ''}`} aria-pressed={shape === s} onClick={() => setShape(s)}>
                      <Icon className="ico" aria-hidden />{t(`film.wizard.shapes.${s === '16:9' ? 'wide' : 'tall'}`)}
                    </button>
                  );
                })}
              </div>
              <label>{t('film.wizard.name')}<input value={name} maxLength={80} placeholder={t('film.wizard.nameHint')} onChange={(e) => setName(e.target.value)} /></label>
            </section>
          </div>
        )}

        {error && <p className="error small">{error}</p>}
        <footer className="wizard-foot">
          <span className="muted small">{step === 3 ? t('wizard.costNow') : ''}</span>
          <div className="row">
            {step > 0 && <button onClick={() => setStep((step - 1) as Step)} disabled={busy}>{t('wizard.back')}</button>}
            {step < 3 && <button className="primary" disabled={!can[step] || busy} onClick={() => setStep((step + 1) as Step)}>{t('wizard.next')}</button>}
            {step === 3 && (
              <>
                <button disabled={!can.every(Boolean) || busy} onClick={() => void create(false)}>{t('wizard.createOnly')}</button>
                <button className={`primary ${armed === 'make' ? 'armed' : ''}`} disabled={!can.every(Boolean) || busy} onClick={() => confirm('make', () => void create(true))}>
                  {armed === 'make' ? t('studio.confirm') : `${tc('film.wizard.createAndMake', imageCount)} · ${imageCost}`}
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
