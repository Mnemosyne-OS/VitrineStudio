import { useI18n } from '../i18n';
import type { Brand, MenuChange } from '../site/buildSite';
import { TextPagePanel } from './TextPagePanel';
import type { PreviewProgress } from './PagePreview';

/**
 * The About page, edited as it reads (Tony: « un système pour les update
 * faciles et mise en forme facile »): her words with their formatting, her
 * portrait dropped or picked, its caption, and where it stands on the page.
 */
export function AboutPanel({ brand, onBrand, onPreview, onMenu }: {
  brand: Brand;
  onBrand: (next: Partial<Brand>) => void;
  onPreview: (progress: PreviewProgress) => Promise<string>;
  onMenu: (change: MenuChange) => void;
}) {
  const { t } = useI18n();
  return (
    <TextPagePanel text={brand.about} onText={(about) => onBrand({ about })}
      photo={brand.portrait} onPhoto={(portrait) => onBrand({ portrait })}
      caption={brand.portraitCaption} onCaption={(portraitCaption) => onBrand({ portraitCaption })}
      layout={brand.aboutLayout ?? 'right'} onLayout={(aboutLayout) => onBrand({ aboutLayout })}
      hash="a-propos" onPreview={onPreview} onMenu={onMenu} photoLabel={t('site.brand.portrait')} />
  );
}
