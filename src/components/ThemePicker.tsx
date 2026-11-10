import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import { getLanguage, useI18n } from '../i18n';
import type { DesignFields } from '../model/design';
import { STARTING_THEME } from '../model/theme';
import { JOST_WOFF2_BASE64 } from '../site/fonts/jost';
import { THEMES, themeClasses } from '../site/themes';
import { tokensStyle, type ThemeSheet } from '../site/themes/contract';
import { Thumb } from './Thumb';

/** What a thumbnail is drawn with: HER words and HER photos, never a stock page. */
export interface ThemeSample {
  /** The workshop's name, as the header writes it. */
  name: string;
  /** The first words of her menu, in her order and her names. */
  menu: readonly string[];
  /** The title of her catalogue's page. */
  title: string;
  /** Her creations' photos on disk (the first three are shown). */
  photos: readonly string[];
}

/**
 * A theme in miniature (doc 145 §10.25): its tokens laid on a small page made
 * of her name, her menu, her catalogue's title and her photos. The same
 * variables as the site reads, so what the thumbnail shows of a theme (its
 * letters, its corners, its menu, its titles) is what the site will show.
 */
function ThemeThumb({ theme, colours, sample }: { theme: ThemeSheet; colours: { ink: string; paper: string; accent: string }; sample: ThemeSample }) {
  const style = { ...tokensStyle(theme.tokens), '--paper': colours.paper, '--ink': colours.ink, '--accent': colours.accent } as CSSProperties;
  return (
    <div className={`theme-thumb ${themeClasses(theme)}`} style={style} aria-hidden>
      <div className="tt-head">
        <span className="tt-brand">{sample.name}</span>
        <span className="tt-nav">{sample.menu.slice(0, 3).map((m, i) => <span key={`${m}-${i}`}>{m}</span>)}</span>
      </div>
      <div className="tt-title">{sample.title}</div>
      <div className="tt-tiles">
        {[0, 1, 2].map((i) => (sample.photos[i] ? <Thumb key={i} path={sample.photos[i]} alt="" /> : <span key={i} className="tt-blank" />))}
      </div>
    </div>
  );
}

/**
 * Design › Theme: the themes, each a thumbnail of HER site in it, and whose
 * colours paint the site. « Try » lays a theme on the real site beside the
 * panel, like every setting of this screen: nothing is written until she
 * keeps it. Her own colours stay hers whatever the theme; the theme's are
 * there to be asked for.
 */
export function ThemePicker({ theme, look, kept, sample, onTry }: {
  /** The theme as tried. */
  theme: DesignFields['theme'];
  /** Her colours as tried (Design › Identity). */
  look: DesignFields['look'];
  /** The theme the site has now. */
  kept: DesignFields['theme'];
  sample: ThemeSample;
  onTry: (theme: DesignFields['theme']) => void;
}) {
  const { t } = useI18n();
  const lang = getLanguage();
  // What the font adds to the page as it is written there: its base64 text, not the file's own bytes.
  const fontKb = Math.round(JOST_WOFF2_BASE64.length / 1000);
  const hers = { ink: look.ink, paper: look.paper, accent: look.accent };
  return (
    <>
      <div className="theme-grid">
        {THEMES.map((th) => {
          const tried = theme.id === th.id;
          const isKept = kept.id === th.id;
          return (
            <article key={th.id} className={`theme-card glass${tried ? ' chosen' : ''}`}>
              <ThemeThumb theme={th} colours={theme.colours === 'theme' ? th.colours : hers} sample={sample} />
              <div className="fx-head">
                <strong>{th.name[lang]}</strong>
                {isKept ? <span className="chip"><Check className="ico" aria-hidden />{t('theme.kept')}</span> : tried ? <span className="chip">{t('theme.tried')}</span> : null}
              </div>
              <p className="fx-about">{th.about[lang]}</p>
              <p className="small muted">{th.font === 'jost' ? t('theme.font.own', { kb: fontKb }) : t('theme.font.system')}</p>
              {th.id === STARTING_THEME && <p className="small muted">{t('theme.starting')}</p>}
              <button className="small-btn" disabled={tried} aria-pressed={tried} onClick={() => onTry({ ...theme, id: th.id })}>{t('theme.try')}</button>
            </article>
          );
        })}
      </div>
      <div className="glass card-pad">
        <h3>{t('theme.colours.title')}</h3>
        <div className="idea-row">
          {(['own', 'theme'] as const).map((c) => {
            const shown = c === 'own' ? hers : THEMES.find((x) => x.id === theme.id)?.colours ?? hers;
            return (
              <button key={c} className={`chip-tile glass ${theme.colours === c ? 'chosen' : ''}`} aria-pressed={theme.colours === c} onClick={() => onTry({ ...theme, colours: c })}>
                <strong>{t(`theme.colours.${c}`)}</strong>
                <span className="theme-swatches" aria-hidden>{(['paper', 'ink', 'accent'] as const).map((k) => <i key={k} style={{ background: shown[k] }} />)}</span>
                <span className="muted small">{t(`theme.colours.${c}Hint`)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
