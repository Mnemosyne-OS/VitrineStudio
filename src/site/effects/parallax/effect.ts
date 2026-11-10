import type { EffectSheet } from '../contract';
import css from './style.css?raw';
import js from './script.js?raw';
import demo from './demo.html?raw';

/** The catalogue's photos drift under the pointer. Its switch is `viewer.parallax`, as before. */
const parallax: EffectSheet = {
  id: 'parallax',
  order: 30,
  name: { en: 'Parallax', fr: 'Parallaxe', es: 'Paralaje' },
  about: {
    en: 'Under the pointer, each photo drifts a little, at its own depth.',
    fr: 'Sous le pointeur, chaque photo glisse un peu, à sa propre profondeur.',
    es: 'Bajo el puntero, cada foto se desliza un poco, a su propia profundidad.',
  },
  where: ['gallery'],
  css, js, demo,
  moves: true,
  pointer: true,
  on: (data) => !!data.viewer?.parallax,
  get: (d) => !!d.viewer.parallax,
  set: (d, on) => {
    const viewer = { ...d.viewer };
    if (on) viewer.parallax = true; else delete viewer.parallax;
    return { viewer };
  },
};
export default parallax;
