/**
 * Every key the code asks for exists in the three languages, and the three
 * files carry the same keys. A missing key renders its raw name on screen.
 */
import en from './en.json';
import fr from './fr.json';
import es from './es.json';
import { ERROR_CODES } from '../components/errors';

// Vite reads the sources as text: no Node types needed in the cartridge.
const SOURCES = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Keys built at runtime from a literal prefix, expanded to their real values. */
const DYNAMIC: Record<string, string[]> = {
  'tab.': ['scenes', 'pieces', 'film', 'logo', 'site', 'hosting', 'costs', 'settings'],
  'logo.mode.': ['logo', 'both', 'name'],
  'logo.size.': ['s', 'm', 'l'],
  'logo.anims.': ['none', 'fade', 'rise', 'blur', 'reveal', 'zoom', 'spin', 'slide', 'letters', 'draw', 'breathe'],
  'logo.speed.': ['slow', 'normal', 'fast'],
  'vector.detail.': ['fine', 'medium', 'simple'],
  'scenes.size.': ['s', 'm', 'l'],
  'upscale.compare.': ['before', 'after', 'line'],
  'site.quality.': ['standard', 'high', 'max', 'standardHint', 'highHint', 'maxHint'],
  'upscale.scaleHint.': ['1_5', '2', '3', '4'],
  'film.export.encoder.': ['h264_nvenc', 'h264_qsv', 'h264_amf', 'h264_mf', 'libvpx_vp9'],
  'site.go.missing.': ['scene', 'name'],
  'hosting.domain.': ['live', 'sent', 'notYet', 'todo', 'unread', 'remove', 'removeSure'],
  'hosting.dns.': ['copy', 'copied'],
  'motion.': ['images', 'living', 'video', 'imagesHint', 'livingHint', 'videoHint'],
  'motion.step.': ['cut-piece', 'cut-alive', 'compute', 'save'],
  'site.brand.colour.': ['ink', 'paper', 'accent'],
  'error.': [...ERROR_CODES, 'unknown', 'unknownPiece'],
  'clip.camera.': ['still', 'push', 'pan'],
  'caption.field.': ['name', 'size', 'description', 'price'],
  'caption.place.': ['br', 'bl', 'tr'],
  'caption.screen.': ['desktop', 'tablet', 'mobile'],
  'caption.anim.': ['fade', 'rise', 'zoom', 'lines', 'none'],
  'sceneMap.style.': ['dots', 'bars', 'numbers', 'thumbs', 'glass'],
  'logo.place.': ['left', 'center', 'right'],
  'page.type.': ['scenes', 'blog', 'catalogue', 'text', 'form'],
  'form.kind.': ['text', 'email', 'tel', 'textarea', 'date', 'number', 'choice', 'check'],
  'form.sendsTo.': ['formspree', 'email', 'none'],
  'photo.making.': ['cutout', 'plain', 'backdrop'],
  'viewer.loupes.': ['none', 'lens', 'square', 'zoom'],
  'sceneMap.guides.': ['box', 'text', 'none'],
  'sceneMap.credits.': ['line', 'none'],
  'legal.missing.': ['owner', 'address', 'siret', 'contact', 'host'],
  'legal.page.': ['notice', 'privacy'],
  'takeaway.folder.': ['all', 'table', 'site'],
  'film.workshop.ideas.': ['bright', 'wood', 'stone', 'concrete', 'garden'],
  'film.workshop.ideaText.': ['bright', 'wood', 'stone', 'concrete', 'garden'],
  'viewer.frames.': ['none', 'shadow', 'frame', 'round'],
  'photo.backdrops.': ['wood', 'linen', 'marble', 'concrete', 'shelf', 'garden'],
  'about.layouts.': ['right', 'left', 'top'],
  'contact.layouts.': ['left', 'right'],
  'logo.view.': ['page', 'logo'],
  'studio.redo.noteHint.': ['place', 'piece', 'alive'],
  'clip.light.': ['steady', 'sun'],
  'scenes.': ['makeAll', 'makeRest', 'decorMoved', 'decorStill'],
};
const COUNTED = ['app.unreadable', 'app.folderReread', 'pieces.count', 'scenes.count', 'scenes.onSite', 'site.what.count', 'site.go.exported', 'film.makeImages', 'film.makeFilm', 'takeaway.done', 'site.heavyClips', 'takeaway.restored', 'takeaway.kept', 'takeaway.failed', 'film.wizard.createAndMake', 'remove.deleteHint', 'remove.left', 'upscale.run', 'site.quality.notEnlarged', 'costs.calls', 'costs.unmeasured', 'costs.aheadImages', 'costs.aheadClips', 'upscale.keepAll', 'vector.elements', 'vector.cutClear', 'parts.selected', 'kit.pages', 'kit.added'];

function wanted(): Set<string> {
  const keys = new Set<string>();
  for (const code of Object.values(SOURCES)) {
    for (const m of code.matchAll(/\b(?:t|translate)\(\s*'([^'`]+)'/g)) if (m[1]) keys.add(m[1]);
  }
  for (const [prefix, values] of Object.entries(DYNAMIC)) values.forEach((v) => keys.add(prefix + v));
  for (const base of COUNTED) ['one', 'many'].forEach((n) => keys.add(`${base}.${n}`));
  return keys;
}

describe('locales', () => {
  const dicts = { en, fr, es } as Record<string, Record<string, string>>;

  it('finds the keys at all (the scan is not silently empty)', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(8);
    expect(wanted().size).toBeGreaterThan(60);
  });

  it.each(['en', 'fr', 'es'])('%s has every key the code uses', (lang) => {
    const missing = [...wanted()].filter((k) => !(k in dicts[lang]!));
    expect(missing).toEqual([]);
  });

  it('the three files carry the same keys', () => {
    const base = Object.keys(en).sort();
    expect(Object.keys(fr).sort()).toEqual(base);
    expect(Object.keys(es).sort()).toEqual(base);
  });
});
