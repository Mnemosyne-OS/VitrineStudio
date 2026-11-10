import type { EffectSheet } from '../contract';
import css from './style.css?raw';
import js from './script.js?raw';
import demo from './demo.html?raw';
import { allRows } from '../../buildSite';
import { withEffectState } from '../../../model/effects';

/**
 * A living scene (doc 145 §10.18). Which scene is living is chosen scene by scene, in Scenes, as
 * before; its switch here turns them all back to their pictures (`effects.state.living = 'off'`).
 */
const living: EffectSheet = {
  id: 'living',
  order: 50,
  name: { en: 'Living scene', fr: 'Scène vivante', es: 'Escena viva' },
  about: {
    en: 'The piece stands in front of its room: the plant sways, the room moves a little with the pointer.',
    fr: 'La pièce se détache de son décor : la plante balance, le décor bouge un peu avec le pointeur.',
    es: 'La pieza se separa de su decorado: la planta se mece, el decorado se mueve un poco con el puntero.',
  },
  where: ['scene'],
  css, js, demo,
  moves: true,
  adds: {
    en: 'The layers of each living scene (its room, the piece, its shadow, the life).',
    fr: 'Les calques de chaque scène vivante (son décor, la pièce, son ombre, le vivant).',
    es: 'Las capas de cada escena viva (su decorado, la pieza, su sombra, lo vivo).',
  },
  note: {
    en: 'Chosen scene by scene, in Scenes. Off here, those scenes show their three pictures.',
    fr: 'Se choisit scène par scène, dans Scènes. Éteint ici, ces scènes montrent leurs trois images.',
    es: 'Se elige escena por escena, en Escenas. Apagado aquí, esas escenas muestran sus tres imágenes.',
  },
  on: (data) => allRows(data).some((row) => row.scenes.some((s) => !!s.layers)),
  get: (d) => d.effects.state?.living !== 'off',
  set: (d, on) => ({ effects: withEffectState(d.effects, 'living', on ? null : 'off') }),
};
export default living;
