import { Camera, Clapperboard, Copy, Globe, ImagePlus, Paintbrush, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getLanguage, useI18n } from '../i18n';
import { generateImage, MODEL_FOR_QUALITY, pickImage, readMedia } from '../data/host';
import { conformTo, frameSize } from '../data/frames';
import { conformKeyframes, makeKeyframe, startFilmClip, type FilmDeps } from '../data/makeFilm';
import { CLIP_SECONDS, type ClipDeps } from '../data/makeClip';
import { isUsablePhoto, saveDroppedPhoto, saveImageBase64 } from '../data/photos';
import { decorPrompt, filmOf, filmPrompts } from '../model/film';
import { PromptEditor } from './PromptEditor';
import { clipsToMake, filmComplete, filmWithoutFrom, nextKeyframe, withCut, withKeyframe, type Cut, type Film } from '../model/filmRecord';
import { FilmJoins, FilmParts } from './FilmParts';
import { useClipSources } from '../hooks/useClipSources';
import { FilmExport } from './FilmExport';
import { newId } from '../model/records';
import type { TradeProfile } from '../model/profiles';
import type { Piece, StudioSettings } from '../model/types';
import { describeError, errorText } from './errors';
import { DropZone } from './DropZone';
import { Thumb } from './Thumb';
import { useArmed } from '../hooks/useArmed';
import { ClipMaking } from './ClipMaking';
import { estimateClip, estimateImage, formatUsd } from '../model/costs';

const filmDeps: FilmDeps = {
  generate: generateImage,
  modelFor: (q) => MODEL_FOR_QUALITY[q],
  sizeOf: async (path) => frameSize(await readMedia(path)),
  conform: async (path, size, stem) => saveImageBase64(`${stem}.png`, await conformTo(await readMedia(path), size)),
  now: () => new Date(),
};

/** What the panel is doing right now. The clips being made live in the film itself (`clipJobs`). */
interface Work { making?: string; makingAt?: string; conforming?: boolean; starting?: boolean; error?: { key: string; raw?: string } }

/**
 * The home film (doc 145 §10.7): what the person gives (their workshop, their
 * portrait, a piece, the living), the keyframes, then the clips. Two paid
 * gestures, each saying what it spends before it spends it.
 *
 * The latest film, its writes and the clips' follow-up live in App, which
 * never unmounts: a clip takes minutes and the person switches tabs meanwhile.
 * A follow-up owned by this panel would start twice on its return (the host
 * forgets a finished job after ONE read, so the second one reports a clip lost
 * that actually arrived) and would write a stale film over the new one.
 */
export function FilmPanel({ films, onPickFilm, onNewFilm, onRemoveFilm, onDuplicateFilm, startMaking, onStarted, film, getFilm, updateFilm, followClip, onSite, clipDeps, clipError, profile, pieces, quality, advanced, spendImage, folder }: {
  /** Every film of the studio, this one among them. */
  films: Film[];
  onPickFilm: (id: string) => void;
  onNewFilm: () => void;
  /** Opens the question before this film leaves the studio. */
  onRemoveFilm: () => void;
  /** A copy of this film, opened (named by the panel). */
  onDuplicateFilm: (name: string) => void;
  /** Just made by the wizard with « create and make »: the pictures start once, on arrival. */
  startMaking: boolean;
  onStarted: () => void;
  film: Film;
  /** The latest film, not the one of this render. */
  getFilm: () => Film;
  /** Applies a change to the latest film and writes film.json. Resolves false when the write failed. */
  updateFilm: (change: (f: Film) => Film) => Promise<boolean>;
  /** Follows a started clip to its end, once per job, in App. */
  followClip: (stepId: string, job: { id: string; startedAt: string }) => void;
  /** Puts this film on the website (taking any other off), or takes it off. */
  onSite: (on: boolean) => Promise<boolean>;
  clipDeps: ClipDeps;
  /** The last clip that ended without a clip. */
  clipError: { key: string; raw?: string } | null;
  profile: TradeProfile;
  pieces: Piece[];
  quality: StudioSettings['quality'];
  /** Advanced mode: the instructions are shown and can be rewritten. */
  advanced: boolean;
  /** Draws a picture and writes its debit in the project's costs. */
  spendImage: FilmDeps['generate'];
  /** The studio's folder: the film's file is written in its `film/`. */
  folder: string;
}) {
  const { t, tc } = useI18n();
  // Every picture or clip here is paid: a second press confirms.
  const { armed, confirm } = useArmed();
  const lang = getLanguage();
  const steps = filmOf(profile).steps;
  const [work, setWork] = useState<Work>({});
  const [workshop, setWorkshop] = useState(film.workshopDescription);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const update = updateFilm;
  const failed = (err: unknown) => {
    console.warn('[vitrine-studio] film:', err);
    if (alive.current) setWork({ error: describeError(err) });
  };

  const piece = pieces.find((p) => p.id === film.pieceId);
  const withPhoto = pieces.filter((p) => p.photoPath);
  const busy = !!work.making || !!work.conforming || !!work.starting;
  const running = Object.keys(film.clipJobs).length > 0;
  const missingKeys = steps.filter((s) => !film.keyframes[s.id]).length;
  const toClip = clipsToMake(film, steps);
  const complete = filmComplete(film, steps);
  const ready = !!piece && !!film.animation.trim();
  const hasClips = Object.keys(film.clips).length > 0;
  // The part shown in the editor; its joins are drawn in the other column.
  const [chosenPart, setChosenPart] = useState<string | null>(null);
  const clipSources = useClipSources(steps.slice(1).map((s) => film.clips[s.id]).filter((p): p is string => !!p));
  // Once the pictures have started, what the person gave folds into one line: the work takes the screen.
  // Open only while something the film needs is missing: a film from the wizard already has it.
  const [prepOpen, setPrepOpen] = useState(() => !film.pieceId || !film.animation.trim());
  // A picture still to draw while the chain is being made: it waits its turn, shimmering.
  const waiting = (id: string) => !film.keyframes[id] && !!work.making;
  const animationLabel = profile.animations.find((a) => a.id === film.animation)?.label[lang];
  // The picture whose gestures are shown under the chain (its décor, her photo, its video, its instructions).
  const [selected, setSelected] = useState<string | null>(null);
  const [decor, setDecor] = useState<{ step: string; words: string } | null>(null);

  // ── The pictures ────────────────────────────────────────────────────────

  const makeImages = async () => {
    setWork({});
    try {
      for (let step = nextKeyframe(getFilm(), steps); step; step = nextKeyframe(getFilm(), steps)) {
        const current = step;
        setWork({ making: current.id, makingAt: new Date().toISOString() });
        const made = await makeKeyframe(getFilm(), current, piece, profile, quality, { ...filmDeps, generate: spendImage });
        // Only this keyframe is taken from `made`: a clip finishing meanwhile keeps its own write.
        const written = await update((f) => ({ ...f, keyframes: { ...f.keyframes, [current.id]: made.keyframes[current.id]! }, conformed: made.conformed, validated: false }));
        // Nothing more is spent while film.json is not being written: the notice already says so.
        if (!written) {
          if (alive.current) setWork({});
          return;
        }
        if (!alive.current) return;
      }
      setWork({});
    } catch (err) {
      failed(err);
    }
  };

  // « Create and make » from the wizard: once, on arrival (the wizard already asked its second press).
  const started = useRef(false);
  useEffect(() => {
    if (!startMaking || started.current) return;
    started.current = true;
    onStarted();
    void makeImages();
    // makeImages reads the latest film through getFilm; once per arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMaking]);

  const remake = async (stepId: string) => {
    await update((f) => filmWithoutFrom(f, stepId, steps));
    await makeImages();
  };

  /** Her words change this picture's setting; the pictures after it are made again from it. */
  const changeDecor = async (stepId: string, words: string) => {
    const path = getFilm().keyframes[stepId];
    if (!path || !words.trim()) return;
    setWork({ making: stepId, makingAt: new Date().toISOString() });
    try {
      const made = await spendImage({ prompt: decorPrompt(words), modelId: MODEL_FOR_QUALITY[quality], editImagePath: path, aspectRatio: getFilm().aspectRatio });
      if (!(await update((f) => withKeyframe(f, stepId, made.path, steps)))) { if (alive.current) setWork({}); return; }
      if (alive.current) setDecor(null);
      await makeImages();
    } catch (err) {
      failed(err);
    }
  };

  /** Her own photo in place of this picture, as it is: free; the pictures after it wait for the next press. */
  const ownPhoto = async (stepId: string) => {
    try {
      const path = await pickImage(t('pieces.photoFilter'));
      if (path) await update((f) => withKeyframe(f, stepId, path, steps, true));
    } catch (err) {
      failed(err);
    }
  };

  /** One part's video, made again (or made) alone. */
  const remakeClip = async (stepId: string) => {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;
    setWork({ conforming: true });
    try {
      const sized = await conformKeyframes(getFilm(), steps, filmDeps);
      await update((f) => ({ ...f, conformed: sized.conformed }));
      setWork({ starting: true });
      const started = await startFilmClip(getFilm(), step, piece, profile, clipDeps);
      const job = started.clipJobs[step.id]!;
      await update((f) => {
        const { [step.id]: _old, ...clips } = f.clips;
        const { [step.id]: _cut, ...cuts } = f.cuts;
        return { ...f, clips, cuts, clipJobs: { ...f.clipJobs, [step.id]: job }, validated: false };
      });
      followClip(step.id, job);
      if (alive.current) setWork({});
    } catch (err) {
      failed(err);
    }
  };

  // ── The clips ───────────────────────────────────────────────────────────

  const makeFilm = async () => {
    setWork({ conforming: true });
    try {
      const sized = await conformKeyframes(getFilm(), steps, filmDeps);
      await update((f) => ({ ...f, conformed: sized.conformed }));
      setWork({ starting: true });
      for (const step of clipsToMake(getFilm(), steps)) {
        const started = await startFilmClip(getFilm(), step, piece, profile, clipDeps);
        const job = started.clipJobs[step.id]!;
        await update((f) => {
          const { [step.id]: _old, ...clips } = f.clips;
          return { ...f, clips, clipJobs: { ...f.clipJobs, [step.id]: job }, validated: false };
        });
        followClip(step.id, job);
      }
      if (alive.current) setWork({});
    } catch (err) {
      failed(err);
    }
  };

  /** Her own instruction for a picture or a video, or back to the trade's (`undefined`). */
  const setPrompt = (key: string, own: string | undefined) => {
    const [stepId, kind] = key.split(':') as [string, 'image' | 'clip'];
    void update((f) => {
      const step = { ...f.prompts[stepId] };
      if (own === undefined) delete step[kind];
      else step[kind] = own;
      const prompts = { ...f.prompts };
      if (Object.keys(step).length) prompts[stepId] = step;
      else delete prompts[stepId];
      return { ...f, prompts };
    });
  };

  // ── What the person gives ───────────────────────────────────────────────

  const setPhoto = async (field: 'workshopPhotoPath' | 'portraitPath', file: File | null) => {
    try {
      let path: string | null;
      if (file) {
        if (!isUsablePhoto(file)) throw new Error('NOT_A_PHOTO');
        path = await saveDroppedPhoto(file, newId(field === 'portraitPath' ? 'film-portrait' : 'film-workshop'));
      } else {
        path = await pickImage(t('pieces.photoFilter'));
      }
      if (path) await update((f) => ({ ...f, [field]: path }));
    } catch (err) {
      failed(err);
    }
  };
  const clearPhoto = (field: 'workshopPhotoPath' | 'portraitPath') => update((f) => {
    const next = { ...f };
    delete next[field];
    return next;
  });

  return (
    <section className="settings film">
      {/* Her films: one is open; switching waits for the pictures being made (they are drawn by this panel). */}
      <div className="film-list full">
        {films.map((f, n) => {
          const first = steps[0] && f.keyframes[steps[0].id];
          return (
            <div key={f.id} className="film-tile-wrap">
              <button className={`tile glass choice film-tile ${f.id === film.id ? 'chosen' : ''}`} aria-pressed={f.id === film.id} disabled={busy && f.id !== film.id} onClick={() => onPickFilm(f.id)}>
                <Thumb path={first} alt={f.name || t('film.untitled', { n: n + 1 })} empty={'—'} />
                <span className="choice-label">{f.name || t('film.untitled', { n: n + 1 })}</span>
                {f.validated && f.id !== film.id && <span className="film-badge film-on-site"><Globe className="ico" aria-hidden />{t('film.onSite')}</span>}
              </button>
              {/* The site's film is chosen here, on the film open: a switch on its tile (one film on the site; this takes the other off). */}
              {f.id === film.id && (
                <button className={`film-site-toggle ${film.validated ? 'on' : ''}`} aria-pressed={film.validated} disabled={(!complete && !film.validated) || running}
                  data-tip={!complete && !film.validated ? t('film.siteNotReady') : undefined} onClick={() => void onSite(!film.validated)}>
                  <Globe className="ico" aria-hidden /><span>{t(film.validated ? 'film.onSite' : 'film.putOnSite')}</span><i className="film-switch" aria-hidden />
                </button>
              )}
              {/* Only the open film is removed, never the one on the site, never while it is being made. */}
              {f.id === film.id && (
                <button className="icon-btn glass film-copy" disabled={busy || running} aria-label={t('film.duplicate')} data-tip={t('film.duplicateTip')}
                  onClick={() => onDuplicateFilm(t('film.copyName', { name: f.name || t('film.untitled', { n: n + 1 }) }))}>
                  <Copy className="ico solo" aria-hidden />
                </button>
              )}
              {f.id === film.id && (
                <button className="icon-btn glass film-remove" disabled={busy || running || film.validated}
                  aria-label={t('film.remove.button')} data-tip={t(film.validated ? 'film.remove.onSite' : running ? 'film.remove.running' : 'film.remove.button')} onClick={onRemoveFilm}>
                  <Trash2 className="ico solo" aria-hidden />
                </button>
              )}
            </div>
          );
        })}
        <button className="tile glass choice film-tile film-new" disabled={busy} onClick={onNewFilm}>
          <Plus className="ico" aria-hidden /><span className="choice-label">{t('film.new')}</span>
        </button>
      </div>
      {!prepOpen && (
        <div className="glass card-pad full film-prep-line">
          <span className="small">
            <strong>{piece?.name ?? t('film.piece.title')}</strong>
            {animationLabel ? ` · ${animationLabel}` : ''}
            {` · ${t(film.workshopPhotoPath ? 'film.prep.workshopPhoto' : 'film.prep.workshopWords')}`}
            {film.portraitPath ? ` · ${t('film.prep.portrait')}` : ''}
          </span>
          <button onClick={() => setPrepOpen(true)}>{t('film.prep.edit')}</button>
        </div>
      )}
      {prepOpen && (
        <>
          <div className="film-inputs full">
            <div className="glass card-pad">
              <h4>{t('film.workshop.title')}</h4>
              {film.workshopPhotoPath ? (
                <div className="row">
                  <Thumb path={film.workshopPhotoPath} alt={t('film.workshop.title')} />
                  <button className="link" disabled={busy} onClick={() => void clearPhoto('workshopPhotoPath')}>{t('film.photo.remove')}</button>
                </div>
              ) : (
                <>
                  <textarea rows={3} value={workshop} disabled={busy} placeholder={t('film.workshop.placeholder')} maxLength={1500}
                    onChange={(e) => setWorkshop(e.target.value)} onBlur={() => void update((f) => ({ ...f, workshopDescription: workshop }))} />
                  <DropZone compact title={t('film.workshop.drop')} busy={busy}
                    onFiles={(files) => files[0] && void setPhoto('workshopPhotoPath', files[0])} onPick={() => void setPhoto('workshopPhotoPath', null)} />
                </>
              )}
            </div>

            <div className="glass card-pad">
              <h4>{t('film.portrait.title')}</h4>
              {film.portraitPath ? (
                <div className="row">
                  <Thumb path={film.portraitPath} alt={t('film.portrait.title')} />
                  <button className="link" disabled={busy} onClick={() => void clearPhoto('portraitPath')}>{t('film.photo.remove')}</button>
                </div>
              ) : (
                <DropZone compact title={t('film.portrait.drop')} busy={busy}
                  onFiles={(files) => files[0] && void setPhoto('portraitPath', files[0])} onPick={() => void setPhoto('portraitPath', null)} />
              )}
            </div>

            <div className="glass card-pad">
              <h4>{t('film.piece.title')}</h4>
              {withPhoto.length === 0 ? <p className="warn small">{t('film.piece.none')}</p> : (
                <div className="idea-row">
                  {withPhoto.map((p) => (
                    <button key={p.id} className={`chip-tile glass ${film.pieceId === p.id ? 'chosen' : ''}`} disabled={busy} onClick={() => void update((f) => ({ ...f, pieceId: p.id }))}>{p.name}</button>
                  ))}
                </div>
              )}
              <h4 className="spaced">{t('film.alive.title')}</h4>
              <div className="idea-row">
                {profile.animations.map((a) => (
                  <button key={a.id} className={`chip-tile glass ${film.animation === a.id ? 'chosen' : ''}`} disabled={busy} onClick={() => void update((f) => ({ ...f, animation: a.id }))}>{a.label[lang]}</button>
                ))}
              </div>
            </div>
          </div>
          {Object.keys(film.keyframes).length > 0 && <div className="row full"><button className="link" onClick={() => setPrepOpen(false)}>{t('film.prep.fold')}</button></div>}
        </>
      )}

      <div className="glass card-pad full">
        <h3>{t('film.title')}</h3>
        {/* Wide screens: the work (the parts, their joins) on the left, the chain and its
            gestures in a column on the right, instead of one long scroll. */}
        <div className={`film-board ${hasClips ? 'with-parts' : ''}`}>
          {hasClips && (
            <div className="film-main">
              <FilmParts film={film} steps={steps} chosen={chosenPart} onChoose={(id) => { setChosenPart(id); setSelected(id); }} srcs={clipSources.srcs} error={clipSources.error}
                onCut={(stepId, cut, duration) => void update((f) => withCut(f, stepId, cut, duration))} />
            </div>
          )}
          <div className="film-side">
            <div className="film-strip">
              {steps.map((s, i) => (
                <figure key={s.id} className={`film-step ${selected === s.id ? 'picked' : ''}`}>
                  {/* A press on the picture opens its gestures below the chain. */}
                  <button className={`film-step-pick ${waiting(s.id) ? 'waiting' : ''}`} aria-pressed={selected === s.id} aria-label={s.label[lang]} onClick={() => { setSelected(selected === s.id ? null : s.id); if (i > 0 && film.clips[s.id]) setChosenPart(s.id); }}>
                    <Thumb path={film.keyframes[s.id]} alt={s.label[lang]} empty={waiting(s.id) ? '' : '—'} />
                    {/* The picture being drawn, or the part's video being made: the studio's film running over it, with its clock. */}
                    {work.making === s.id && <ClipMaking compact icon={Camera} startedAt={work.makingAt} title={t('film.making')} />}
                    {film.clipJobs[s.id] && work.making !== s.id && <ClipMaking compact startedAt={film.clipJobs[s.id]!.startedAt} />}
                  </button>
                  <figcaption>
                    <span className="small">{i + 1}. {s.label[lang]}</span>
                    {film.clips[s.id] && <span className="film-badge"><Clapperboard className="ico" aria-hidden />{t('clip.badge')}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
            {selected && (() => {
              const i = steps.findIndex((s) => s.id === selected);
              const s = steps[i];
              if (!s) return null;
              const has = !!film.keyframes[s.id];
              const imageCost = estimateImage(MODEL_FOR_QUALITY[quality]);
              const later = steps.length - i - 1;
              const clipReady = i > 0 && has && !!film.keyframes[steps[i - 1]!.id] && !film.clipJobs[s.id];
              const idle = !busy && !running;
              const auto = filmPrompts({ profile, workshopDescription: film.workshopDescription, fromPhoto: !!film.workshopPhotoPath, hasPortrait: !!film.portraitPath, ...(piece?.description ? { pieceDescription: piece.description } : {}), animation: film.animation });
              return (
                <div className="glass card-pad film-step-tools">
                  <strong>{i + 1}. {s.label[lang]}</strong>
                  <div className="film-step-actions">
                    {has && <button className={armed === `remake-${s.id}` ? 'armed' : ''} disabled={!idle} data-tip={t('film.step.redoTip')} onClick={() => confirm(`remake-${s.id}`, () => void remake(s.id))}>
                      <RotateCcw className="ico" aria-hidden />{t(armed === `remake-${s.id}` ? 'studio.confirm' : 'film.step.redo')}</button>}
                    {has && <button className={decor?.step === s.id ? 'chosen' : ''} aria-pressed={decor?.step === s.id} disabled={!idle} onClick={() => setDecor(decor?.step === s.id ? null : { step: s.id, words: '' })}>
                      <Paintbrush className="ico" aria-hidden />{t('film.step.decor')}</button>}
                    <button disabled={!idle} data-tip={t('film.step.ownPhotoTip')} onClick={() => void ownPhoto(s.id)}><ImagePlus className="ico" aria-hidden />{t('film.step.ownPhoto')}</button>
                    {clipReady && <button className={armed === `clip-${s.id}` ? 'armed' : ''} disabled={!idle} onClick={() => confirm(`clip-${s.id}`, () => void remakeClip(s.id))}>
                      <Clapperboard className="ico" aria-hidden />{armed === `clip-${s.id}` ? t('studio.confirm') : t(film.clips[s.id] ? 'film.step.clip' : 'film.step.newClip', { cost: formatUsd(estimateClip(CLIP_SECONDS), lang) })}</button>}
                  </div>
                  {decor?.step === s.id && (
                    <div className="film-decor">
                      <textarea rows={2} value={decor.words} maxLength={600} placeholder={t('film.step.decorHint')} onChange={(e) => setDecor({ step: s.id, words: e.target.value })} />
                      <button className={`primary ${armed === `decor-${s.id}` ? 'armed' : ''}`} disabled={!idle || !decor.words.trim()}
                        onClick={() => confirm(`decor-${s.id}`, () => void changeDecor(s.id, decor.words))}>
                        <Paintbrush className="ico" aria-hidden />{armed === `decor-${s.id}` ? t('studio.confirm') : t('film.step.decorDo', { cost: imageCost === null ? '—' : formatUsd(imageCost * (1 + later), lang) })}
                      </button>
                    </div>
                  )}
                  <PromptEditor items={[
                    { key: `${s.id}:image`, label: `${i + 1}. ${s.label[lang]}`, auto: auto[i]!.prompt, own: film.prompts[s.id]?.image },
                    ...(auto[i]!.clip ? [{ key: `${s.id}:clip`, label: `${i}→${i + 1} · ${t('clip.badge')}`, auto: auto[i]!.clip, own: film.prompts[s.id]?.clip }] : []),
                  ]} disabled={busy} onChange={setPrompt} />
                </div>
              );
            })()}
            <div className="row spaced">
              {missingKeys > 0 && (
                <button className={`primary ${armed === 'images' ? 'armed' : ''}`} disabled={busy || running || !ready} onClick={() => confirm('images', () => void makeImages())} title={t('film.imagesCost')}>
                  {armed === 'images' ? t('studio.confirm') : tc('film.makeImages', missingKeys)}
                </button>
              )}
              {missingKeys === 0 && toClip.length > 0 && (
                <button className={`primary ${armed === 'film' ? 'armed' : ''}`} disabled={busy || running} onClick={() => confirm('film', () => void makeFilm())}>
                  <Clapperboard className="ico" aria-hidden />{armed === 'film' ? t('studio.confirm') : tc('film.makeFilm', toClip.length, { cost: formatUsd(toClip.length * estimateClip(CLIP_SECONDS), lang) })}
                </button>
              )}
            </div>
            {!ready && missingKeys > 0 && <p className="muted small">{t('film.notReady')}</p>}
            {work.conforming && <p className="small"><span className="spinner small-spin" aria-hidden /> {t('film.conforming')}</p>}
            {work.starting && <p className="small"><span className="spinner small-spin" aria-hidden /> {t('film.starting')}</p>}
            {work.error && <p className="error small">{errorText(work.error)}</p>}
            {clipError && !running && <p className="error small">{errorText(clipError)}</p>}
            {hasClips && <FilmJoins film={film} steps={steps} chosen={chosenPart} srcs={clipSources.srcs} />}
            {complete && <FilmPreview clips={steps.slice(1).map((s) => ({ path: film.clips[s.id]!, cut: film.cuts[s.id] }))} />}
            {complete && (
              <div className="film-export-box">
                <h4>{t('film.export.title')}</h4>
                <FilmExport film={film} steps={steps} folder={folder} />
              </div>
            )}
          </div>
        </div>
        {advanced && (() => {
          const auto = filmPrompts({ profile, workshopDescription: film.workshopDescription, fromPhoto: !!film.workshopPhotoPath, hasPortrait: !!film.portraitPath, ...(piece?.description ? { pieceDescription: piece.description } : {}), animation: film.animation });
          const items = steps.flatMap((s, i) => [
            { key: `${s.id}:image`, label: `${i + 1}. ${s.label[lang]}`, auto: auto[i]!.prompt, own: film.prompts[s.id]?.image },
            ...(auto[i]!.clip ? [{ key: `${s.id}:clip`, label: `${i}→${i + 1} · ${t('clip.badge')}`, auto: auto[i]!.clip, own: film.prompts[s.id]?.clip }] : []),
          ]);
          return <PromptEditor items={items} disabled={busy} onChange={setPrompt} />;
        })()}
      </div>
    </section>
  );
}

/** Plays the clips one after the other, each from its cut's start to its end, as the website will. */
function FilmPreview({ clips }: { clips: Array<{ path: string; cut?: Cut }> }) {
  const { t } = useI18n();
  const [srcs, setSrcs] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const load = async () => {
    setError(null);
    try {
      setSrcs(await Promise.all(clips.map((c) => readMedia(c.path))));
      setIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  if (!srcs) return (
    <div className="spaced">
      <button onClick={() => void load()}><Play className="ico" aria-hidden />{t('film.watch')}</button>
      {error && <p className="error small">{t('thumb.unreadable')} ({error})</p>}
    </div>
  );
  const cut = clips[index]?.cut;
  const nextPart = () => { if (index + 1 < srcs.length) setIndex(index + 1); };
  return (
    <video key={index} className="film-preview spaced" src={srcs[index]} autoPlay muted playsInline controls
      onLoadedMetadata={(e) => { if (cut) e.currentTarget.currentTime = cut.in; }}
      // The part's end, image by image where the browser draws them, and on each time update as a net.
      onPlaying={(e) => {
        const v = e.currentTarget;
        if (!cut || !v.requestVideoFrameCallback) return;
        const watch: VideoFrameRequestCallback = (_now, m) => { if (m.mediaTime >= cut.out - 0.02) { v.pause(); nextPart(); } else if (!v.paused) v.requestVideoFrameCallback(watch); };
        v.requestVideoFrameCallback(watch);
      }}
      onTimeUpdate={(e) => { if (cut && e.currentTarget.currentTime >= cut.out - 0.02) { e.currentTarget.pause(); nextPart(); } }}
      onEnded={nextPart} />
  );
}
