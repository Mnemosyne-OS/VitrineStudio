import { useI18n } from '../i18n';
import type { DesignLook } from '../model/design';
import { normalizeSocials, SOCIAL_ICON, socialLinks } from '../model/socials';
import type { Brand } from '../site/buildSite';

/**
 * Design › Identity: her networks' icons at the end of the site's menu, or
 * on Contact only. The two choices are drawn as the menu would end, with HER
 * icons; with no network set there is nothing to place, and the card says
 * where they are set.
 */
export function MenuSocials({ look, brand, onTry }: { look: DesignLook; brand: Brand; onTry: (look: DesignLook) => void }) {
  const { t } = useI18n();
  const links = socialLinks(brand.socials ?? normalizeSocials(undefined, brand.instagram));
  return (
    <div className="glass card-pad">
      <h3>{t('menuSocials.title')}</h3>
      {links.length === 0 ? <p className="small muted">{t('menuSocials.none')}</p> : (
        <div className="idea-row">
          {([true, false] as const).map((on) => (
            <button key={String(on)} className={`chip-tile glass menu-socials-tile ${look.menuSocials === on ? 'chosen' : ''}`} aria-pressed={look.menuSocials === on}
              aria-label={t(on ? 'menuSocials.on' : 'menuSocials.off')} data-tip={t(on ? 'menuSocials.on' : 'menuSocials.off')} onClick={() => onTry({ ...look, menuSocials: on })}>
              <span className="ms-menu" aria-hidden>
                <i /><i /><i />
                {on && links.slice(0, 4).map((l) => <span key={l.id} className="social-ico" dangerouslySetInnerHTML={{ __html: SOCIAL_ICON[l.id] }} />)}
              </span>
              <strong>{t(on ? 'menuSocials.on' : 'menuSocials.off')}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
