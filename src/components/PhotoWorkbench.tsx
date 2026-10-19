import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Coins, Palette, Scissors, Sparkles, Trash2, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { readImage, type GenerateRequest } from '../data/host';
import { BACKDROP_KEYS, BACKDROPS, backdropPrompt, cutOut, onPlainColour, PLAIN_COLOURS } from '../data/photoEdit';
import { newId } from '../model/records';
import type { Piece } from '../model/types';
import type { PieceShow } from '../model/showcase';
import { useArmed } from '../hooks/useArmed';
import { ClipMaking } from './ClipMaking';
import { Thumb } from './Thumb';
import { ZoomStage } from './ZoomStage';
import { describeError, errorText } from './errors';

type Work = 'cutout' | 'plain' | 'backdrop';

/**
 * A creation's photo made better (Tony: « refaire l'image, sur plusieurs
 * niveaux »): the photo large on the left, three tools on the right from free
 * to paid, its versions below. Every result is a new version; the photo
 * before it is one click away.
 */
export function PhotoWorkbench({ piece, size, imageModel, siteColour, spend, onImprove, onKeepCutout, onChoose, onDrop, onClose }: {
  piece: Piece;
  /** Her measures of the piece: the new background keeps it at scale. */
  size?: PieceShow['size'];
  imageModel: string;
  /** The site's background colour, offered among the plain ones. */
  siteColour: string;
  /** The paid edit, debited on this piece's line in Costs. */
  spend: (req: GenerateRequest) => Promise<{ path: string }>;
  /** `base` is the piece as the last step left it: a cut-out just kept is never lost by the next save. */
  onImprove: (base: Piece, path: string) => Promise<Piece | null>;
  onKeepCutout: (base: Piece, cutout: NonNullable<Piece['cutout']>) => Promise<Piece | null>;
  onChoose: (path: string) => void;
  onDrop: (path: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { armed, confirm } = useArmed();
  const [work, setWork] = useState<{ kind: Work; at: string } | null>(null);
  // The refusal stays beside the tool that met it, and a done job says so: nothing ever ends in silence.
  const [error, setError] = useState<{ kind: Work; key: string; raw?: string } | null>(null);
  const [done, setDone] = useState<Work | null>(null);
  const [colour, setColour] = useState(PLAIN_COLOURS[1]!);
  const [shadow, setShadow] = useState(true);
  const [backdrop, setBackdrop] = useState(BACKDROP_KEYS[0]!);
  const [own, setOwn] = useState('');
  const photo = piece.photoPath;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !work) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [work, onClose]);

  const run = async (kind: Work, job: () => Promise<void>) => {
    setWork({ kind, at: new Date().toISOString() });
    setError(null);
    setDone(null);
    try {
      await job();
      setDone(kind);
    } catch (err) {
      console.error('[vitrine-studio] the photo was not improved:', err);
      setError({ kind, ...describeError(err) });
    } finally {
      setWork(null);
    }
  };

  /**
   * The piece lifted off the photo shown: the one already made (for that photo, or the photo IS
   * the cut-out), or made now (free). The cut-out stays tied to the photo it came from, so going
   * back to that photo never pays the matte twice.
   */
  const cutoutOf = async (current: Piece): Promise<{ path: string; piece: Piece }> => {
    if (current.cutout && (current.cutout.from === current.photoPath || current.cutout.path === current.photoPath)) return { path: current.cutout.path, piece: current };
    const path = await cutOut(current.photoPath!);
    const kept = await onKeepCutout(current, { from: current.photoPath!, path });
    if (!kept) throw new Error('WRITE_FAILED');
    return { path, piece: kept };
  };
  /** A version shown only once it is written: a refused write is said here, never a ✓. */
  const improve = async (base: Piece, path: string) => {
    if (!(await onImprove(base, path))) throw new Error('WRITE_FAILED');
  };

  const doCutout = () => run('cutout', async () => {
    const cut = await cutoutOf(piece);
    await improve(cut.piece, cut.path);
  });
  const doPlain = () => run('plain', async () => {
    const cut = await cutoutOf(piece);
    await improve(cut.piece, await onPlainColour(cut.path, colour, shadow, readImage, newId(`${piece.id}-plain`)));
  });
  const doBackdrop = () => run('backdrop', async () => {
    const where = own.trim() || BACKDROPS[backdrop]!;
    const made = await spend({ prompt: backdropPrompt(where, size), editImagePath: photo!, modelId: imageModel });
    await improve(piece, made.path);
  });

  /** What happened to this tool's last job: its refusal, or that the new version is there. */
  const said = (kind: Work) => (error?.kind === kind ? <p className="error small">{errorText(error)}</p>
    : done === kind ? <p className="ok small">✓ {t('photo.done')}</p> : null);

  const colours = [...new Set([...PLAIN_COLOURS, siteColour.toLowerCase()])];
  const versions = piece.photoTakes ?? [];

  return createPortal(
    <div className="veil photo-bench-veil" role="dialog" aria-modal="true" aria-label={t('photo.title', { name: piece.name })}>
      <div className="photo-bench glass">
        <button className="icon-btn glass bench-close" aria-label={t('wizard.close')} data-tip={t('wizard.close')} disabled={!!work} onClick={onClose}><X className="ico solo" aria-hidden /></button>
        <div className="bench-stage">
          <ZoomStage resetKey={photo}><Thumb path={photo} alt={piece.name} /></ZoomStage>
          {work && <ClipMaking startedAt={work.at} icon={work.kind === 'backdrop' ? Sparkles : work.kind === 'plain' ? Palette : Scissors} title={t(`photo.making.${work.kind}`)} />}
        </div>
        <div className="bench-tools">
          <h2>{piece.name}</h2>

          <section className="bench-tool glass">
            <header><Scissors className="ico" aria-hidden /><strong>{t('photo.cutout')}</strong><span className="badge free">{t('photo.free')}</span></header>
            <button className="primary" disabled={!!work || !photo} onClick={() => void doCutout()}>{t('photo.cutoutDo')}</button>
            {said('cutout')}
          </section>

          <section className="bench-tool glass">
            <header><Palette className="ico" aria-hidden /><strong>{t('photo.plain')}</strong><span className="badge free">{t('photo.free')}</span></header>
            <div className="ms-colors">
              {colours.map((c) => (
                <button key={c} className={`ms-swatch ${colour === c ? 'chosen' : ''}`} style={{ background: c }} aria-label={c} data-tip={c === siteColour.toLowerCase() ? t('photo.siteColour') : c} onClick={() => setColour(c)} />
              ))}
              <label className="ms-picker" data-tip={t('sceneMap.pick')}>
                <input type="color" value={colour} onChange={(e) => setColour(e.target.value.toLowerCase())} aria-label={t('sceneMap.pick')} />
              </label>
              <button className={`chip-tile glass ${shadow ? 'chosen' : ''}`} aria-pressed={shadow} onClick={() => setShadow(!shadow)}>{t('photo.shadow')}</button>
            </div>
            <button className="primary" disabled={!!work || !photo} onClick={() => void doPlain()}>{t('photo.plainDo')}</button>
            {said('plain')}
          </section>

          <section className="bench-tool glass">
            <header><Sparkles className="ico" aria-hidden /><strong>{t('photo.backdrop')}</strong><span className="badge paid"><Coins className="ico" aria-hidden />{t('photo.paid')}</span></header>
            <div className="idea-row compact">
              {BACKDROP_KEYS.map((k) => (
                <button key={k} className={`chip-tile glass ${backdrop === k && !own.trim() ? 'chosen' : ''}`} onClick={() => { setBackdrop(k); setOwn(''); }}>{t(`photo.backdrops.${k}`)}</button>
              ))}
            </div>
            <textarea rows={2} value={own} maxLength={300} placeholder={t('photo.ownHint')} onChange={(e) => setOwn(e.target.value)} />
            {/* Paid: a first press asks, the second (within a few seconds) spends. */}
            <button className={`primary ${armed === 'backdrop' ? 'armed' : ''}`} disabled={!!work || !photo} onClick={() => confirm('backdrop', () => void doBackdrop())}>
              {armed === 'backdrop' ? <><Coins className="ico" aria-hidden />{t('photo.confirm')}</> : t('photo.backdropDo')}
            </button>
            {said('backdrop')}
          </section>
        </div>
        {versions.length > 0 && (
          <div className="bench-versions">
            <div className="bench-version current" data-tip={t('photo.current')}><Thumb path={photo} alt={piece.name} /></div>
            {versions.map((v) => (
              <div key={v} className="bench-version">
                <button className="bench-version-pick" disabled={!!work} aria-label={t('photo.choose')} data-tip={t('photo.choose')} onClick={() => onChoose(v)}><Thumb path={v} alt="" /></button>
                <button className="icon-btn glass bench-version-drop" disabled={!!work} aria-label={t('photo.drop')} data-tip={t('photo.drop')} onClick={() => onDrop(v)}><Trash2 className="ico solo" aria-hidden /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
