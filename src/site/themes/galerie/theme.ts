import type { ThemeSheet } from '../contract';

/** An art gallery's catalogue: serif titles in italics over a rule, quiet labels, an underlined menu. */
const galerie: ThemeSheet = {
  id: 'galerie',
  order: 10,
  name: { en: 'Gallery', fr: 'Galerie', es: 'Galería' },
  about: {
    en: 'Serif titles in italics over a fine rule, labels in plain letters, an underlined menu.',
    fr: 'Des titres à empattements en italique sur un filet, des libellés en minuscules, un menu souligné.',
    es: 'Títulos con serifa en cursiva sobre un filete, rótulos en minúsculas, un menú subrayado.',
  },
  tokens: {
    font: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    bodyWeight: '400',
    fontTitle: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    titleSize: 'clamp(40px, 6.5vw, 96px)',
    titleWeight: '400',
    titleStyle: 'italic',
    titleTracking: '-.015em',
    titleLh: '1',
    titleCase: 'none',
    titleGap: '40px',
    fontLabel: '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif',
    labelCase: 'none',
    track: '.25',
    radius: '0px',
    radiusUi: '4px',
    radiusPill: '4px',
    radiusBtn: '0px',
    pad: 'clamp(20px, 5vw, 72px)',
    gap: '28px',
    tile: '240px',
  },
  menu: 'under',
  titles: 'rule',
  colours: { ink: '#1F1B16', paper: '#FAF7F2', accent: '#9A5B3C' },
  font: null,
};
export default galerie;
