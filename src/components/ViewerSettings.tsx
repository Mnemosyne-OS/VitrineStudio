import { Ban, Frame as FrameIcon, Layers2, Maximize2, Scan, ScanSearch, Search, ZoomIn, type LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import { FRAMES, LOUPES, type Frame, type Loupe, type ViewerSettings as Viewer } from '../model/viewer';
import { CREATIONS_HOVERS, type CreationsHover } from '../model/showcase';

const LOUPE_ICON: Record<Loupe, LucideIcon> = { none: Ban, lens: Search, square: ScanSearch, zoom: ZoomIn };
const FRAME_ICON: Record<Frame, LucideIcon> = { none: Ban, shadow: Layers2, frame: FrameIcon, round: Scan };

/**
 * The catalogue page's settings (the ⚙ beside its preview): the loupe over a
 * creation opened large, and the frame of its pictures. Saved at once.
 */
export function ViewerSettings({ value, onChange, hover, onHover }: { value: Viewer; onChange: (next: Viewer) => void; hover: CreationsHover; onHover: (next: CreationsHover) => void }) {
  const { t } = useI18n();
  return (
    <div className="scene-map-settings glass viewer-settings">
      {/* What a picture of the Creations page does under the pointer (was in the Site tab). */}
      <span className="form-label">{t('site.creations.hover')}</span>
      <div className="viewer-tiles">
        {CREATIONS_HOVERS.map((h) => (
          <button key={h} className={`chip-tile glass ${hover === h ? 'chosen' : ''}`} aria-pressed={hover === h} onClick={() => onHover(h)}>
            <span>{t(`site.creations.hovers.${h}`)}</span>
          </button>
        ))}
      </div>
      <span className="form-label"><Maximize2 className="ico" aria-hidden /> {t('viewer.loupe')}</span>
      <div className="viewer-tiles">
        {LOUPES.map((l) => {
          const Icon = LOUPE_ICON[l];
          return (
            <button key={l} className={`chip-tile glass ${value.loupe === l ? 'chosen' : ''}`} aria-pressed={value.loupe === l} onClick={() => onChange({ ...value, loupe: l })}>
              <Icon className="ico" aria-hidden /><span>{t(`viewer.loupes.${l}`)}</span>
            </button>
          );
        })}
      </div>
      <span className="form-label">{t('viewer.frame')}</span>
      <div className="viewer-tiles">
        {FRAMES.map((f) => {
          const Icon = FRAME_ICON[f];
          return (
            <button key={f} className={`chip-tile glass ${value.frame === f ? 'chosen' : ''}`} aria-pressed={value.frame === f} onClick={() => onChange({ ...value, frame: f })}>
              <Icon className="ico" aria-hidden /><span>{t(`viewer.frames.${f}`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
