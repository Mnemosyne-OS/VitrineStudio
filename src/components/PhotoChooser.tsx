import { useContext, useEffect, useMemo, useState } from 'react';
import { Box, Clapperboard, HardDrive, Sparkles, X, type LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import { sdk } from '../data/host';
import { generationsDir, PhotoSources } from '../model/photoSources';
import { Thumb } from './Thumb';

type Source = 'computer' | 'pieces' | 'scenes' | 'mnemosyne';
const SOURCES: Array<[Source, LucideIcon]> = [['computer', HardDrive], ['pieces', Box], ['scenes', Clapperboard], ['mnemosyne', Sparkles]];
const IMAGE_FILTER = (name: string) => [{ name, extensions: ['jpg', 'jpeg', 'png', 'webp'] }];

/**
 * A photo for a frame (asked for on 02/11): from the computer, one of her creations'
 * photos, one of her scenes' pictures, or among the pictures Mnemosyne OS made.
 * The first and the last open the system picker; the two others show the
 * studio's own pictures to click.
 */
export function PhotoChooser({ onPick, onClose, start }: {
  onPick: (path: string) => void;
  onClose: () => void;
  /** Opens already on this source's pictures (the scene-photo buttons). */
  start?: 'pieces' | 'scenes';
}) {
  const { t } = useI18n();
  const { pieces, scenes, showcase } = useContext(PhotoSources);
  const [source, setSource] = useState<Source | null>(start ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const piecePhotos = useMemo(() => pieces.flatMap((p) => [p.photoPath, ...(showcase[p.id]?.photos ?? [])].filter((x): x is string => !!x).map((path) => ({ path, name: p.name }))), [pieces, showcase]);
  const scenePhotos = useMemo(() => scenes.filter((s) => s.validated).flatMap((s) => Object.values(s.images).filter((x): x is string => !!x).map((path) => ({ path, name: s.variant || s.universe }))), [scenes]);

  const system = async (startIn: string | null) => {
    setError(null);
    try {
      const path = await sdk.invoke<string | null>('dialog.selectFile', { filters: IMAGE_FILTER(t('photoChooser.title')), ...(startIn ? { startIn } : {}) }, 0);
      if (typeof path === 'string' && path) { onPick(path); onClose(); }
    } catch (err) {
      console.warn('[vitrine-studio] the photo picker failed:', err);
      setError(String(err instanceof Error ? err.message : err));
    }
  };
  const choose = (s: Source) => {
    if (s === 'computer') void system(null);
    else if (s === 'mnemosyne') void system(generationsDir(scenes));
    else setSource(s);
  };
  const list = source === 'pieces' ? piecePhotos : source === 'scenes' ? scenePhotos : [];

  return (
    <div className="veil" role="dialog" aria-modal="true" aria-label={t('photoChooser.title')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="photo-chooser glass">
        <div className="photo-chooser-head">
          <h2>{t('photoChooser.title')}</h2>
          <button className="icon-btn glass" aria-label={t('wizard.close')} onClick={onClose}><X className="ico solo" aria-hidden /></button>
        </div>
        <div className="photo-chooser-sources">
          {SOURCES.map(([s, Icon]) => (
            <button key={s} className={`chip-tile glass ${source === s ? 'chosen' : ''}`} aria-pressed={source === s} onClick={() => choose(s)}>
              <Icon className="ico" aria-hidden /><span>{t(`photoChooser.${s}`)}</span>
            </button>
          ))}
        </div>
        {error && <p className="error small">{error}</p>}
        {source && (list.length ? (
          <div className="photo-chooser-grid">
            {list.map((x, i) => (
              <button key={`${x.path}-${i}`} className="photo-chooser-item" title={x.name} onClick={() => { onPick(x.path); onClose(); }}>
                <Thumb path={x.path} alt={x.name} />
              </button>
            ))}
          </div>
        ) : <p className="small muted">{t(`photoChooser.empty.${source}`)}</p>)}
      </div>
    </div>
  );
}
