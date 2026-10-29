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
 *
 * The page is made once, when the layer opens: the site bar's « See » opens
 * one for the screen she is on, an editor's own button (a post, a legal page)
 * for what is being written.
 */
export function PreviewLayer({ make, hash, onError, onMenu, onClose }: {
  make: (progress: PreviewProgress) => Promise<string>;
  hash: string;
  onError: (err: unknown) => void;
  /** A menu entry renamed in the preview. */
  onMenu?: (change: MenuChange) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  useMenuRename(frame, onMenu);
  const [state, setState] = useState<{ url: string } | { busy: true; done: number; total: number }>({ busy: true, done: 0, total: 0 });
  const [drawn, setDrawn] = useState(false);
  const [screen, setScreen] = useState<Screen>('desktop');
  // The first call's own make and error: a layer shows the page it was opened for.
  const first = useRef({ make, onError, onClose });

  useEffect(() => {
    let alive = true;
    let held: string | null = null;
    const { make: build, onError: fail, onClose: close } = first.current;
    build((done, total) => { if (alive) setState({ busy: true, done, total }); }).then((url) => {
      if (!alive) { URL.revokeObjectURL(url); return; }
      held = url;
      setState({ url });
    }, (err: unknown) => {
      console.warn('[vitrine-studio] the page preview failed:', err);
      if (alive) { close(); fail(err); }
    });
    return () => { alive = false; if (held) URL.revokeObjectURL(held); };
  }, []);

  // Drawn on the page's body: inside a glass card (backdrop-filter) a fixed layer is held to the card, not the window.
  return createPortal(
    <div className="post-preview" role="dialog" aria-label={t('blog.preview')} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      {/* Above the page, never on it: a site's own colours would hide it. */}
      <div className="post-preview-bar">
        <span>{t('blog.preview')}</span>
        <nav className="segmented glass pp-screens" aria-label={t('caption.screen')}>
          {SCREENS.map((sc) => {
            const Icon = SCREEN_ICON[sc];
            return <button key={sc} className={`icon-btn ${screen === sc ? 'on' : ''}`} aria-pressed={screen === sc} aria-label={t(`caption.screen.${sc}`)} data-tip={t(`caption.screen.${sc}`)} onClick={() => setScreen(sc)}><Icon className="ico solo" aria-hidden /></button>;
          })}
        </nav>
        <button className="post-preview-close" onClick={onClose} autoFocus><X className="ico" aria-hidden />{t('blog.previewClose')}</button>
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
  );
}

/** An editor's own preview button: the page being written, opened in the layer. */
export function PagePreview({ make, hash, onError, onMenu }: {
  make: (progress: PreviewProgress) => Promise<string>;
  hash: string;
  onError: (err: unknown) => void;
  onMenu?: (change: MenuChange) => void;
}) {
  const { t } = useI18n();
  // Each opening is a new layer: it makes the page as it is at that press.
  const [opened, setOpened] = useState(0);
  return (
    <>
      <button onClick={() => setOpened((n) => n + 1)}>
        <MonitorPlay className="ico" aria-hidden />{t('blog.preview')}
      </button>
      {opened > 0 && <PreviewLayer key={opened} make={make} hash={hash} onError={onError} onMenu={onMenu} onClose={() => setOpened(0)} />}
    </>
  );
}
