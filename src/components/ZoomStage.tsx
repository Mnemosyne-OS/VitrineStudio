import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Search, ZoomOut } from 'lucide-react';
import { useI18n } from '../i18n';
import { clampView, wheelFactor, zoomAt, ZOOM_REST, type ZoomView } from '../model/zoomView';

const LENS_ZOOM = 3;

/**
 * The workbench's picture, zoomable: the wheel zooms where the pointer is, a
 * drag moves the zoomed picture, a double-click goes back to the whole photo.
 * A loupe (🔍) can follow the pointer instead. `resetKey` brings the whole
 * photo back when another version is shown.
 */
export function ZoomStage({ children, resetKey, className }: { children: ReactNode; resetKey?: string; className?: string }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ZoomView>(ZOOM_REST);
  const [loupe, setLoupe] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => setView(ZOOM_REST), [resetKey]);

  // The wheel listener is native: React's is passive, so the page would scroll under the zoom.
  useEffect(() => {
    const el = box.current;
    if (!el || loupe) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setView((v) => zoomAt(v, wheelFactor(e.deltaY), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2, r.width, r.height));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [loupe]);

  /** Where the picture is drawn in the box (object-fit leaves margins). */
  const drawn = () => {
    const img = box.current?.querySelector('img');
    if (!img) return null;
    const r = img.getBoundingClientRect();
    const nw = img.naturalWidth || r.width, nh = img.naturalHeight || r.height, sc = Math.min(r.width / nw, r.height / nh);
    const w = nw * sc, h = nh * sc;
    return { img, x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h };
  };

  const moveLens = (e: React.PointerEvent) => {
    const l = lens.current, b = drawn(), el = box.current;
    if (!l || !b || !el) return;
    const x = e.clientX - b.x, y = e.clientY - b.y;
    if (x < 0 || y < 0 || x > b.w || y > b.h) { l.classList.remove('on'); return; }
    const br = el.getBoundingClientRect(), half = l.offsetWidth / 2;
    l.classList.add('on');
    l.style.backgroundImage = `url("${b.img.src.replace(/"/g, '%22')}")`;
    l.style.left = `${e.clientX - br.left - half}px`;
    l.style.top = `${e.clientY - br.top - half}px`;
    l.style.backgroundSize = `${b.w * LENS_ZOOM}px ${b.h * LENS_ZOOM}px`;
    l.style.backgroundPosition = `${half - x * LENS_ZOOM}px ${half - y * LENS_ZOOM}px`;
  };

  const onDown = (e: React.PointerEvent) => {
    if (loupe || view.s === 1 || e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (loupe) { moveLens(e); return; }
    const d = drag.current, el = box.current;
    if (!d || d.id !== e.pointerId || !el) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.x = e.clientX; d.y = e.clientY;
    setView((v) => clampView({ s: v.s, x: v.x + dx, y: v.y + dy }, el.clientWidth, el.clientHeight));
  };
  const onUp = () => { drag.current = null; };
  const onDouble = (e: React.MouseEvent) => {
    const el = box.current;
    if (loupe || !el) return;
    const r = el.getBoundingClientRect();
    setView((v) => (v.s > 1 ? ZOOM_REST : zoomAt(v, 2.5, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2, r.width, r.height)));
  };

  const zoomed = view.s > 1;
  return (
    <div ref={box} className={`zoom-stage ${className ?? ''} ${loupe ? 'loupe' : zoomed ? 'zoomed' : ''}`}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onPointerLeave={() => lens.current?.classList.remove('on')} onDoubleClick={onDouble}>
      <div className="zoom-layer" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}>{children}</div>
      {loupe && <div ref={lens} className="zoom-lens" aria-hidden />}
      <div className="zoom-bar glass" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <button className={`icon-btn ${loupe ? 'chosen' : ''}`} aria-pressed={loupe} aria-label={t('zoom.loupe')} data-tip={t('zoom.loupe')}
          onClick={() => { setLoupe((o) => !o); setView(ZOOM_REST); }}><Search className="ico solo" aria-hidden /></button>
        {zoomed && <>
          <span className="zoom-level">×{view.s.toFixed(1)}</span>
          <button className="icon-btn" aria-label={t('zoom.reset')} data-tip={t('zoom.reset')} onClick={() => setView(ZOOM_REST)}><ZoomOut className="ico solo" aria-hidden /></button>
        </>}
      </div>
    </div>
  );
}
