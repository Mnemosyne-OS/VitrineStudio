import { Monitor, RotateCw, Smartphone } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { DESIGN_TARGETS, type DesignTarget } from '../model/design';
import { DESIGN_PICKED } from '../site/preview';
import { describeError, errorText } from './errors';

const SCREENS = ['desktop', 'mobile'] as const;
type Screen = (typeof SCREENS)[number];
/** The page's own width on each screen: it is drawn at that width and shrunk to the stage, never squeezed. */
const WIDTH: Record<Screen, number> = { desktop: 1280, mobile: 390 };
const PHONE_HEIGHT = 844;
const SCREEN_ICON = { desktop: Monitor, mobile: Smartphone } as const;
/** A change is shown once she stops changing: a slider dragged does not rebuild the page at every step. */
const SETTLE_MS = 350;
/** A page that is not made after this long says so, with a way to ask again. */
const MAKE_TIMEOUT_MS = 30_000;

/**
 * The middle of the Design screen (doc 145 §10.25): the REAL site, with the
 * settings being tried laid on it, at a computer's width or a phone's. It is
 * made again a moment after each change and reopens on the page she was
 * looking at. A click on a part of it tells the screen which part (the page's
 * own click still happens: a link opens its page).
 *
 * Three states, always one of them: being made, failed (said, with « retry »),
 * shown. The page shown stays until the next one has drawn.
 */
export function DesignStage({ make, version, onPick, bar, page, title, quietBar = false }: {
  /** The site as tried, at an in-memory address (useSite.previewDesign). */
  make: () => Promise<string>;
  /** Changes when what is tried changes: the page is made again. */
  version: string;
  /** Absent: the page shown has no click-to-set layer (a page being edited). */
  onPick?: (target: DesignTarget) => void;
  /** What stands left of the stage's own tools: the trial's state and its two buttons. */
  bar?: ReactNode;
  /**
   * The page it always opens on (`a-propos`, a page's id), made again or not: the
   * page being edited stays in sight. Absent: it reopens on the page she went to.
   */
  page?: string;
  /** What the frame is, for a screen reader; absent = the Design screen's own words. */
  title?: string;
  /** Nothing to say in the bar (no trial): its tools stand alone, without a band. */
  quietBar?: boolean;
}) {
  const { t } = useI18n();
  const [screen, setScreen] = useState<Screen>('desktop');
  const [url, setUrl] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; raw?: string } | null>(null);
  const [again, setAgain] = useState(0);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const wrap = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const held = useRef<string | null>(null);
  const hash = useRef(page ? `#${page}` : '');
  const latest = useRef({ make, onPick });
  latest.current = { make, onPick };

  // The page as tried, made a moment after the last change. The one in sight is let go only once the next is there.
  useEffect(() => {
    let alive = true;
    let timeout = 0;
    const settle = window.setTimeout(() => {
      setError(null);
      const late = new Promise<never>((_, no) => { timeout = window.setTimeout(() => no(new Error('PREVIEW_TIMEOUT')), MAKE_TIMEOUT_MS); });
      const making = latest.current.make();
      Promise.race([making, late]).then((made) => {
        if (!alive) { URL.revokeObjectURL(made); return; }
        // The page she is on, read from the frame itself: its own script writes the address without an event.
        // A page being edited is always the one reopened.
        if (page) hash.current = `#${page}`;
        else {
          try { hash.current = frame.current?.contentWindow?.location.hash ?? hash.current; }
          catch (err) { console.debug('[vitrine-studio] the preview\'s address was not readable, it reopens on its home:', err); }
        }
        if (held.current) URL.revokeObjectURL(held.current);
        held.current = made;
        setUrl(made);
      }, (err: unknown) => {
        console.warn('[vitrine-studio] the design preview was not made:', err);
        // A page that arrives after it was given up on is let go: nobody holds its address.
        making.then((url) => URL.revokeObjectURL(url), () => {});
        if (alive) setError(describeError(err));
      }).finally(() => window.clearTimeout(timeout));
    }, SETTLE_MS);
    return () => { alive = false; window.clearTimeout(settle); window.clearTimeout(timeout); };
  }, [version, again, page]);
  useEffect(() => () => { if (held.current) URL.revokeObjectURL(held.current); }, []);

  // A part of the site clicked in the frame: only this frame's own message is heard.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { type?: unknown; target?: unknown } | null;
      if (d?.type !== DESIGN_PICKED || typeof d.target !== 'string') return;
      if ((DESIGN_TARGETS as readonly string[]).includes(d.target)) latest.current.onPick?.(d.target as DesignTarget);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A computer's page fills the stage's width; a phone's stands in its middle, whole.
  const w = screen === 'desktop' ? Math.max(WIDTH.desktop, box.w) : WIDTH.mobile;
  const scale = box.w ? (screen === 'desktop' ? Math.min(1, box.w / w) : Math.min(1, box.w / w, box.h / PHONE_HEIGHT)) : 1;
  const h = screen === 'desktop' ? box.h / scale : Math.min(PHONE_HEIGHT, box.h / scale);
  const left = Math.max(0, (box.w - w * scale) / 2);
  const shown = url !== null && drawn === url;

  return (
    <div className="design-main">
      <div className={`design-bar glass${quietBar ? ' quiet' : ''}`}>
        {bar}
        <div className="segmented glass design-screens" role="group" aria-label={t('caption.screen')}>
          {SCREENS.map((sc) => {
            const Icon = SCREEN_ICON[sc];
            return <button key={sc} className={`icon-btn ${screen === sc ? 'on' : ''}`} aria-pressed={screen === sc} aria-label={t(`caption.screen.${sc}`)} data-tip={t(`caption.screen.${sc}`)} onClick={() => setScreen(sc)}><Icon className="ico solo" aria-hidden /></button>;
          })}
          <button className="icon-btn" aria-label={t('design.stage.reload')} data-tip={t('design.stage.reload')} onClick={() => setAgain((n) => n + 1)}><RotateCw className="ico solo" aria-hidden /></button>
        </div>
      </div>
      <div className={`design-stage screen-${screen}`} ref={wrap}>
        {url && (
          <iframe ref={frame} key={screen} className={shown ? 'drawn' : ''} title={title ?? t('design.stage.title')} src={`${url}${hash.current}`} sandbox="allow-scripts allow-same-origin allow-forms"
            style={{ width: w, height: h, left, transform: `scale(${scale})` }} onLoad={() => setDrawn(url)} />
        )}
        {error ? (
          <p className="design-stage-note error" role="alert">
            {error.key === 'error.unknown' && error.raw?.includes('PREVIEW_TIMEOUT') ? t('design.stage.slow') : `${t('design.stage.failed')} ${errorText(error)}`}
            <button className="link" onClick={() => setAgain((n) => n + 1)}>{t('app.retry')}</button>
          </p>
        ) : !shown && (
          <p className="design-stage-note muted" aria-live="polite"><span className="spinner small-spin" aria-hidden /> {t('preview.making')}</p>
        )}
      </div>
    </div>
  );
}
