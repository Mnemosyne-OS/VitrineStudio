import { EyeOff, RectangleHorizontal, RotateCcw, SquareMousePointer, Type, type LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import { SCENE_GUIDES, SCENE_MAP_STYLES, type SceneGuide, type SceneMap, type SceneMapStyle } from '../model/sceneMap';

const GUIDE_ICON: Record<SceneGuide, LucideIcon> = { box: SquareMousePointer, text: Type, none: EyeOff };
const EDGE_ICON: Record<SceneGuide, LucideIcon> = { box: RectangleHorizontal, text: Type, none: EyeOff };

/** A few colours to start from; any other one through the picker. */
const SWATCHES = ['#1f1d1a', '#ffffff', '#3fa66a', '#b5643c', '#c9a46a', '#5b6f8a'];

/** A tiny map in the model, three places and their scenes, the second one current. */
function Sample({ style, color }: { style: SceneMapStyle; color?: string }) {
  const rows = [2, 4, 1];
  return (
    <span className={`map-sample m-${style}`} style={color ? ({ '--map-color': color } as React.CSSProperties) : undefined} aria-hidden>
      {rows.map((n, r) => (
        <span key={r} className="ms-row">
          <i className={r === 1 ? 'on' : ''} />
          {Array.from({ length: n }, (_, v) => <b key={v} className={r === 1 && v === 1 ? 'on' : ''}>{style === 'numbers' ? v + 1 : ''}</b>)}
        </span>
      ))}
    </span>
  );
}

/**
 * The settings of the site's little map of the places (Tony: « un bouton
 * settings sur cette page, différents modèles, la couleur à part »): its
 * model, drawn small so the choice is seen, and its own colour, apart from
 * the site's. Saved at once; the preview shows it on the page.
 */
export function SceneMapSettings({ value, onChange }: { value: SceneMap; onChange: (next: SceneMap) => void }) {
  const { t } = useI18n();
  return (
    <div className="scene-map-settings glass">
      <span className="form-label">{t('sceneMap.model')}</span>
      <div className="ms-models">
        {SCENE_MAP_STYLES.map((s) => (
          <button key={s} className={`chip-tile glass ms-model ${value.style === s ? 'chosen' : ''}`} aria-pressed={value.style === s} onClick={() => onChange({ ...value, style: s })}>
            <Sample style={s} color={value.color} />
            <span>{t(`sceneMap.style.${s}`)}</span>
          </button>
        ))}
      </div>
      <span className="form-label">{t('sceneMap.color')}</span>
      <div className="ms-colors">
        <button className={`chip-tile glass ${!value.color ? 'chosen' : ''}`} aria-pressed={!value.color} onClick={() => { const next: SceneMap = { ...value }; delete next.color; onChange(next); }}>
          <RotateCcw className="ico" aria-hidden />{t('sceneMap.siteColor')}
        </button>
        {SWATCHES.map((c) => (
          <button key={c} className={`ms-swatch ${value.color === c ? 'chosen' : ''}`} style={{ background: c }} aria-label={c} data-tip={c} onClick={() => onChange({ ...value, color: c })} />
        ))}
        <label className="ms-picker" data-tip={t('sceneMap.pick')}>
          <input type="color" value={value.color ?? '#1f1d1a'} onChange={(e) => onChange({ ...value, color: e.target.value.toLowerCase() })} aria-label={t('sceneMap.pick')} />
        </label>
      </div>
      {(['guide', 'edges'] as const).map((field) => (
        <div key={field} className="ms-way">
          <span className="form-label">{t(field === 'guide' ? 'sceneMap.guide' : 'sceneMap.edges')}</span>
          <div className="ms-colors">
            {SCENE_GUIDES.map((g) => {
              const Icon = (field === 'guide' ? GUIDE_ICON : EDGE_ICON)[g];
              const on = (value[field] ?? 'box') === g;
              const next: SceneMap = { ...value };
              if (g === 'box') delete next[field];
              else next[field] = g;
              return (
                <button key={g} className={`chip-tile glass ${on ? 'chosen' : ''}`} aria-pressed={on} onClick={() => onChange(next)}>
                  <Icon className="ico" aria-hidden />{t(`sceneMap.guides.${g}`)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="ms-way">
        <span className="form-label">{t('sceneMap.credit')}</span>
        <div className="ms-colors">
          {(['line', 'none'] as const).map((c) => {
            const on = (value.credit ?? 'none') === c;
            const next: SceneMap = { ...value };
            if (c === 'none') delete next.credit;
            else next.credit = c;
            const Icon = c === 'line' ? Type : EyeOff;
            return (
              <button key={c} className={`chip-tile glass ${on ? 'chosen' : ''}`} aria-pressed={on} onClick={() => onChange(next)}>
                <Icon className="ico" aria-hidden />{t(`sceneMap.credits.${c}`)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
