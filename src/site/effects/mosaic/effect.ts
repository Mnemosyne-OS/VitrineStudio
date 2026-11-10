import type { EffectSheet } from '../contract';
import css from './style.css?raw';
import js from './script.js?raw';
import demo from './demo.html?raw';

/** The catalogue as a staggered mosaic. Its switch is the catalogue's layout (`viewer.layout`), as before. */
const mosaic: EffectSheet = {
  id: 'mosaic',
  order: 10,
  name: { en: 'Mosaic', fr: 'Mosaïque', es: 'Mosaico' },
  about: {
    en: 'The creations in columns, each photo at its own shape.',
    fr: 'Les créations en colonnes, chaque photo dans sa forme.',
    es: 'Las creaciones en columnas, cada foto con su forma.',
  },
  where: ['gallery'],
  css, js, demo,
  note: {
    en: 'A catalogue has one layout: turning this on turns the strip off.',
    fr: 'Une galerie a une seule disposition : allumer celle-ci éteint le défilé.',
    es: 'Una galería tiene una sola disposición: activar esta apaga el desfile.',
  },
  on: (data) => data.viewer?.layout === 'mosaic',
  get: (d) => d.viewer.layout === 'mosaic',
  set: (d, on) => {
    const viewer = { ...d.viewer };
    if (on) viewer.layout = 'mosaic'; else if (viewer.layout === 'mosaic') delete viewer.layout;
    return { viewer };
  },
};
export default mosaic;
