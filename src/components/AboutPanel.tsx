import { useI18n } from '../i18n';
import { MENU_PAGE, type Brand } from '../site/buildSite';
import { TextPagePanel } from './TextPagePanel';

/**
 * The About page, edited as it reads, so updating it needs no other tool:
 * her words with their formatting, her
 * portrait dropped or picked, its caption, and where it stands on the page,
 * beside the page itself as the site shows it.
 */
export function AboutPanel({ brand, onBrand, preview }: {
  brand: Brand;
  onBrand: (next: Partial<Brand>) => void;
  /** The page as on the site (useSite.previewInfo), shown beside the editor; absent = no stage. */
  preview?: () => Promise<string>;
}) {
  const { t } = useI18n();
  return (
    <TextPagePanel text={brand.about} onText={(about) => onBrand({ about })}
      photo={brand.portrait} onPhoto={(portrait) => onBrand({ portrait })}
      caption={brand.portraitCaption} onCaption={(portraitCaption) => onBrand({ portraitCaption })}
      layout={brand.aboutLayout ?? 'right'} look={brand.aboutLook} onLayout={(aboutLayout, aboutLook) => onBrand({ aboutLayout, aboutLook })}
      photos={brand.aboutPhotos ?? []} onPhotos={(aboutPhotos) => onBrand({ aboutPhotos })}
      photoLabel={t('site.brand.portrait')} stage={preview && { make: preview, page: MENU_PAGE.about }} />
  );
}
