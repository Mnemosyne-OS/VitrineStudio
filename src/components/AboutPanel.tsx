import { useI18n } from '../i18n';
import type { Brand } from '../site/buildSite';
import { TextPagePanel } from './TextPagePanel';

/**
 * The About page, edited as it reads (Tony: « un système pour les update
 * faciles et mise en forme facile »): her words with their formatting, her
 * portrait dropped or picked, its caption, and where it stands on the page.
 */
export function AboutPanel({ brand, onBrand }: {
  brand: Brand;
  onBrand: (next: Partial<Brand>) => void;
}) {
  const { t } = useI18n();
  return (
    <TextPagePanel text={brand.about} onText={(about) => onBrand({ about })}
      photo={brand.portrait} onPhoto={(portrait) => onBrand({ portrait })}
      caption={brand.portraitCaption} onCaption={(portraitCaption) => onBrand({ portraitCaption })}
      layout={brand.aboutLayout ?? 'right'} onLayout={(aboutLayout) => onBrand({ aboutLayout })}
      photoLabel={t('site.brand.portrait')} />
  );
}
