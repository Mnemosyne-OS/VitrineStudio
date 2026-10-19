import { AlignCenter, AlignLeft, AlignRight, Monitor, Smartphone, Tablet, type LucideIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useI18n } from '../i18n';
import { brandMarkup, LOGO_HEIGHT, LOGO_HEIGHT_MAX, LOGO_HEIGHT_MIN, LOGO_PLACES, setLogoSource, type Identity, type LogoPlace } from '../site/logo';
import type { Brand } from '../site/buildSite';

type Screen = 'desktop' | 'tablet' | 'mobile';
/** The page's width on each screen, and the height of the slice shown. */
/** `vh`: the real page's window height on that screen, of which the top slice is shown. */
const SCREEN: Record<Screen, { w: number; h: number; vh: number; icon: LucideIcon }> = {
  desktop: { w: 1280, h: 340, vh: 800, icon: Monitor },
  tablet: { w: 820, h: 380, vh: 1180, icon: Tablet },
  mobile: { w: 390, h: 420, vh: 844, icon: Smartphone },
};
const PLACE_ICON: Record<LogoPlace, LucideIcon> = { left: AlignLeft, center: AlignCenter, right: AlignRight };

/**
 * The top of the site with the logo where the page will put it (Tony: « une
 * preview qui permet de grossir ou de le positionner autrement »): the page's
 * own width per screen, scaled down to fit, the header's markup and placement
 * rules (LOGO_CSS). The logo is dragged left, centre or right and snaps; the
 * slider sets its height, saved when let go.
 */
export function LogoOnPage({ identity, name, src, brand, replay, onChange, make }: {
  identity: Identity;
  name: string;
  src: string | null;
  brand: Brand;
  replay: number;
  onChange: (next: Identity) => void;
  /** The real top of the site with this logo, in memory (Tony: « une prévisu light du site en condition »). */
  make?: (identity: Identity) => Promise<string>;
}) {
  const { t } = useI18n();
  const [screen, setScreen] = useState<Screen>('desktop');
  const [draft, setDraft] = useState<number | null>(null);
  const [frameW, setFrameW] = useState(0);
  const [drag, setDrag] = useState<{ x0: number; dx: number } | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  const page = useRef<HTMLDivElement | null>(null);
  const { w, h, vh } = SCREEN[screen];
  const place = identity.place ?? 'left';
  const height = draft ?? identity.height ?? LOGO_HEIGHT[identity.size];
  const shown: Identity = { ...identity, height };
  // The real page, rebuilt a moment after the logo stops changing; the drawing below stays as its ghost.
  const [real, setReal] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<string | null>(null);
  const held = useRef<string | null>(null);
  const shownKey = JSON.stringify(shown);
  useEffect(() => {
    if (!make) return;
    let alive = true;
    const id = setTimeout(() => {
      make(JSON.parse(shownKey) as Identity).then(
        (u) => {
          if (!alive) { URL.revokeObjectURL(u); return; }
          // The page shown is let go only once the next one is there.
          if (held.current) URL.revokeObjectURL(held.current);
          held.current = u;
          setReal(u);
        },
        (err: unknown) => console.warn('[vitrine-studio] the logo page preview failed:', err),
      );
    }, 300);
    return () => { alive = false; clearTimeout(id); };
  }, [make, shownKey]);
  useEffect(() => () => { if (held.current) URL.revokeObjectURL(held.current); }, []);
  const frameKey = `${real}-${replay}-${screen}`;

  // The card's width: the page at its own width is shrunk to it (never enlarged past 1:1).
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setFrameW(el.clientWidth);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = frameW ? Math.min(1, frameW / w) : 1;
  // A page narrower than the card (the phone) stands in its middle.
  const left = Math.max(0, (frameW - w * scale) / 2);

  // The page's own steps: the picture's address once the markup is in place, then the entrance.
  useEffect(() => {
    const root = page.current;
    if (!root) return;
    if (src) setLogoSource(root, src, identity.ratio ?? null);
    const inner = root.querySelector('.brand-in');
    inner?.classList.remove('play');
    const raf = requestAnimationFrame(() => inner?.classList.add('play'));
    return () => cancelAnimationFrame(raf);
  }, [src, identity, replay, name, screen]);

  const commit = () => {
    if (draft === null) return;
    if (draft !== identity.height) onChange({ ...identity, height: draft });
    setDraft(null);
  };

  // Dropped in the left, middle or right third of the page: that is its place.
  const drop = (clientX: number) => {
    const r = page.current?.getBoundingClientRect();
    setDrag(null);
    if (!r) return;
    const x = (clientX - r.left) / r.width;
    const next: LogoPlace = x < 1 / 3 ? 'left' : x > 2 / 3 ? 'right' : 'center';
    if (next !== place) onChange({ ...identity, place: next === 'left' ? undefined : next });
  };

  const pad = screen === 'mobile' ? 16 : Math.min(40, Math.round(w * 0.03));
  const pages = t('logo.sampleNav').split(' · ');
  const colours = { '--ink': brand.ink, '--paper': brand.paper, '--pad': `${pad}px`, width: w, height: h, left, transform: `scale(${scale})` } as CSSProperties;

  return (
    <div className="logo-on-page">
      <div className="lop-frame" ref={wrap} style={{ height: h * scale }}>
        <div className="lop-page" ref={page} style={colours} key={`${replay}-${screen}`}>
          <div className={`logo-head lop-head${place !== 'left' ? ` place-${place}` : ''}${screen === 'mobile' ? ' narrow' : ''}`}>
            {/* The markup is the page's own: the name escaped, an svg reduced to its shapes. */}
            <a className={`lop-brand${drag ? ' dragging' : ''}`} data-tip={t('logo.drag')} aria-label={t('logo.drag')}
              style={drag ? { transform: `translateX(${drag.dx / scale}px)` } : undefined}
              onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ x0: e.clientX, dx: 0 }); }}
              onPointerMove={(e) => drag && setDrag({ ...drag, dx: e.clientX - drag.x0 })}
              onPointerUp={(e) => drag && drop(e.clientX)}
              onPointerCancel={() => setDrag(null)}
              dangerouslySetInnerHTML={{ __html: brandMarkup(shown, name) }} />
            <nav className="lop-nav">{pages.map((p) => <span key={p}>{p}</span>)}</nav>
          </div>
          <div className="lop-body" aria-hidden><i /><i /><i /></div>
        </div>
        {real && (
          <iframe className={`lop-real${drawn === frameKey ? ' drawn' : ''}`} key={frameKey} src={real} title={t('logo.view.page')} sandbox="allow-scripts allow-same-origin"
            style={{ width: w, height: vh, left, transform: `scale(${scale})` }} onLoad={() => setDrawn(frameKey)} />
        )}
      </div>
      <div className="lop-controls">
        <div className="segmented glass" role="group" aria-label={t('caption.screen')}>
          {(Object.keys(SCREEN) as Screen[]).map((s) => {
            const Icon = SCREEN[s].icon;
            return <button key={s} className={`icon-btn ${screen === s ? 'on' : ''}`} aria-pressed={screen === s} aria-label={t(`caption.screen.${s}`)} data-tip={t(`caption.screen.${s}`)} onClick={() => setScreen(s)}><Icon className="ico solo" aria-hidden /></button>;
          })}
        </div>
        <div className="segmented glass" role="group" aria-label={t('logo.place')}>
          {LOGO_PLACES.map((p) => {
            const Icon = PLACE_ICON[p];
            return <button key={p} className={`icon-btn ${place === p ? 'on' : ''}`} aria-pressed={place === p} aria-label={t(`logo.place.${p}`)} data-tip={t(`logo.place.${p}`)} onClick={() => onChange({ ...identity, place: p === 'left' ? undefined : p })}><Icon className="ico solo" aria-hidden /></button>;
          })}
        </div>
        <label className="lop-size" data-tip={t('logo.height')}>
          <span className="small muted">{t('logo.height')}</span>
          <input type="range" min={LOGO_HEIGHT_MIN} max={LOGO_HEIGHT_MAX} value={height} aria-label={t('logo.height')}
            onChange={(e) => setDraft(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
          <span className="small lop-px">{height} px</span>
        </label>
      </div>
    </div>
  );
}
