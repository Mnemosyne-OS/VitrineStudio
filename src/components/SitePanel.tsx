import { RotateCcw, ScanSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getLanguage, useI18n } from '../i18n';
import { ColourSample } from './ColourSample';
import type { SiteSettings } from '../site/buildSite';
import { DEFAULT_COLOURS, EXPORT_QUALITIES, EXPORT_QUALITY, IMAGE_KB_CHOICES, IMAGE_KB_MAX, IMAGE_KB_MIN } from '../site/buildSite';

export type SiteWork =
  | { kind: 'idle' }
  | { kind: 'exporting'; done: number; total: number }
  | { kind: 'exported'; files: number }
  /** Sent to Vercel at `since` (ms): the host gives no count, the bar shows the time it has taken. */
  | { kind: 'publishing'; since: number }
  /** Vercel said READY: said until the site changes again. */
  | { kind: 'published' }
  | { kind: 'error'; key: string; raw?: string };

/**
 * How the site looks (Site › Look): her name and the lines under it, the
 * three colours with a sample, and how sharp and heavy its pictures are, with
 * one picture compared as the site would get it. Sending the site is the site
 * bar's (SiteBar), on every screen; the hosting is Site › Online and Connection.
 */
export function SiteLook({ settings, onlineCount, enlarged, samplePhoto, busy, onSave, onCheck, checking }: {
  settings: SiteSettings;
  onlineCount: number;
  /** Scenes on the site with at least one enlarged picture. */
  enlarged: number;
  /** A picture of the site, under the colour sample. */
  samplePhoto?: string;
  /** The site is being exported or sent: the picture settings wait. */
  busy: boolean;
  onSave: (next: SiteSettings) => void;
  /** One picture, as held and as the site would get it, full screen. */
  onCheck: () => void;
  checking: boolean;
}) {
  const { t, tc } = useI18n();
  const [brand, setBrand] = useState(settings.brand);
  // The person's own weight: written on blur or Enter, kept within what an export can honour.
  const [kbDraft, setKbDraft] = useState(settings.imageKb === null ? '' : String(settings.imageKb));
  useEffect(() => setKbDraft(settings.imageKb === null ? '' : String(settings.imageKb)), [settings.imageKb]);
  const commitKb = () => {
    const n = Math.round(Number(kbDraft));
    if (!kbDraft.trim() || !Number.isFinite(n)) { setKbDraft(settings.imageKb === null ? '' : String(settings.imageKb)); return; }
    const kb = Math.max(IMAGE_KB_MIN, Math.min(IMAGE_KB_MAX, n));
    if (kb !== settings.imageKb) onSave({ ...settings, imageKb: kb });
    else setKbDraft(String(kb));
  };
  useEffect(() => setBrand(settings.brand), [settings.brand]);
  const commit = () => onSave({ ...settings, brand });

  return (
    <div className="site-grid">
      <div className="glass card-pad">
        <h3>{t('site.brand.title')}</h3>
        <label>{t('site.brand.name')}<input value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} onBlur={commit} maxLength={80} /></label>
        <label>{t('site.brand.tagline')}<input value={brand.tagline} onChange={(e) => setBrand({ ...brand, tagline: e.target.value })} onBlur={commit} maxLength={160} placeholder={t('site.brand.taglineHint')} /></label>
        <label>{t('site.brand.introLine')}<textarea rows={2} value={brand.introLine} onChange={(e) => setBrand({ ...brand, introLine: e.target.value })} onBlur={commit} maxLength={300} placeholder={t('site.brand.introLineHint')} /></label>
      </div>

      <div className="glass card-pad">
        <h3>{t('site.colours.title')}</h3>
        <div className="colour-row">
          {(['ink', 'paper', 'accent'] as const).map((key) => (
            <label key={key} className="colour-pick">
              <input type="color" value={brand[key]} onChange={(e) => setBrand({ ...brand, [key]: e.target.value })} onBlur={commit} />
              <span>{t(`site.brand.colour.${key}`)}</span>
            </label>
          ))}
        </div>
        <ColourSample ink={brand.ink} paper={brand.paper} accent={brand.accent} photo={samplePhoto} />
        <button className="colour-reset" onClick={() => { const next = { ...brand, ...DEFAULT_COLOURS }; setBrand(next); onSave({ ...settings, brand: next }); }}><RotateCcw className="ico" aria-hidden />{t('site.colours.reset')}</button>
      </div>

      <div className="glass card-pad">
        <h3>{t('site.quality.title')}</h3>
        <div className="idea-row">
          {EXPORT_QUALITIES.map((q) => (
            <button key={q} disabled={busy} className={`chip-tile glass ${settings.quality === q ? 'chosen' : ''}`} onClick={() => onSave({ ...settings, quality: q })}>
              <strong>{t(`site.quality.${q}`)}</strong>
              <span className="muted small">{t(`site.quality.${q}Hint`, { width: EXPORT_QUALITY[q].large.toLocaleString(getLanguage()) })}</span>
            </button>
          ))}
        </div>
        <h4 className="sub-title">{t('site.weight.title')}</h4>
        <div className="idea-row compact">
          {IMAGE_KB_CHOICES.map((kb) => (
            <button key={String(kb)} disabled={busy} className={`chip-tile glass ${settings.imageKb === kb ? 'chosen' : ''}`} onClick={() => onSave({ ...settings, imageKb: kb })}>
              <strong>{kb === null ? t('site.weight.none') : t('site.weight.kb', { kb: kb.toLocaleString(getLanguage()) })}</strong>
            </button>
          ))}
          <label className={`chip-tile glass weight-own ${settings.imageKb !== null && !IMAGE_KB_CHOICES.includes(settings.imageKb) ? 'chosen' : ''}`}>
            <span className="small">{t('site.weight.own')}</span>
            <span className="weight-own-row">
              <input type="number" min={IMAGE_KB_MIN} max={IMAGE_KB_MAX} step={10} disabled={busy} value={kbDraft}
                onChange={(e) => setKbDraft(e.target.value)} onBlur={commitKb} onKeyDown={(e) => { if (e.key === 'Enter') commitKb(); }} />
              <span className="small">{t('site.weight.unit')}</span>
            </span>
          </label>
        </div>
        <div className="row spaced">
          <button disabled={!onlineCount || checking} onClick={onCheck}>{checking ? <span className="spinner small-spin" aria-hidden /> : <ScanSearch className="ico" aria-hidden />} {t('check.button')}</button>
        </div>
        {settings.quality !== 'standard' && enlarged < onlineCount && <p className="muted small">{tc('site.quality.notEnlarged', onlineCount - enlarged)}</p>}
      </div>
    </div>
  );
}
