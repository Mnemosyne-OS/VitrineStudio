import { AppWindow, CheckCircle2, Eye, Globe, Link2, Rocket, RotateCcw, ScanSearch } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { errorText } from './errors';
import { getLanguage, useI18n } from '../i18n';
import { ColourSample } from './ColourSample';
import { formatWeight } from '../format';
import type { SiteSettings } from '../site/buildSite';
import { DEFAULT_COLOURS, EXPORT_QUALITIES, EXPORT_QUALITY, IMAGE_KB_CHOICES, IMAGE_KB_MAX, IMAGE_KB_MIN } from '../site/buildSite';

export type SiteWork =
  | { kind: 'idle' }
  | { kind: 'exporting'; done: number; total: number }
  | { kind: 'exported'; files: number }
  | { kind: 'publishing' }
  | { kind: 'error'; key: string; raw?: string };

/**
 * The website, for someone who does not do computers (Tony: « nettoyer les
 * redondances, une super UX pour teubé de l'informatique »): at the top, where
 * the site stands and the one button that puts it online; then four cards, her
 * name, her colours, her pictures; then carrying it away (a USB key) and
 * bringing it back. The connection, her domains and her visits are the Hosting
 * tab's (HostingPanel). What other tabs
 * already set (the Creations page's hover: Creations ⚙; the count of scenes:
 * the header) is no longer repeated here.
 */
export function SitePanel({ settings, onlineCount, enlarged, samplePhoto, connected, work, onPreview, onPreviewWindow, onCheck, previewWork, checking, previewError, onSave, onConnect, onPublish, onVideoSettings, onOpen, advanced, staleLiving = 0, onScenes }: {
  settings: SiteSettings;
  onlineCount: number;
  /** Scenes on the site with at least one enlarged picture. */
  enlarged: number;
  /** A picture of the site, under the colour sample. */
  samplePhoto?: string;
  /** The folder, the token and the address are set (the Hosting tab). */
  connected: boolean;
  work: SiteWork;
  onSave: (next: SiteSettings) => void;
  /** Opens the Hosting tab, where the connection is made. */
  onConnect: () => void;
  onPublish: () => void;
  /** Opens Settings › Video, where ffmpeg (which makes the clips lighter) is installed. */
  onVideoSettings: () => void;
  /** Online scenes chosen Living whose layers must be made again: they go to the site as pictures. */
  staleLiving?: number;
  onScenes?: () => void;
  /** The site built in memory with these settings, here or in its own window. */
  onPreview: () => void;
  onPreviewWindow: () => void;
  /** One picture, as held and as the site would get it, full screen. */
  onCheck: () => void;
  previewWork: { done: number; total: number } | null;
  checking: boolean;
  previewError: { key: string; raw?: string } | null;
  onOpen: (url: string) => void;
  /** Under the cards: carrying the studio away and back (TakeawayCard, the kit inside it). */
  advanced?: ReactNode;
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
  // The form's address as typed: kept as a draft until it reads as a Formspree form.

  const commit = () => onSave({ ...settings, brand });
  const busy = work.kind === 'exporting' || work.kind === 'publishing';
  // Only what is actually missing, named; the connection has its own line, with the way to it.
  const missing = [...(onlineCount > 0 ? [] : ['scene']), ...(brand.name.trim() ? [] : ['name'])];
  const ready = missing.length === 0;

  const live = settings.lastPublish;
  const liveUrl = live ? live.aliases[0] ?? live.url : null;
  const when = (at: string) => new Date(at).toLocaleString(getLanguage(), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section className="site-page">
      {/* Where the site stands, and the one button that matters. */}
      <div className={`glass card-pad site-hero ${live?.readyState === 'READY' ? 'is-live' : ''}`}>
        <div className="site-hero-state">
          {live?.readyState === 'READY' ? <CheckCircle2 className="ico hero-ico" aria-hidden /> : <Globe className="ico hero-ico" aria-hidden />}
          <div>
            <h2>{t(live?.readyState === 'READY' ? 'site.hero.live' : live ? 'site.hero.sent' : 'site.hero.notYet')}</h2>
            {liveUrl && <button className="link" onClick={() => onOpen(liveUrl)}>{liveUrl}</button>}
            <p className="muted small">
              {onlineCount ? tc('site.what.count', onlineCount) : t('site.what.none')}
              {live ? ` · ${t('site.hero.lastSent', { when: when(live.at) })}` : ''}
              {settings.lastExport ? ` · ${formatWeight(settings.lastExport.bytes)}` : ''}
            </p>
          </div>
        </div>
        <div className="site-hero-actions">
          <button disabled={!onlineCount || busy || !!previewWork} onClick={onPreview}><Eye className="ico" aria-hidden />{t('preview.here')}</button>
          <button disabled={!onlineCount || busy} onClick={onPreviewWindow}><AppWindow className="ico" aria-hidden />{t('preview.window')}</button>
          <button className="primary site-publish" disabled={!ready || busy || !connected} onClick={onPublish}>
            {work.kind === 'publishing' ? <span className="spinner small-spin" aria-hidden /> : <Rocket className="ico" aria-hidden />}
            {t(work.kind === 'publishing' ? 'site.go.publishing' : live ? 'site.hero.update' : 'site.go.publish')}
          </button>
        </div>
        {!ready && <p className="warn small site-hero-line">{t('site.go.notReady', { items: missing.map((m) => t(`site.go.missing.${m}`)).join(', ') })}</p>}
        {!connected && (
          <div className="site-hero-line row">
            <span className="warn small">{t('site.hero.needHosting')}</span>
            <button onClick={onConnect}><Link2 className="ico" aria-hidden />{t('site.hero.connect')}</button>
          </div>
        )}
        {work.kind === 'exporting' && (
          <div className="progress site-hero-line"><span style={{ width: `${Math.round((work.done / Math.max(1, work.total)) * 100)}%` }} /><em>{t('site.go.exporting', { done: work.done, total: work.total })}</em></div>
        )}
        {previewWork && (
          <div className="progress site-hero-line"><span style={{ width: `${Math.round((previewWork.done / Math.max(1, previewWork.total)) * 100)}%` }} /><em>{t('preview.building', { done: previewWork.done, total: previewWork.total })}</em></div>
        )}
        {previewError && <p className="error small site-hero-line">{errorText(previewError)}</p>}
        {/* Clips sent at the generator's weight: the way to make them lighter, next to the count. */}
        {!!settings.lastExport?.heavyClips && (
          <div className="site-hero-line row">
            <span className="warn small">{tc('site.heavyClips', settings.lastExport.heavyClips)}</span>
            <button onClick={onVideoSettings}>{t('site.heavyClipsFix')}</button>
          </div>
        )}
        {/* Said BEFORE the export: a living scene with stale layers goes as pictures, never silently. */}
        {staleLiving > 0 && (
          <div className="site-hero-line row">
            <span className="warn small">{tc('site.staleLiving', staleLiving)}</span>
            {onScenes && <button onClick={onScenes}>{t('site.staleLivingFix')}</button>}
          </div>
        )}
        {work.kind === 'error' && <p className="error small site-hero-line">{errorText(work)}</p>}
        {live && live.readyState !== 'READY' && <p className="small site-hero-line">{t('site.go.state', { state: live.readyState })}</p>}
      </div>

      {/* Cards in balanced columns (no hole under a short one); the connection first while it is what is missing. */}
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

      {/* Carry it away, bring it back: the copies, the table, the site, the kit (TakeawayCard). */}
      {advanced}
    </section>
  );
}
