import type { ThemeSheet } from '../contract';

/** Soft and round: rounded pictures and buttons, a menu of pills, friendly bold titles. */
const douceur: ThemeSheet = {
  id: 'douceur',
  order: 20,
  name: { en: 'Soft', fr: 'Douceur', es: 'Suave' },
  about: {
    en: 'Rounded pictures and buttons, a menu of pills, bold round titles.',
    fr: 'Des images et des boutons arrondis, un menu en pastilles, des titres ronds et gras.',
    es: 'Imágenes y botones redondeados, un menú en pastillas, títulos redondos y gruesos.',
  },
  tokens: {
    font: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", Nunito, "Segoe UI", system-ui, sans-serif',
    bodyWeight: '400',
    fontTitle: 'inherit',
    titleSize: 'clamp(36px, 6vw, 84px)',
    titleWeight: '700',
    titleStyle: 'normal',
    titleTracking: '-.025em',
    titleLh: '1',
    titleCase: 'none',
    titleGap: '36px',
    fontLabel: 'inherit',
    labelCase: 'none',
    track: '.2',
    radius: '20px',
    radiusUi: '22px',
    radiusPill: '99px',
    radiusBtn: '99px',
    pad: 'clamp(16px, 3.5vw, 48px)',
    gap: '20px',
    tile: '220px',
  },
  menu: 'pill',
  titles: 'plain',
  colours: { ink: '#2E2A3B', paper: '#FBF6F0', accent: '#C4674A' },
  font: null,
};
export default douceur;
