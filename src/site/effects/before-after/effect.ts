import { stateSwitch, type EffectSheet } from '../contract';
import css from './style.css?raw';
import js from './script.js?raw';
import demo from './demo.html?raw';

/** A creation's first two photos compared under a divider she drags: the raw clay and the fired piece, the sketch and the work. */
const beforeAfter: EffectSheet = {
  id: 'before-after',
  order: 35,
  name: { en: 'Before / after', fr: 'Avant / après', es: 'Antes / después' },
  about: {
    en: 'The first two photos of a creation, one over the other: a divider is dragged from one to the other.',
    fr: 'Les deux premières photos d’une création, l’une sur l’autre : un curseur se glisse de l’une à l’autre.',
    es: 'Las dos primeras fotos de una creación, una sobre otra: un cursor se desliza de una a otra.',
  },
  where: ['creation'],
  css, js, demo,
  perCreation: true,
  fits: (c) => c.photos >= 2,
  note: {
    en: 'For a creation with at least two photos. With the mouse, a finger or the arrow keys. With the turn also on for the whole site, a creation with three photos or more turns, unless the comparison is put on it from its own card.',
    fr: 'Pour une création qui a au moins deux photos. À la souris, au doigt ou aux flèches du clavier. Avec la rotation aussi allumée pour tout le site, une création de trois photos ou plus tourne, sauf si l’avant / après lui est donné depuis sa fiche.',
    es: 'Para una creación con al menos dos fotos. Con el ratón, el dedo o las flechas del teclado. Con el giro también activado para toda la web, una creación con tres fotos o más gira, salvo que el antes / después se le dé desde su ficha.',
  },
  ...stateSwitch('before-after'),
};
export default beforeAfter;
