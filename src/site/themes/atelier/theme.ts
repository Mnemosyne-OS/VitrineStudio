import type { ThemeSheet } from '../contract';

/**
 * The starting theme: the page as it was before themes existed. Every token is
 * the value template.html carried in place; themes.test.ts holds them to it.
 */
const atelier: ThemeSheet = {
  id: 'atelier',
  order: 0,
  name: { en: 'Atelier', fr: 'Atelier', es: 'Atelier' },
  about: {
    en: 'Large light titles, small spaced capitals, pictures with square corners. The site as it started.',
    fr: 'De grands titres légers, de petites capitales espacées, des images à angles droits. Le site tel qu’il a commencé.',
    es: 'Grandes títulos ligeros, pequeñas mayúsculas espaciadas, imágenes de esquinas rectas. La web tal como empezó.',
  },
  tokens: {
    font: 'Jost, Futura, "Century Gothic", sans-serif',
    bodyWeight: '300',
    fontTitle: 'inherit',
    titleSize: 'clamp(48px, 9vw, 140px)',
    titleWeight: '400',
    titleStyle: 'normal',
    titleTracking: '-.035em',
    titleLh: '.9',
    titleCase: 'none',
    titleGap: '48px',
    fontLabel: 'inherit',
    labelCase: 'uppercase',
    track: '1',
    radius: '0px',
    radiusUi: '16px',
    radiusPill: '99px',
    radiusBtn: '0px',
    pad: 'clamp(16px, 3vw, 40px)',
    gap: '16px',
    tile: '220px',
  },
  menu: 'plain',
  titles: 'plain',
  colours: { ink: '#2B2926', paper: '#EEECE7', accent: '#5F5A53' },
  font: 'jost',
};
export default atelier;
