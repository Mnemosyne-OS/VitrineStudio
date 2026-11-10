import { stateSwitch, type EffectSheet } from '../contract';
import css from './style.css?raw';
import js from './script.js?raw';
import demo from './demo.html?raw';

/** What a page holds comes in as it is scrolled to: its creations, its posts, its paragraphs. */
const reveal: EffectSheet = {
  id: 'reveal',
  order: 60,
  name: { en: 'Reveal on scroll', fr: 'Apparition au défilement', es: 'Aparición al desplazar' },
  about: {
    en: 'On a page, the creations, the posts and the paragraphs rise into place as they are scrolled to.',
    fr: 'Sur une page, les créations, les articles et les paragraphes montent en place quand on arrive dessus.',
    es: 'En una página, las creaciones, los artículos y los párrafos suben a su sitio al llegar a ellos.',
  },
  where: ['page', 'gallery'],
  css, js, demo,
  moves: true,
  ...stateSwitch('reveal'),
};
export default reveal;
