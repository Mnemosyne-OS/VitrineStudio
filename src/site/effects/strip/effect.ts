import type { EffectSheet } from '../contract';
import css from './style.css?raw';
import js from './script.js?raw';
import demo from './demo.html?raw';

/** One large photo at a time. Its switch is the catalogue's layout (`viewer.layout`), as before. */
const strip: EffectSheet = {
  id: 'strip',
  order: 20,
  name: { en: 'Strip', fr: 'Défilé', es: 'Desfile' },
  about: {
    en: 'One large photo at a time, swiped or stepped, the next ones small under it.',
    fr: 'Une grande photo à la fois, glissée ou pas à pas, les suivantes en petit dessous.',
    es: 'Una foto grande cada vez, deslizada o paso a paso, las siguientes pequeñas debajo.',
  },
  where: ['gallery'],
  css, js, demo,
  moves: true,
  adds: {
    en: 'Each creation photo is written 1,600 px wide instead of 800.',
    fr: 'Chaque photo de création est écrite en 1 600 px de large au lieu de 800.',
    es: 'Cada foto de creación se escribe a 1 600 px de ancho en lugar de 800.',
  },
  note: {
    en: 'A catalogue has one layout: turning this on turns the mosaic off.',
    fr: 'Une galerie a une seule disposition : allumer celle-ci éteint la mosaïque.',
    es: 'Una galería tiene una sola disposición: activar esta apaga el mosaico.',
  },
  on: (data) => data.viewer?.layout === 'strip',
  get: (d) => d.viewer.layout === 'strip',
  set: (d, on) => {
    const viewer = { ...d.viewer };
    if (on) viewer.layout = 'strip'; else if (viewer.layout === 'strip') delete viewer.layout;
    return { viewer };
  },
};
export default strip;
