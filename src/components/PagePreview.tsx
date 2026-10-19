import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Monitor, MonitorPlay, Smartphone, Tablet, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { useMenuRename } from '../hooks/useMenuRename';
import type { MenuChange } from '../site/buildSite';

/** How far the page is made: pictures read out of how many. */
export type PreviewProgress = (done: number, total: number) => void;

const SCREENS = ['desktop', 'tablet', 'mobile'] as const;
type Screen = (typeof SCREENS)[number];
const SCREEN_ICON = { desktop: Monitor, tablet: Tablet, mobile: Smartphone } as const;

/**
 * A page of the site as the visitor will see it, in a layer over the studio.
 *
 * It opens AT ONCE (Tony: « la prévisu génération, un truc mieux en UX »):
 * a ghost of a page breathes while the pictures are read, with their count
 * (measured, never a made-up percentage), then the page fades in once the
 * frame has drawn it. The bar above it switches the width (computer, tablet,
 * phone), the way the site is really seen, and closes. A close while it is
 * still being made drops what arrives.
 */
export function PagePreview({ make, hash, onError, onMenu }: {
  make: (progress: PreviewProgress) => Promise<string>;
  hash: string;
  onError: (err: unknown) => void;
  /** A menu entry renamed in the preview. */
  onMenu?: (change: MenuChange) => void;
}) {
  const { t } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  useMenuRename(frame, onMenu);
  const [state, setState] = useState<{ url: string } | { busy: true; done: number; total: number } | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [screen, setScreen] = useState<Screen>('desktop');
  const held = useRef<string | null>(null);
  const alive = useRef(true);
  // Each opening has its own number: a result for one that was closed is let go.
  const run = useRef(0);
  const letGo = () => { if (held.current) URL.revokeObjectURL(held.current); held.current = null; };
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; letGo(); };
  }, []);

  const open = async () => {
    const mine = ++run.current;
    setDrawn(false);
    setState({ busy: true, done: 0, total: 0 });
    try {
      const url = await make((done, total) => {
        if (alive.current && run.current === mine) setState({ busy: true, done, total });
      });
      if (!alive.current || run.current !== mine) { URL.revokeObjectURL(url); return; }
      letGo();
      held.current = url;
      setState({ url });
    } catch (err) {
      console.warn('[vitrine-studio] the page preview failed:', err);
      if (alive.current && run.current === mine) { setState(null); onError(err); }
    }
  };
  const close = () => { run.current++; letGo(); setState(null); };
  const busy = state !== null && 'busy' in state;

  return (
    <>
      <button onClick={() => void open()} disabled={busy}>
        <MonitorPlay className="ico" aria-hidden />{t('blog.preview')}
      </button>
      {/* Drawn on the page's body: inside a glass card (backdrop-filter) a fixed layer is held to the card, not the window. */}
      {state && createPortal(
        <div className="post-preview" role="dialog" aria-label={t('blog.preview')} onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
          {/* Above the page, never on it: a site's own colours would hide it. */}
          <div className="post-preview-bar">
            <span>{t('blog.preview')}</span>
            <nav className="segmented glass pp-screens" aria-label={t('caption.screen')}>
              {SCREENS.map((sc) => {
                const Icon = SCREEN_ICON[sc];
                return <button key={sc} className={`icon-btn ${screen === sc ? 'on' : ''}`} aria-pressed={screen === sc} aria-label={t(`caption.screen.${sc}`)} data-tip={t(`caption.screen.${sc}`)} onClick={() => setScreen(sc)}><Icon className="ico solo" aria-hidden /></button>;
              })}
            </nav>
            <button className="post-preview-close" onClick={close} autoFocus><X className="ico" aria-hidden />{t('blog.previewClose')}</button>
          </div>
          <div className={`pp-stage screen-${screen}`}>
            {'url' in state && (
              <iframe ref={frame} className={drawn ? 'drawn' : ''} title={t('blog.preview')} src={`${state.url}#${hash}`} onLoad={() => setDrawn(true)} />
            )}
            {/* The ghost of a page, until the real one has drawn. */}
            {!drawn && (
              <div className="pp-ghost" aria-live="polite">
                <div className="pp-ghost-nav"><span /><span /><span /><span /></div>
                <div className="pp-ghost-hero" />
                <div className="pp-ghost-row"><span /><span /><span /></div>
                <div className="pp-ghost-status">
                  <strong>{t('preview.making')}</strong>
                  {'busy' in state && state.total > 0 ? (
                    <>
                      <span>{t('preview.pictures', { done: state.done, total: state.total })}</span>
                      <span className="pp-bar"><span style={{ width: `${Math.round((state.done / state.total) * 100)}%` }} /></span>
                    </>
                  ) : <span className="pp-bar indeterminate"><span /></span>}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
