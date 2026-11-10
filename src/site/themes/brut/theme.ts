import type { ThemeSheet } from '../contract';

/** Raw: heavy capitals, labels in a typewriter's letters, square everything, a tight grid. */
const brut: ThemeSheet = {
  id: 'brut',
  order: 30,
  name: { en: 'Raw', fr: 'Brut', es: 'Bruto' },
  about: {
    en: 'Heavy titles in capitals over a rule, typewriter labels, square corners everywhere, a tight grid.',
    fr: 'De gros titres en capitales sur un filet, des libellés de machine à écrire, des angles droits partout, une grille serrée.',
    es: 'Grandes títulos en mayúsculas sobre un filete, rótulos de máquina de escribir, esquinas rectas en todo, una rejilla apretada.',
  },
  tokens: {
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    bodyWeight: '400',
    fontTitle: 'inherit',
    titleSize: 'clamp(44px, 8.5vw, 132px)',
    titleWeight: '800',
    titleStyle: 'normal',
    titleTracking: '-.045em',
    titleLh: '.88',
    titleCase: 'uppercase',
    titleGap: '32px',
    fontLabel: 'ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace',
    labelCase: 'uppercase',
    track: '.5',
    radius: '0px',
    radiusUi: '0px',
    radiusPill: '0px',
    radiusBtn: '0px',
    pad: 'clamp(14px, 2.4vw, 32px)',
    gap: '8px',
    tile: '200px',
  },
  menu: 'plain',
  titles: 'rule',
  colours: { ink: '#111111', paper: '#F4F4F0', accent: '#E4572E' },
  font: null,
};
export default brut;
