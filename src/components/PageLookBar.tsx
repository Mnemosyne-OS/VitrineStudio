import { AlignEndHorizontal, AlignStartHorizontal, AlignCenterHorizontal, RotateCcw, type LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import type { PageLayout } from '../model/pages';
import { BALANCED_LOOK, LOOK_PRESETS, PAGE_ALIGNS, PAGE_MARGINS, PHOTO_SHAPES, type LookPreset, type PageAlign, type PageLook } from '../model/pageLook';

const ALIGN_ICON: Record<PageAlign, LucideIcon> = { top: AlignStartHorizontal, center: AlignCenterHorizontal, bottom: AlignEndHorizontal };
/** The share of the picture in a drawing, out of 1. */
const SHARE = { third: 1 / 3, half: 1 / 2, twothirds: 2 / 3 } as const;

/**
 * A drawing of an arrangement: lines of text and a picture, inside the page,
 * with the margin she set. What the tile shows is what the site does.
 */
function Sketch({ preset, margin }: { preset: LookPreset; margin: PageLook['margin'] }) {
  const W = 64, H = 40;
  const m = { none: 3, s: 6, m: 9, l: 13 }[margin];
  const inner = W - 2 * m, gap = Math.max(3, m * 0.6);
  const lines = (x: number, y: number, w: number, n: number) =>
    Array.from({ length: n }, (_, i) => <rect key={i} x={x} y={y + i * 5} width={i === n - 1 ? w * 0.6 : w} height={2} rx={1} className="sk-line" />);
  if (preset.layout === 'top' || preset.layout === 'bottom') {
    const imgH = 16, top = preset.layout === 'top';
    return (
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden className="sketch">
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={4} className="sk-page" />
        <rect x={m} y={top ? 5 : H - 5 - imgH} width={inner} height={imgH} rx={2} className="sk-img" />
        {lines(m, top ? 26 : 6, inner, 2)}
      </svg>
    );
  }
  const imgW = (inner - gap) * SHARE[preset.split], txtW = inner - gap - imgW;
  const imgLeft = preset.layout === 'left';
  const imgX = imgLeft ? m : m + txtW + gap, txtX = imgLeft ? m + imgW + gap : m;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden className="sketch">
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={4} className="sk-page" />
      <rect x={imgX} y={8} width={imgW} height={24} rx={2} className="sk-img" />
      {lines(txtX, 11, txtW, 4)}
    </svg>
  );
}

/**
 * The layout of a page of words and one picture, by drawings first (doc 145
 * §10.26): six arrangements, each one click, then the margins, the height and
 * the picture's shape. A page that never had a look keeps the site of before
 * (no tile is lit); the first tile clicked gives it the balanced look.
 */
export function PageLookBar({ layout, look, onChange }: {
  layout: PageLayout;
  look: PageLook | undefined;
  /** The new arrangement and look; `look` undefined = back to the layout of before. */
  onChange: (layout: PageLayout, look: PageLook | undefined) => void;
}) {
  const { t } = useI18n();
  const shown = look ?? BALANCED_LOOK;
  const set = (change: Partial<PageLook>) => onChange(layout, { ...shown, ...change });
  return (
    <div className="look-bar glass card-pad">
      <div className="look-presets" role="group" aria-label={t('look.title')}>
        {LOOK_PRESETS.map((p) => {
          const on = !!look && layout === p.layout && (p.layout === 'top' || p.layout === 'bottom' || look.split === p.split);
          return (
            <button key={p.id} className={`look-tile ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(p.layout, { ...shown, split: p.split })}>
              <Sketch preset={p} margin={shown.margin} />
              <span className="small">{t(`look.preset.${p.id}`)}</span>
            </button>
          );
        })}
      </div>
      {look && (
        <div className="look-fine">
          <div className="look-field">
            <span className="small muted" data-tip={t('look.phone')}>{t('look.margin')}</span>
            <div className="segmented glass" role="group" aria-label={t('look.margin')}>
              {PAGE_MARGINS.map((v) => <button key={v} className={look.margin === v ? 'on' : ''} aria-pressed={look.margin === v} onClick={() => set({ margin: v })}>{t(`look.margins.${v}`)}</button>)}
            </div>
          </div>
          {(layout === 'left' || layout === 'right') && (
            <div className="look-field">
              <span className="small muted">{t('look.align')}</span>
              <div className="segmented glass" role="group" aria-label={t('look.align')}>
                {PAGE_ALIGNS.map((v) => {
                  const Icon = ALIGN_ICON[v];
                  return <button key={v} className={`icon-btn ${look.align === v ? 'on' : ''}`} aria-pressed={look.align === v} aria-label={t(`look.aligns.${v}`)} data-tip={t(`look.aligns.${v}`)} onClick={() => set({ align: v })}><Icon className="ico solo" aria-hidden /></button>;
                })}
              </div>
            </div>
          )}
          {/* Above or below the words the picture is a band across the page: no shape to choose. */}
          {(layout === 'left' || layout === 'right') && <div className="look-field">
            <span className="small muted">{t('look.shape')}</span>
            <div className="segmented glass" role="group" aria-label={t('look.shape')}>
              {PHOTO_SHAPES.map((v) => <button key={v} className={look.shape === v ? 'on' : ''} aria-pressed={look.shape === v} onClick={() => set({ shape: v })}>{t(`look.shapes.${v}`)}</button>)}
            </div>
          </div>}
          <button className="look-reset small" onClick={() => onChange(layout, undefined)}><RotateCcw className="ico" aria-hidden /> {t('look.reset')}</button>
        </div>
      )}
    </div>
  );
}
