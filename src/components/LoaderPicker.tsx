import type { CSSProperties } from 'react';
import { useI18n } from '../i18n';
import type { Brand } from '../site/buildSite';
import { LOADER_CSS, LOADER_SPEEDS, LOADER_STYLES, loaderMarkup, type Loader } from '../site/loader';

/**
 * The loading screen of the site (Site › Look): none or one of four, its
 * speed, and a sample drawn by the site's own markup and CSS in her colours.
 * Saved at once.
 */
export function LoaderPicker({ brand, onChange }: { brand: Brand; onChange: (next: Loader | undefined) => void }) {
  const { t } = useI18n();
  const value = brand.loader;
  const speed = value?.speed ?? 'normal';
  const colours = { '--paper': brand.paper, '--ink': brand.ink, '--accent': brand.accent } as CSSProperties;
  return (
    <div className="glass card-pad">
      <h3>{t('loader.title')}</h3>
      <div className="idea-row">
        <button className={`chip-tile glass ${!value ? 'chosen' : ''}`} aria-pressed={!value} onClick={() => onChange(undefined)}>{t('loader.none')}</button>
        {LOADER_STYLES.map((s) => (
          <button key={s} className={`chip-tile glass ${value?.style === s ? 'chosen' : ''}`} aria-pressed={value?.style === s}
            onClick={() => onChange({ style: s, ...(value?.speed ? { speed: value.speed } : {}) })}>{t(`loader.styles.${s}`)}</button>
        ))}
      </div>
      {value && (
        <>
          <span className="form-label">{t('loader.speed')}</span>
          <div className="idea-row">
            {LOADER_SPEEDS.map((s) => (
              <button key={s} className={`chip-tile glass ${speed === s ? 'chosen' : ''}`} aria-pressed={speed === s}
                onClick={() => onChange({ style: value.style, ...(s !== 'normal' ? { speed: s } : {}) })}>{t(`loader.speeds.${s}`)}</button>
            ))}
          </div>
          <style>{LOADER_CSS}</style>
          {/* The markup is the page's own: the name escaped by loaderMarkup. */}
          <div className="loader-sample" style={colours} aria-hidden dangerouslySetInnerHTML={{ __html: loaderMarkup(value, brand.name) }} />
        </>
      )}
    </div>
  );
}
