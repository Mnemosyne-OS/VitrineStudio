import { useEffect, useRef, useState } from 'react';
import { readImage } from '../data/host';
import type { SceneLayers } from '../model/sceneLayers';

/**
 * A living scene as the site will show it (doc 145 §10.18), on the scene's
 * stage: the place, the life's shadow, the piece and the life swaying from
 * the piece, room and life moved apart under the pointer. The same arithmetic
 * as the site's page (site/template.html), so what she sees here is what a
 * visitor gets.
 */
export function LivingStage({ layers, on, label, unreadable }: { layers: SceneLayers; on: boolean; label: string; unreadable: string }) {
  const [src, setSrc] = useState<Record<string, string>>({});
  const [ratio, setRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const room = useRef<HTMLDivElement>(null);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    let alive = true;
    const paths = [layers.room ?? layers.from.place, layers.potAlive.path, layers.shadowAlive?.path, layers.swayMap].filter((p): p is string => !!p);
    for (const p of paths) {
      readImage(p).then(
        (url) => alive && setSrc((s) => ({ ...s, [p]: url })),
        (err: unknown) => { console.warn('[vitrine-studio] a layer could not be read:', p, err); if (alive) setFailed(true); },
      );
    }
    return () => { alive = false; };
  }, [layers]);

  // The life on its canvas, and its sway while the stage shows it.
  const life = src[layers.potAlive.path];
  const map = layers.swayMap ? src[layers.swayMap] : undefined;
  useEffect(() => {
    const c = canvas.current;
    if (!c || !life) return;
    let frame = 0;
    let stopped = false;
    const load = (u: string) => new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('PICTURE_UNDECODABLE')); i.src = u; });
    Promise.all([load(life), map ? load(map) : Promise.resolve(null)]).then(([img, m]) => {
      if (stopped) return;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      if (!m || reduced || !on) return;
      const base = ctx.getImageData(0, 0, c.width, c.height);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(m, 0, 0, c.width, c.height);
      const md = ctx.getImageData(0, 0, c.width, c.height).data;
      ctx.putImageData(base, 0, 0);
      let last = 0;
      const out = ctx.createImageData(c.width, c.height);
      const tick = (t: number) => {
        frame = requestAnimationFrame(tick);
        if (t - last < 33) return;
        last = t;
        const w = base.width, h = base.height, d = base.data;
        const S = 0.05 * w * Math.sin(t / 700), o = out.data;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4, sx = Math.min(w - 1, Math.max(0, x + Math.round(S * (md[i]! / 255 - 0.5)))), j = (y * w + sx) * 4;
          o[i] = d[j]!; o[i + 1] = d[j + 1]!; o[i + 2] = d[j + 2]!; o[i + 3] = d[j + 3]!;
        }
        ctx.putImageData(out, 0, 0);
      };
      frame = requestAnimationFrame(tick);
    }).catch((err: unknown) => { console.warn('[vitrine-studio] the life could not be drawn:', err); if (!stopped) setFailed(true); });
    return () => { stopped = true; cancelAnimationFrame(frame); };
  }, [life, map, on, reduced]);

  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 2 - 1, py = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (room.current) room.current.style.transform = `scale(1.04) translate(${-px * 10}px, ${-py * 6}px)`;
    if (group.current) group.current.style.transform = `scale(1.04) translate(${px * 14}px, ${py * 8}px)`;
  };
  const rest = () => {
    if (room.current) room.current.style.transform = '';
    if (group.current) group.current.style.transform = '';
  };
  const box = (b: { x: number; y: number; w: number; h: number }) => ({ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` });
  const place = src[layers.room ?? layers.from.place];
  const shadow = layers.shadowAlive ? src[layers.shadowAlive.path] : undefined;

  return (
    <div className={`living-stage ${on ? 'on' : ''}`} style={ratio ? ({ '--r': ratio } as React.CSSProperties) : undefined}>
      {failed && <p className="error small living-failed">{unreadable}</p>}
      <div className="living-box" onPointerMove={tilt} onPointerLeave={rest}>
        {/* Two depths at one scale: the room with the shadows cast on it, then the piece and the life. */}
        <div ref={room} className="living-back">
          {place && <img className="living-room" src={place} alt={label} onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth) setRatio(i.naturalWidth / i.naturalHeight); }} />}
          {shadow && layers.shadowAlive && <img src={shadow} alt="" style={box(layers.shadowAlive)} />}
        </div>
        <div ref={group} className="living-group">
          <canvas ref={canvas} style={box(layers.potAlive)} aria-hidden />
        </div>
      </div>
    </div>
  );
}
