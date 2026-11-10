import { RotateCcw, ScanSearch } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getLanguage, useI18n } from '../i18n';
import { ColourField } from './ColourField';
import { ColourSample } from './ColourSample';
import type { DesignDraft, DesignFields, DesignLook } from '../model/design';
import { DEFAULT_COLOURS, EXPORT_QUALITIES, EXPORT_QUALITY, IMAGE_KB_CHOICES, IMAGE_KB_MAX, IMAGE_KB_MIN, VIDEO_LEVELS, type ExportQuality, type ImageKb } from '../site/buildSite';

/**
 * The cards of the Design screen that were Site › Look (doc 145 §10.25): the
 * same settings, each in its part of the panel. None writes the site: each
 * hands its change to the screen's trial, shown on the site before it is kept.
 */

/** Design › Identity: the workshop's name and the two lines under it. Tried when the field is left. */
export function BrandWords({ look, onTry }: { look: DesignLook; onTry: (look: DesignLook) => void }) {
  const { t } = useI18n();
  const [words, setWords] = useState({ name: look.name, tagline: look.tagline, introLine: look.introLine });
  useEffect(() => setWords({ name: look.name, tagline: look.tagline, introLine: look.introLine }), [look.name, look.tagline, look.introLine]);
  const commit = () => onTry({ ...look, ...words });
  return (
    <div className="glass card-pad">
      <h3>{t('site.brand.title')}</h3>
      <label>{t('site.brand.name')}<input value={words.name} onChange={(e) => setWords({ ...words, name: e.target.value })} onBlur={commit} maxLength={80} /></label>
      <label>{t('site.brand.tagline')}<input value={words.tagline} onChange={(e) => setWords({ ...words, tagline: e.target.value })} onBlur={commit} maxLength={160} placeholder={t('site.brand.taglineHint')} /></label>
      <label>{t('site.brand.introLine')}<textarea rows={2} value={words.introLine} onChange={(e) => setWords({ ...words, introLine: e.target.value })} onBlur={commit} maxLength={300} placeholder={t('site.brand.introLineHint')} /></label>
    </div>
  );
}

/** Design › Identity: the three colours, with a sample that follows the swatch while it moves. */
export function BrandColours({ look, samplePhoto, overridden, onTry }: {
  look: DesignLook;
  /** A picture of the site, under the colour sample. */
  samplePhoto?: string;
  /** The site wears the theme's own colours for now (Design › Theme): hers are kept, and said not to be the ones shown. */
  overridden?: boolean;
  onTry: (look: DesignLook) => void;
}) {
  const { t } = useI18n();
  const [c, setC] = useState({ ink: look.ink, paper: look.paper, accent: look.accent });
  // The colours as last moved, read by the commit that follows a change in the same gesture (a short code completed on leaving its field).
  const now = useRef(c);
  const move = (next: typeof c) => { now.current = next; setC(next); };
  useEffect(() => { const kept = { ink: look.ink, paper: look.paper, accent: look.accent }; now.current = kept; setC(kept); }, [look.ink, look.paper, look.accent]);
  return (
    <div className="glass card-pad">
      <h3>{t('site.colours.title')}</h3>
      {overridden && <p className="muted small">{t('theme.colours.overridden')}</p>}
      <div className="colour-row">
        {(['ink', 'paper', 'accent'] as const).map((key) => (
          <ColourField key={key} value={c[key]} label={t(`site.brand.colour.${key}`)} onChange={(hex) => move({ ...now.current, [key]: hex })} onCommit={() => onTry({ ...look, ...now.current })} />
        ))}
      </div>
      <ColourSample ink={c.ink} paper={c.paper} accent={c.accent} photo={samplePhoto} />
      <button className="colour-reset" onClick={() => { move({ ...DEFAULT_COLOURS }); onTry({ ...look, ...DEFAULT_COLOURS }); }}><RotateCcw className="ico" aria-hidden />{t('site.colours.reset')}</button>
    </div>
  );
}

/** Design › Details: her pages of words in the dark for a visitor whose system is dark, or always light. */
export function DarkMode({ look, onTry }: { look: DesignLook; onTry: (look: DesignLook) => void }) {
  const { t } = useI18n();
  return (
    <div className="glass card-pad">
      <h3>{t('site.dark.title')}</h3>
      <div className="idea-row">
        {(['auto', 'never'] as const).map((v) => (
          <button key={v} className={`chip-tile glass ${look.dark === v ? 'chosen' : ''}`} aria-pressed={look.dark === v} onClick={() => onTry({ ...look, dark: v })}>
            <strong>{t(`site.dark.${v}`)}</strong>
            <span className="muted small">{t(`site.dark.${v}Hint`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Design › Details: how sharp and how heavy the site's pictures and clips are,
 * with one picture compared as the site would get it at the values tried.
 */
export function ImageQuality({ quality, imageKb, videoLevel, busy, onlineCount, enlarged, onTry, onCheck, checking }: {
  quality: ExportQuality;
  imageKb: ImageKb;
  videoLevel: DesignFields['videoLevel'];
  /** The site is being exported or sent: the picture settings wait. */
  busy: boolean;
  onlineCount: number;
  /** Scenes on the site with at least one enlarged picture. */
  enlarged: number;
  onTry: (change: DesignDraft) => void;
  /** One picture, as held and as the site would get it, full screen. */
  onCheck: () => void;
  checking: boolean;
}) {
  const { t, tc } = useI18n();
  // The person's own weight: tried on blur or Enter, kept within what an export can honour.
  const [kbDraft, setKbDraft] = useState(imageKb === null ? '' : String(imageKb));
  useEffect(() => setKbDraft(imageKb === null ? '' : String(imageKb)), [imageKb]);
  const commitKb = () => {
    const n = Math.round(Number(kbDraft));
    if (!kbDraft.trim() || !Number.isFinite(n)) { setKbDraft(imageKb === null ? '' : String(imageKb)); return; }
    const kb = Math.max(IMAGE_KB_MIN, Math.min(IMAGE_KB_MAX, n));
    if (kb !== imageKb) onTry({ imageKb: kb });
    else setKbDraft(String(kb));
  };
  return (
    <div className="glass card-pad">
      <h3>{t('site.quality.title')}</h3>
      <div className="idea-row">
        {EXPORT_QUALITIES.map((q) => (
          <button key={q} disabled={busy} className={`chip-tile glass ${quality === q ? 'chosen' : ''}`} aria-pressed={quality === q} onClick={() => onTry({ quality: q })}>
            <strong>{t(`site.quality.${q}`)}</strong>
            <span className="muted small">{t(`site.quality.${q}Hint`, { width: EXPORT_QUALITY[q].large.toLocaleString(getLanguage()) })}</span>
          </button>
        ))}
      </div>
      <h4 className="sub-title">{t('site.weight.title')}</h4>
      <div className="idea-row compact">
        {IMAGE_KB_CHOICES.map((kb) => (
          <button key={String(kb)} disabled={busy} className={`chip-tile glass ${imageKb === kb ? 'chosen' : ''}`} aria-pressed={imageKb === kb} onClick={() => onTry({ imageKb: kb })}>
            <strong>{kb === null ? t('site.weight.none') : t('site.weight.kb', { kb: kb.toLocaleString(getLanguage()) })}</strong>
          </button>
        ))}
        <label className={`chip-tile glass weight-own ${imageKb !== null && !IMAGE_KB_CHOICES.includes(imageKb) ? 'chosen' : ''}`}>
          <span className="small">{t('site.weight.own')}</span>
          <span className="weight-own-row">
            <input type="number" min={IMAGE_KB_MIN} max={IMAGE_KB_MAX} step={10} disabled={busy} value={kbDraft}
              onChange={(e) => setKbDraft(e.target.value)} onBlur={commitKb} onKeyDown={(e) => { if (e.key === 'Enter') commitKb(); }} />
            <span className="small">{t('site.weight.unit')}</span>
          </span>
        </label>
      </div>
      <h4 className="sub-title">{t('site.video.title')}</h4>
      <div className="idea-row compact">
        {VIDEO_LEVELS.map((v) => (
          <button key={v} disabled={busy} className={`chip-tile glass ${videoLevel === v ? 'chosen' : ''}`} aria-pressed={videoLevel === v} onClick={() => onTry({ videoLevel: v })}>
            <strong>{t(`site.video.${v}`)}</strong>
            <span className="muted small">{t(`site.video.${v}Hint`)}</span>
          </button>
        ))}
      </div>
      <div className="row spaced">
        <button disabled={!onlineCount || checking} onClick={onCheck}>{checking ? <span className="spinner small-spin" aria-hidden /> : <ScanSearch className="ico" aria-hidden />} {t('check.button')}</button>
      </div>
      {quality !== 'standard' && enlarged < onlineCount && <p className="muted small">{tc('site.quality.notEnlarged', onlineCount - enlarged)}</p>}
    </div>
  );
}
