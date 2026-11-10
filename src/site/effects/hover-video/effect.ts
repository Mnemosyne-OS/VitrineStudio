import { stateSwitch, type EffectSheet } from '../contract';
import css from './style.css?raw';
import js from './script.js?raw';
import demo from './demo.html?raw';
import { allCreations, allRows } from '../../buildSite';

/** In the catalogue, a creation under the pointer plays the clip of its scene. The clip is the scene's own, already on the site. */
const hoverVideo: EffectSheet = {
  id: 'hover-video',
  order: 33,
  name: { en: 'Video on hover', fr: 'Vidéo au survol', es: 'Vídeo al pasar' },
  about: {
    en: 'In the catalogue, a creation under the pointer plays the clip of its scene.',
    fr: 'Dans la galerie, une création sous le pointeur joue le clip de sa scène.',
    es: 'En la galería, una creación bajo el puntero reproduce el clip de su escena.',
  },
  where: ['gallery'],
  css, js, demo,
  moves: true,
  pointer: true,
  perCreation: true,
  fits: (c) => c.clip,
  adds: {
    en: 'No file of its own: the clip is the one its scene already has on the site, fetched at the first hover.',
    fr: 'Aucun fichier à lui : le clip est celui que sa scène a déjà sur le site, téléchargé au premier survol.',
    es: 'Ningún archivo propio: el clip es el que su escena ya tiene en la web, descargado al primer paso.',
  },
  note: {
    en: 'For a creation with a scene online that has a clip. The others keep their photo.',
    fr: 'Pour une création dont une scène en ligne a un clip. Les autres gardent leur photo.',
    es: 'Para una creación con una escena en línea que tiene un clip. Las demás conservan su foto.',
  },
  ...stateSwitch('hover-video'),
  // Each creation it plays on is told the clip of its first scene online that has one.
  prepare(data, records) {
    const plays = data.effects?.['hover-video'];
    const clips = new Map<string, string>();
    for (const row of allRows(data)) for (const cell of row.scenes) {
      const pieceId = records.scenes.find((s) => s.id === cell.id)?.pieceId;
      if (cell.clip && pieceId && !clips.has(pieceId)) clips.set(pieceId, cell.clip);
    }
    for (const c of allCreations(data)) {
      const clip = clips.get(c.id);
      if (clip && (plays === true || (Array.isArray(plays) && plays.includes(c.id)))) c.clip = clip;
    }
  },
};
export default hoverVideo;
