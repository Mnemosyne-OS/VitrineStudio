import { AppWindow, ChevronDown, ChevronUp, Maximize, Minimize, Palette, RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import type { Preview } from '../site/preview';
import { DEFAULT_COLOURS } from '../site/buildSite';
import { formatWeight } from '../format';
import { useMenuRename } from '../hooks/useMenuRename';
import type { MenuChange } from '../site/buildSite';

export interface SiteColours { ink: string; paper: string; accent: string }
const COLOUR_KEYS = ['ink', 'paper', 'accent'] as const;

/**
 * The website as the export would write it, full screen: in the studio's own
 * view (on the canvas), or as the whole of a separate window (`standalone`).
 * The page runs at its own in-memory address, so its navigation works. The
 * weight bar hides with one click (a small button brings it back), and full screen
 * puts the preview in real full screen (the host allows it, Escape leaves).
 */
export function SitePreview({ preview, standalone, onClose, onOpenWindow, colours, onColours, onMenu }: {
  /** A menu entry renamed in the preview. */
  onMenu?: (change: MenuChange) => void;
  preview: Preview;
  /** The site's colours now; the palette changes them live on the page shown. */
  colours: SiteColours;
  /** Saves the colours chosen, when the colour menu closes. */
  onColours: (c: SiteColours) => void;
  standalone: boolean;
  onClose: () => void;
  onOpenWindow: () => void;
}) {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState(true);
  const [full, setFull] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useMenuRename(frame, onMenu);
  const [palette, setPalette] = useState<SiteColours | null>(null);
  // What the page's script threw (site/preview.ts withErrorWatch): said on screen, never a white page.
  const [failed, setFailed] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const watch = () => {
    setFailed(null);
    const read = () => {
      const errs = (frame.current?.contentWindow as (Window & { __previewErrors?: string[] }) | null)?.__previewErrors;
      if (errs && errs.length) setFailed(errs[0]!);
    };
    // Once the page has started, and again when its scenes have had time to play.
    timers.current.forEach(clearTimeout);
    timers.current = [setTimeout(read, 600), setTimeout(read, 3000)];
  };

  /** The page's own variables, so a colour shows at once without rebuilding anything. */
  const paint = (c: SiteColours) => {
    const root = frame.current?.contentDocument?.documentElement;
    if (!root) return;
    root.style.setProperty('--ink', c.ink);
    root.style.setProperty('--paper', c.paper);
    root.style.setProperty('--accent', c.accent);
    root.style.setProperty('--ink-soft', `color-mix(in srgb, ${c.ink} 72%, ${c.paper})`);
    root.style.setProperty('--line', `color-mix(in srgb, ${c.ink} 18%, transparent)`);
  };
  const togglePalette = () => {
    if (palette) { onColours(palette); setPalette(null); } else setPalette(colours);
  };
  // Closing with the palette open keeps what it shows: colours seen on the page are never dropped in silence.
  const latest = useRef({ palette, colours, onColours, onClose });
  latest.current = { palette, colours, onColours, onClose };
  const close = useCallback(() => {
    const { palette: p, colours: c, onColours: save, onClose: done } = latest.current;
    if (p && (p.ink !== c.ink || p.paper !== c.paper || p.accent !== c.accent)) save(p);
    done();
  }, []);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (standalone) return;
    // Escape leaves full screen first (the browser does it); only then does it close.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.fullscreenElement) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [standalone, close]);

  const toggleFull = () => {
    const done = document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen();
    // A host that does not allow it refuses here: said in the console, the preview stays as it is.
    done?.catch((err: unknown) => console.warn('[vitrine-studio] full screen refused:', err));
  };

  return (
    <div ref={root} className={`site-preview ${standalone ? 'standalone' : ''} ${bar && !full ? '' : 'bare'}`} role="dialog" aria-modal={!standalone} aria-label={t('preview.title')}>
      {/* In full screen the site alone: no bar, no button; Escape leaves. */}
      {full ? null : bar ? (
        <div className="site-preview-bar">
          <span className="pill glass"><strong>{t('preview.title')}</strong> · {t('preview.weight', { total: formatWeight(preview.size.bytes), images: formatWeight(preview.size.imageBytes), clips: formatWeight(preview.size.clipBytes) })}</span>
          <button className={`pill glass ${palette ? 'on' : ''}`} onClick={togglePalette} title={t('site.colours.title')} aria-label={t('site.colours.title')}><Palette className="ico solo" aria-hidden /></button>
          <button className="pill glass" onClick={toggleFull} title={t(full ? 'preview.exitFull' : 'preview.full')} aria-label={t(full ? 'preview.exitFull' : 'preview.full')}>{full ? <Minimize className="ico solo" aria-hidden /> : <Maximize className="ico solo" aria-hidden />}</button>
          {!standalone && <button className="pill glass" onClick={onOpenWindow}><AppWindow className="ico" aria-hidden />{t('preview.window')}</button>}
          <button className="pill glass" onClick={() => setBar(false)} title={t('preview.hideBar')} aria-label={t('preview.hideBar')}><ChevronUp className="ico solo" aria-hidden /></button>
        </div>
      ) : (
        <button className="site-preview-show glass" onClick={() => setBar(true)} title={t('preview.showBar')} aria-label={t('preview.showBar')}><ChevronDown className="ico solo" aria-hidden /></button>
      )}
      {!standalone && (
        <button className="lightbox-close glass" onClick={close} aria-label={t('wizard.close')} title={t('wizard.close')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      )}
      {palette && !full && bar && (
        <div className="site-preview-palette glass">
          {COLOUR_KEYS.map((key) => (
            <label key={key} className="colour-pick">
              <input type="color" value={palette[key]} onChange={(e) => { const next = { ...palette, [key]: e.target.value }; setPalette(next); paint(next); }} />
              <span>{t(`site.brand.colour.${key}`)}</span>
            </label>
          ))}
          <button onClick={() => { const next = { ...DEFAULT_COLOURS }; setPalette(next); paint(next); }}><RotateCcw className="ico" aria-hidden />{t('site.colours.reset')}</button>
          <button className="primary" onClick={togglePalette}>{t('site.colours.done')}</button>
        </div>
      )}
      <iframe ref={frame} className="site-preview-frame" title={t('preview.title')} src={preview.pageUrl} sandbox="allow-scripts allow-same-origin" allow="fullscreen" onLoad={watch} />
      {failed && (
        <div className="site-preview-failed glass" role="alert">
          <strong>{t('preview.failed')}</strong>
          <code>{failed}</code>
          <button className="primary" onClick={() => window.location.reload()}><RefreshCw className="ico" aria-hidden />{t('preview.reloadStudio')}</button>
        </div>
      )}
    </div>
  );
}
