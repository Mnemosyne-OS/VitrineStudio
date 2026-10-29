import { useEffect, useState } from 'react';
import { ImagePlus, PanelLeft, PanelRight, PanelTop, X, type LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import { pickImage } from '../data/host';
import { saveDroppedPhoto } from '../data/photos';
import { newId } from '../model/records';
import { PAGE_LAYOUTS, type PageLayout } from '../model/pages';
import { RichText } from './RichText';
import { Thumb } from './Thumb';
import { describeError, errorText } from './errors';

const LAYOUT_ICON: Record<PageLayout, LucideIcon> = { right: PanelRight, left: PanelLeft, top: PanelTop };

/**
 * A page of words and one picture, edited as it reads: the About page, or a
 * text page she added. Her words with their formatting, the picture dropped
 * or picked (its caption when the page has one), and where it stands.
 */
export function TextPagePanel({ text, onText, photo, onPhoto, caption, onCaption, layout, onLayout, photoLabel }: {
  text: string;
  onText: (markdown: string) => void;
  photo?: string;
  onPhoto: (path: string | undefined) => void;
  /** Absent: the page has no caption field. */
  caption?: string;
  onCaption?: (caption: string) => void;
  layout: PageLayout;
  onLayout: (layout: PageLayout) => void;
  /** What the picture is (the portrait, a photo). */
  photoLabel: string;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(caption ?? '');
  const [over, setOver] = useState(false);
  const [error, setError] = useState<{ key: string; raw?: string } | null>(null);
  useEffect(() => setDraft(caption ?? ''), [caption]);

  const takePhoto = async (file: File) => {
    try {
      onPhoto(await saveDroppedPhoto(file, newId('page-photo')));
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <section className="info-page">
      <div className="info-bar glass">
        <div className="segmented glass" role="group" aria-label={t('about.layout')}>
          {PAGE_LAYOUTS.map((l) => {
            const Icon = LAYOUT_ICON[l];
            return <button key={l} className={`icon-btn ${layout === l ? 'on' : ''}`} aria-pressed={layout === l} aria-label={t(`about.layouts.${l}`)} data-tip={t(`about.layouts.${l}`)} onClick={() => onLayout(l)}><Icon className="ico solo" aria-hidden /></button>;
          })}
        </div>
      </div>
      {error && <p className="error small">{errorText(error)}</p>}
      <div className={`info-cols about-${layout}`}>
        <RichText value={text} onChange={onText} label={t('page.text')} placeholder={t('site.brand.aboutHint')} />
        <div className="info-side glass card-pad">
          <div className={`portrait-drop ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) void takePhoto(f); }}>
            {photo ? <Thumb path={photo} alt={caption || photoLabel} /> : <span className="small muted">{t('about.dropPortrait')}</span>}
            <div className="portrait-actions">
              <button className="icon-btn glass" aria-label={photoLabel} data-tip={photoLabel}
                onClick={() => void pickImage(photoLabel).then((p) => { if (p) onPhoto(p); })}><ImagePlus className="ico solo" aria-hidden /></button>
              {photo && (
                <button className="icon-btn glass" aria-label={t('site.brand.portraitRemove')} data-tip={t('site.brand.portraitRemove')} onClick={() => onPhoto(undefined)}><X className="ico solo" aria-hidden /></button>
              )}
            </div>
          </div>
          {onCaption && (
            <label>{t('site.brand.portraitCaption')}
              <textarea rows={2} value={draft} maxLength={300} onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (draft !== (caption ?? '')) onCaption(draft); }} />
            </label>
          )}
        </div>
      </div>
    </section>
  );
}
