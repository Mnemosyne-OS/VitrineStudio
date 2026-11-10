import type { EffectSheet } from '../contract';
import css from './style.css?raw';
import js from './script.js?raw';
import demo from './demo.html?raw';

/**
 * The loupe over a creation opened large. Its switch is `viewer.loupe`, as before (which lens is
 * chosen under the catalogue); on one creation only, it is the round lens.
 */
const loupe: EffectSheet = {
  id: 'loupe',
  order: 40,
  name: { en: 'Loupe', fr: 'Loupe', es: 'Lupa' },
  about: {
    en: 'A lens follows the pointer over a creation opened large; a tap zooms on a touch screen.',
    fr: 'Une lentille suit le pointeur sur une création ouverte en grand ; au toucher, un appui zoome.',
    es: 'Una lente sigue al puntero sobre una creación abierta en grande; al tacto, un toque amplía.',
  },
  where: ['creation'],
  css, js, demo,
  perCreation: true,
  adds: {
    en: 'A sharp copy of each photo it plays on.',
    fr: 'Une copie nette de chaque photo où elle joue.',
    es: 'Una copia nítida de cada foto donde actúa.',
  },
  on: (data) => (!!data.viewer && data.viewer.loupe !== 'none') || !!data.effects?.loupe,
  get: (d) => d.viewer.loupe !== 'none',
  set: (d, on) => ({ viewer: { ...d.viewer, loupe: on ? (d.viewer.loupe === 'none' ? 'lens' : d.viewer.loupe) : 'none' } }),
};
export default loupe;
