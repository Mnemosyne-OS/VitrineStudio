import { useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent } from 'react';
import { getLanguage, useI18n } from '../i18n';
import { dataUrlBytes } from '../data/bytes';
import { formatWeight } from '../format';

/**
 * One window, two pictures on top of each other, a line between them (Tony:
 * « le trait au milieu, et on le déplace pour voir la diff »). Left of the line
 * the original stretched by the screen, right of it the enlargement, both drawn
 * at the enlargement's own width so what is compared is detail, not framing.
 * Each side says its width and its weight.
 *
 * Dragging the line moves it; dragging anywhere else moves the picture, because
 * the middle of a room is often a bare wall. The arrow keys move the line.
 */
export function UpscaleCompare({ before, after, labels }: { before: string; after: string; labels?: { before: string; after: string } }) {
  const { t } = useI18n();
  const lang = getLanguage();
  const frame = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(0.5);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState<{ before?: { w: number; h: number }; after?: { w: number; h: number } }>({});
  const drag = useRef<{ mode: 'split' | 'pan'; x: number; y: number; from: { x: number; y: number } } | null>(null);

  // Both drawn at the enlargement's width; until it is known, at the original's.
  const width = size.after?.w ?? size.before?.w ?? 0;
  const ratio = size.after ? size.after.h / size.after.w : size.before ? size.before.h / size.before.w : null;

  /** The picture always covers the window: it is moved, never dragged off. */
  const clamp = (x: number, y: number) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box || !ratio || !width) return { x, y };
    const maxX = Math.max(0, (width - box.width) / 2);
    const maxY = Math.max(0, (width * ratio - box.height) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };

  const splitAt = (clientX: number) => {
    const box = frame.current?.getBoundingClientRect();
    if (box && box.width > 0) setSplit(Math.max(0, Math.min(1, (clientX - box.left) / box.width)));
  };

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    const onLine = (e.target as HTMLElement).closest('.compare-handle');
    drag.current = { mode: onLine ? 'split' : 'pan', x: e.clientX, y: e.clientY, from: offset };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (onLine) splitAt(e.clientX);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'split') splitAt(e.clientX);
    else setOffset(clamp(d.from.x + e.clientX - d.x, d.from.y + e.clientY - d.y));
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const keys = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowLeft') { e.preventDefault(); setSplit((s) => Math.max(0, s - step)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setSplit((s) => Math.min(1, s + step)); }
  };

  const place = { width: width || undefined, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` };
  const label = (side: 'before' | 'after', url: string) => {
    const dims = size[side];
    const weight = formatWeight(dataUrlBytes(url));
    return `${labels?.[side] ?? t(`upscale.compare.${side}`)}${dims ? ` · ${dims.w.toLocaleString(lang)} px · ${weight}` : ''}`;
  };
  const measure = (side: 'before' | 'after') => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setSize((s) => ({ ...s, [side]: { w, h } }));
  };

  return (
    <div className="upscale-compare">
      <div ref={frame} className="compare-frame" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img src={before} alt={t('upscale.compare.before')} style={place} draggable={false} onLoad={measure('before')} />
        <div className="compare-after" style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}>
          <img src={after} alt={t('upscale.compare.after')} style={place} draggable={false} onLoad={measure('after')} />
        </div>
        <span className="compare-label glass left">{label('before', before)}</span>
        <span className="compare-label glass right">{label('after', after)}</span>
        <button type="button" className="compare-handle" style={{ left: `${split * 100}%` }}
          aria-label={t('upscale.compare.line')} aria-valuenow={Math.round(split * 100)} role="slider"
          aria-valuemin={0} aria-valuemax={100} onKeyDown={keys}>
          <span className="compare-knob glass" aria-hidden>‹ ›</span>
        </button>
      </div>
    </div>
  );
}
