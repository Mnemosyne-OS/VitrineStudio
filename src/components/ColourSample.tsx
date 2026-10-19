import type { CSSProperties } from 'react';
import { useI18n } from '../i18n';
import { Thumb } from './Thumb';

/**
 * The site's colours on its own elements, in miniature, redrawn as a swatch
 * moves: a scene (a real picture of the site, its labels and its map of dots
 * over it) and a page on the background colour (menu with the current item in
 * the accent, a title, a line of text, a rule). Same derivations as the
 * template: the soft text is the text mixed into the background, the rules are
 * the text at 18 %.
 */
export function ColourSample({ ink, paper, accent, photo }: { ink: string; paper: string; accent: string; photo?: string }) {
  const { t } = useI18n();
  const vars = {
    '--s-ink': ink,
    '--s-paper': paper,
    '--s-accent': accent,
    '--s-soft': `color-mix(in srgb, ${ink} 72%, ${paper})`,
    '--s-line': `color-mix(in srgb, ${ink} 18%, transparent)`,
  } as CSSProperties;
  return (
    <div className="colour-sample" style={vars} aria-hidden>
      <div className="sample-scene">
        {photo ? <Thumb path={photo} alt="" /> : <div className="sample-blank" />}
        <div className="sample-meta">
          <span className="sample-index">01.1 / 04</span>
          <span className="sample-title">{t('site.colours.sampleScene')}</span>
          <span className="sample-soft">{t('site.colours.samplePiece')}</span>
        </div>
        <div className="sample-map">
          {[[t('site.colours.sampleRow1'), 1], [t('site.colours.sampleRow2'), -1]].map(([name, on], i) => (
            <div key={i} className={`sample-map-row ${on === 1 ? 'on' : ''}`}>
              <span>{name}</span>
              {[0, 1, 2].map((d) => <i key={d} className={on === 1 && d === 0 ? 'here' : ''} />)}
            </div>
          ))}
        </div>
      </div>
      <div className="sample-page">
        <div className="sample-nav">
          <span className="sample-current">{t('site.colours.sampleNav1')}</span>
          <span>{t('site.colours.sampleNav2')}</span>
          <span>{t('site.colours.sampleNav3')}</span>
        </div>
        <span className="sample-title">{t('site.colours.sampleTitle')}</span>
        <span className="sample-soft">{t('site.colours.sampleText')}</span>
        <hr />
      </div>
    </div>
  );
}
