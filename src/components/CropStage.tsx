import { useRef } from 'react';
import { useI18n } from '../i18n';
import { dragCrop, type CropHandle, type FrameCrop } from '../model/photoFrame';

const CORNERS: CropHandle[] = ['nw', 'ne', 'sw', 'se'];

/**
 * The turned photo with its crop drawn on it: the frame moves when dragged,
 * a corner resizes it, what falls outside is dimmed. Pointer capture keeps the
 * drag on the element that started it, so no listener outlives a drag.
 */
export function CropStage({ src, crop, lock, onCrop }: {
  src: string;
  crop: FrameCrop;
  /** A pixel ratio to hold, on the turned picture's size. */
  lock: { ratio: number; width: number; height: number } | null;
  onCrop: (crop: FrameCrop) => void;
}) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; handle: CropHandle; x: number; y: number; start: FrameCrop } | null>(null);

  const down = (handle: CropHandle) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, handle, x: e.clientX, y: e.clientY, start: crop };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current, el = box.current;
    if (!d || d.id !== e.pointerId || !el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    onCrop(dragCrop(d.start, d.handle, (e.clientX - d.x) / r.width, (e.clientY - d.y) / r.height, lock));
  };
  const up = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  const pct = (v: number) => `${v * 100}%`;
  return (
    <div className="crop-stage" ref={box}>
      <img src={src} alt="" draggable={false} />
      <div
        className="crop-frame"
        style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
        aria-label={t('photo.frameHint')}
        data-tip={t('photo.frameHint')}
        onPointerDown={down('move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      >
        {CORNERS.map((c) => (
          <span key={c} className={`crop-corner ${c}`} onPointerDown={down(c)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        ))}
      </div>
    </div>
  );
}
