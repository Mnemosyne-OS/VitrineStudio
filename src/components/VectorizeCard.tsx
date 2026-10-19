import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Scissors, Undo2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { CUT_WIDTH, cutMask, DEFAULT_VECTORIZE, inkMask, snipAt, vectorize, type Cut, type Pixels, type VectorizeOptions } from '../site/vectorize';
import { countParts, splitCompound } from '../site/logoParts';
import { describeError, errorText } from './errors';
import { LOGO_SVG_MAX_CHARS, sanitizeSvg } from '../site/logo';

/** How far an outline may move, per choice (pixels of the traced picture). */
const DETAIL = { fine: 0.6, medium: 1.2, simple: 2.5 } as const;
type Detail = keyof typeof DETAIL;

/**
 * A picture's pixels at a size the tracer likes: a small logo is drawn twice
 * as large first (smoother curves), a big one is brought down to 900 px.
 */
async function pixelsOf(src: string): Promise<Pixels> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    // A picture that never answers is not left waiting.
    const timer = setTimeout(() => reject(new Error('READ_TIMEOUT')), 15_000);
    img.onload = () => { clearTimeout(timer); resolve(); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('PICTURE_UNDECODABLE')); };
    img.src = src;
  });
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longest < 450 ? 2 : Math.min(1, 900 / longest);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS');
  ctx.drawImage(img, 0, 0, w, h);
  return { width: w, height: h, data: ctx.getImageData(0, 0, w, h).data };
}

/**
 * Turning a picture logo into a vector one, in the studio: a few choices,
 * the picture and its tracing side by side on the site's background, redrawn
 * as a choice changes. Nothing is kept until "Use the tracing".
 */
export function VectorizeCard({ src, paper, ink, onUse }: { src: string; paper: string; ink: string; onUse: (svg: string) => void }) {
  const { t, tc } = useI18n();
  const [pixels, setPixels] = useState<Pixels | null>(null);
  const [auto, setAuto] = useState(true);
  const [threshold, setThreshold] = useState(128);
  const [invert, setInvert] = useState(false);
  const [detail, setDetail] = useState<Detail>('medium');
  const [smooth, setSmooth] = useState(true);
  // The tracing already split into its elements: what "Use" hands over, and what is counted.
  const [result, setResult] = useState<{ svg: string; elements: number } | null | undefined>(undefined);
  // Lines drawn across the ink where touching shapes must come apart.
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [cutting, setCutting] = useState(false);
  const [drawing, setDrawing] = useState<Cut | null>(null);
  const overlay = useRef<SVGSVGElement>(null);
  const [tooHeavy, setTooHeavy] = useState(false);
  const [error, setError] = useState<{ key: string; raw?: string } | null>(null);

  const options = useMemo<VectorizeOptions>(() => ({ ...DEFAULT_VECTORIZE, threshold: auto ? null : threshold, invert, detail: DETAIL[detail], smooth }), [auto, threshold, invert, detail, smooth]);

  useEffect(() => {
    setCuts([]);
    let alive = true;
    pixelsOf(src).then((p) => alive && setPixels(p), (err: unknown) => alive && setError(describeError(err)));
    return () => { alive = false; };
  }, [src]);

  // Traced again a moment after the last change, so a slider stays fluid.
  useEffect(() => {
    if (!pixels) return;
    setResult(undefined);
    const timer = setTimeout(() => {
      const o: VectorizeOptions = { ...options, cuts };
      const out = vectorize(pixels, o);
      // Shown as HTML below: only what the sanitizer keeps, nothing when it keeps nothing.
      const heavy = !!out && out.svg.length > LOGO_SVG_MAX_CHARS;
      const clean = out && !heavy ? sanitizeSvg(out.svg) : null;
      // Each outline with its holes becomes an element (whole when the split would be too heavy).
      const svg = clean ? splitCompound(clean, LOGO_SVG_MAX_CHARS) ?? clean : null;
      setTooHeavy(heavy);
      setResult(svg ? { svg, elements: countParts(svg) } : null);
    }, 180);
    return () => clearTimeout(timer);
  }, [pixels, options, cuts]);

  // A point of the pointer in the traced picture's pixels.
  const at = (e: PointerEvent): [number, number] | null => {
    const m = overlay.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };
  const down = (e: PointerEvent) => {
    const p = at(e);
    if (!p) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrawing([p[0], p[1], p[0], p[1]]);
  };
  const move = (e: PointerEvent) => {
    const p = at(e);
    if (drawing && p) setDrawing([drawing[0], drawing[1], p[0], p[1]]);
  };
  const up = () => {
    if (!drawing || !pixels) { setDrawing(null); return; }
    if (Math.hypot(drawing[2] - drawing[0], drawing[3] - drawing[1]) > 6) {
      // Dragged: the line as drawn.
      setCuts((c) => [...c, drawing]);
    } else {
      // Tapped: the shortest way across the ink there, on the ink as already cut.
      const mask = inkMask(pixels, options);
      cutMask(mask, pixels.width, pixels.height, cuts, CUT_WIDTH);
      const snip = snipAt(mask, pixels.width, pixels.height, drawing[0], drawing[1]);
      if (snip) setCuts((c) => [...c, snip]);
    }
    setDrawing(null);
  };

  return (
    <div className={`glass card-pad full vectorize${cutting ? ' cutting' : ''}`}>
      <div className="row card-head">
        <h3>{t('vector.title')}</h3>
        <button className={`chip-tile glass ${cutting ? 'chosen' : ''}`} onClick={() => setCutting(!cutting)} aria-pressed={cutting} disabled={!pixels}>
          <Scissors className="ico" aria-hidden /><strong>{t('vector.cut')}</strong>
        </button>
        {cuts.length > 0 && <>
          <button onClick={() => setCuts((c) => c.slice(0, -1))}><Undo2 className="ico" aria-hidden />{t('vector.cutUndo')}</button>
          <button className="link" onClick={() => setCuts([])}>{tc('vector.cutClear', cuts.length)}</button>
        </>}
      </div>
      <div className="vector-compare" style={{ background: paper, color: ink }}>
        {!cutting && <figure><img src={src} alt={t('vector.before')} /><figcaption>{t('vector.before')}</figcaption></figure>}
        <figure>
          <div className="vector-cut">
            {/* The tracing is only paths, reduced again by sanitizeSvg. */}
            {result ? <div className="vector-out" dangerouslySetInnerHTML={{ __html: result.svg }} /> : <div className="vector-out muted small">{result === null ? t(tooHeavy ? 'vector.tooHeavy' : 'vector.nothing') : t('vector.working')}</div>}
            {/* Drawn over the tracing in its own pixels: where the ink will be cut. */}
            {pixels && (cutting || cuts.length > 0) && (
              <svg ref={overlay} className="cut-layer" viewBox={`0 0 ${pixels.width} ${pixels.height}`} preserveAspectRatio="xMidYMid meet"
                onPointerDown={cutting ? down : undefined} onPointerMove={cutting ? move : undefined} onPointerUp={cutting ? up : undefined} onPointerCancel={() => setDrawing(null)}>
                {[...cuts, ...(drawing ? [drawing] : [])].map((c, i) => <line key={i} x1={c[0]} y1={c[1]} x2={c[2]} y2={c[3]} />)}
              </svg>
            )}
          </div>
          <figcaption>{cutting ? t('vector.cutHint') : t('vector.after')}{result ? ` · ${tc('vector.elements', result.elements)}` : ''}</figcaption>
        </figure>
      </div>
      <div className="idea-row compact spaced">
        <button className={`chip-tile glass ${auto ? 'chosen' : ''}`} onClick={() => setAuto(!auto)}><strong>{t('vector.threshold')} · {t('vector.auto')}</strong></button>
        {!auto && (
          <label className="chip-tile glass vector-slider">
            <input type="range" min={10} max={245} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} aria-label={t('vector.threshold')} />
            <span className="small">{threshold}</span>
          </label>
        )}
        <button className={`chip-tile glass ${invert ? 'chosen' : ''}`} onClick={() => setInvert(!invert)}><strong>{t('vector.invert')}</strong></button>
        <button className={`chip-tile glass ${smooth ? 'chosen' : ''}`} onClick={() => setSmooth(!smooth)}><strong>{t('vector.smooth')}</strong></button>
        {(Object.keys(DETAIL) as Detail[]).map((d) => (
          <button key={d} className={`chip-tile glass ${detail === d ? 'chosen' : ''}`} onClick={() => setDetail(d)}><strong>{t(`vector.detail.${d}`)}</strong></button>
        ))}
        <button className="primary vector-use" disabled={!result} onClick={() => result && onUse(result.svg)}>✓ {t('vector.use')}</button>
      </div>
      {error && <p className="error small">{errorText(error)}</p>}
    </div>
  );
}
