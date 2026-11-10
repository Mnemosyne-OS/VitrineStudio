import { stateSwitch, type EffectSheet } from '../contract';
import css from './style.css?raw';
import js from './script.js?raw';
import demo from './demo.html?raw';

/** A creation turned by dragging: its photos, taken around it, go by under the pointer or the finger. */
const spin: EffectSheet = {
  id: 'spin',
  order: 37,
  name: { en: 'Turn by dragging', fr: 'Rotation par glissement', es: 'Giro al arrastrar' },
  about: {
    en: 'A creation photographed all around turns when dragged: its photos go by one after the other.',
    fr: 'Une création photographiée tout autour tourne quand on la fait glisser : ses photos défilent l’une après l’autre.',
    es: 'Una creación fotografiada alrededor gira al arrastrarla: sus fotos pasan una tras otra.',
  },
  where: ['creation'],
  css, js, demo,
  perCreation: true,
  fits: (c) => c.photos >= 3,
  adds: {
    en: 'No file of its own: it loads every photo of the creation as soon as it opens.',
    fr: 'Aucun fichier à lui : il charge toutes les photos de la création dès qu’elle s’ouvre.',
    es: 'Ningún archivo propio: carga todas las fotos de la creación en cuanto se abre.',
  },
  note: {
    en: 'For a creation with at least three photos, in the order they turn. With the mouse, a finger, or the slider under the photo (keyboard).',
    fr: 'Pour une création qui a au moins trois photos, dans l’ordre où elle tourne. À la souris, au doigt, ou par la réglette sous la photo (clavier).',
    es: 'Para una creación con al menos tres fotos, en el orden en que gira. Con el ratón, el dedo o la regleta bajo la foto (teclado).',
  },
  ...stateSwitch('spin'),
};
export default spin;
