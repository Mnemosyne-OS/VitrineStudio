import { useEffect, useState } from 'react';
import { Clapperboard, ImagePlus, LayoutTemplate, PanelBottom, PanelLeft, PanelRight, PanelTop, X, type LucideIcon } from 'lucide-react';
import { getLanguage, useI18n } from '../i18n';
import { PAGE_TEMPLATES, templateName, templateText } from '../model/templates';
import { pickImage } from '../data/host';
import { saveDroppedPhoto } from '../data/photos';
import { newId } from '../model/records';
import { PAGE_LAYOUTS, type PageLayout } from '../model/pages';
import { RichText } from './RichText';
import { Thumb } from './Thumb';
import { PhotoChooser } from './PhotoChooser';
import { describeError, errorText } from './errors';

const LAYOUT_ICON: Record<PageLayout, LucideIcon> = { right: PanelRight, left: PanelLeft, top: PanelTop, bottom: PanelBottom };

/**
 * A page of words and one picture, edited as it reads: the About page, or a
 * text page she added. Her words with their formatting, the picture dropped
 * or picked (its caption when the page has one), and where it stands.
 */
export function TextPagePanel({ text, onText, photo, onPhoto, caption, onCaption, layout, onLayout, photoLabel, photos, onPhotos }: {
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
  /** The About page's further photos ('' = a frame to fill); absent = the page has one picture. */
  photos?: string[];
  onPhotos?: (photos: string[]) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(caption ?? '');
  const [over, setOver] = useState(false);
  const [error, setError] = useState<{ key: string; raw?: string } | null>(null);
  const [sceneChoosing, setSceneChoosing] = useState(false);
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
      {sceneChoosing && <PhotoChooser start="scenes" onPick={onPhoto} onClose={() => setSceneChoosing(false)} />}
      <div className="info-bar glass">
        <div className="segmented glass" role="group" aria-label={t('about.layout')}>
          {PAGE_LAYOUTS.map((l) => {
            const Icon = LAYOUT_ICON[l];
            return <button key={l} className={`icon-btn ${layout === l ? 'on' : ''}`} aria-pressed={layout === l} aria-label={t(`about.layouts.${l}`)} data-tip={t(`about.layouts.${l}`)} onClick={() => onLayout(l)}><Icon className="ico solo" aria-hidden /></button>;
          })}
        </div>
      </div>
      {error && <p className="error small">{errorText(error)}</p>}
      {/* An empty page offers its models: a start, never words she wrote replaced. */}
      {!text.trim() && (
        <div className="template-row glass card-pad">
          <span className="small muted"><LayoutTemplate className="ico" aria-hidden /> {t('template.start')}</span>
          {PAGE_TEMPLATES.map((tpl) => (
            <button key={tpl.id} className="chip-tile glass" onClick={() => {
              onText(templateText(tpl, getLanguage()));
              if (tpl.layout) onLayout(tpl.layout);
              // Its empty frames, beside the photos already there.
              if (onPhotos && tpl.photos && (photos ?? []).length < tpl.photos) onPhotos([...(photos ?? []), ...Array<string>(tpl.photos - (photos ?? []).length).fill('')]);
            }}>
              {templateName(tpl, getLanguage())}
            </button>
          ))}
        </div>
      )}
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
              <button className="icon-btn glass" aria-label={t('page.scenePhoto')} data-tip={t('page.scenePhoto')}
                onClick={() => setSceneChoosing(true)}><Clapperboard className="ico solo" aria-hidden /></button>
              {photo && (
                <button className="icon-btn glass" aria-label={t('site.brand.portraitRemove')} data-tip={t('site.brand.portraitRemove')} onClick={() => onPhoto(undefined)}><X className="ico solo" aria-hidden /></button>
              )}
            </div>
          </div>
          {onPhotos && <PhotoFrames photos={photos ?? []} onPhotos={onPhotos} onError={setError} />}
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

/**
 * The About page's photos after the portrait: each one shown, an empty one as
 * a frame to fill (a model leaves them), filled by a click or a drop. Three at most.
 */
function PhotoFrames({ photos, onPhotos, onError }: { photos: string[]; onPhotos: (next: string[]) => void; onError: (e: { key: string; raw?: string } | null) => void }) {
  const { t } = useI18n();
  const [over, setOver] = useState<number | null>(null);
  const [choosing, setChoosing] = useState<number | null>(null);
  const put = (i: number, path: string) => onPhotos(photos.map((p, k) => (k === i ? path : p)));
  const drop = async (i: number, file: File) => {
    try {
      put(i, await saveDroppedPhoto(file, newId('about-photo')));
      onError(null);
    } catch (err) {
      onError(describeError(err));
    }
  };
  return (
    <div className="photo-frames">
      {choosing !== null && <PhotoChooser onPick={(path) => put(choosing, path)} onClose={() => setChoosing(null)} />}
      {photos.map((p, i) => (
        <div key={i} className={`photo-frame ${p ? '' : 'empty'} ${over === i ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDragLeave={() => setOver(null)}
          onDrop={(e) => { e.preventDefault(); setOver(null); const f = e.dataTransfer.files?.[0]; if (f) void drop(i, f); }}>
          {p ? <Thumb path={p} alt="" /> : (
            <button className="photo-frame-fill" onClick={() => setChoosing(i)}>
              <ImagePlus className="ico" aria-hidden /><span className="small">{t('about.photoFill')}</span>
            </button>
          )}
          <button className="icon-btn glass photo-frame-x" aria-label={t('site.brand.portraitRemove')} data-tip={t('site.brand.portraitRemove')}
            onClick={() => onPhotos(photos.filter((_, k) => k !== i))}><X className="ico solo" aria-hidden /></button>
        </div>
      ))}
      {photos.length < 3 && (
        <button className="chip-tile glass" onClick={() => onPhotos([...photos, ''])}><ImagePlus className="ico" aria-hidden />{t('about.photoAdd')}</button>
      )}
    </div>
  );
}
