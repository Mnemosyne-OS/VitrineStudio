/**
 * The contract of an effect (doc 145 §10.25): one folder per effect under
 * `src/site/effects/<id>/`, holding
 *
 *   effect.ts    its sheet (this type): its id, its name in three languages,
 *                where it applies, how its switch reads and writes the settings
 *   style.css    its CSS, written into the site's stylesheet
 *   script.js    its script, written into the site's script: one call,
 *                `effect('<id>', (api) => ({ ...hooks }))`
 *   demo.html    its demonstration: the page's own markup, played by the
 *                effect's own CSS and script in the catalogue's card
 *
 * Adding an effect is adding a folder: the catalogue (index.ts) reads them
 * all, and the export writes into the site ONLY those that are on (`on`).
 *
 * What the page gives an effect (`api`, built in template.html):
 *   D, T                 the site's data and its words
 *   esc(text), src(img)  the page's own escaping, and a picture's file for this screen
 *   reduced              the visitor asked for less motion
 *   hovers               the screen has a pointer that hovers (never true on a touch screen)
 *   small                a phone's width
 *   stage, current()     the scenes' stage and the scene on screen
 *   on(id, creation)     whether effect `id` plays on that creation (the whole site, or its list)
 *   listed(id, creation) whether she put it on that creation herself, from its own card
 *
 * The hooks an effect may return, each optional:
 *   gallery(el)                 a catalogue was drawn
 *   viewer(creation, k, el)     a creation was opened large on its picture `k`
 *   room(scene, alt)            the markup of a scene's room, or nothing to leave it to the page
 *   play(cell)                  a scene comes on screen; true = this effect plays it
 *   page(el)                    a page was opened
 *
 * Three rules every effect keeps, each checked by effects.test.ts:
 *   an effect that moves is still for who asked for less motion (`moves`);
 *   an effect that needs a mouse plays nothing on a touch screen (`pointer`);
 *   an effect says what it adds to the page (its own bytes are measured, `adds` names its files).
 *
 * One convention between effects: the one that takes a creation's large picture for itself marks it
 * (`main.dataset.taken = '<id>'`), and the others leave that picture alone.
 */
import type { Lang } from '../../model/profiles';
import type { DesignDraft, DesignFields } from '../../model/design';
import type { SiteData } from '../buildSite';
import { withEffectState } from '../../model/effects';
import type { Scene } from '../../model/types';

export const EFFECT_PLACES = ['gallery', 'creation', 'scene', 'page'] as const;
export type EffectPlace = (typeof EFFECT_PLACES)[number];
type Words = Record<Lang, string>;

export interface EffectSheet {
  /** Its folder's name. */
  id: string;
  /** Its place in the catalogue. */
  order: number;
  name: Words;
  /** What it does, in one line. */
  about: Words;
  /** Where it applies. */
  where: readonly EffectPlace[];
  css: string;
  js: string;
  demo: string;
  /** It moves: its CSS or its script keeps it still for who asked for less motion. */
  moves?: true;
  /** It needs a mouse: nothing of it plays on a touch screen. */
  pointer?: true;
  /** What it makes the export write besides its own code, in words. */
  adds?: Words;
  /** Something to know before turning it on (where else it is set, what it replaces). */
  note?: Words;
  /** It can play on some creations only (the creation's own sheet). */
  perCreation?: true;
  /** Whether it has something to play on a creation: its number of photos, a clip of one of its scenes online. Absent = always. */
  fits?(creation: { photos: number; clip: boolean }): boolean;
  /** Whether the site as built has it: the export writes it only then. */
  on(data: SiteData): boolean;
  /** Its switch for the whole site, read from what the Design screen sets. */
  get(design: DesignFields): boolean;
  /** Its switch turned: the change to try. */
  set(design: DesignFields, on: boolean): DesignDraft;
  /**
   * What it needs written into the site's data when it is on, that the page cannot work out by
   * itself (a creation's clip, read from its scenes). Called by the build, on the data as built.
   */
  prepare?(data: SiteData, records: { scenes: readonly Scene[] }): void;
}

/**
 * The switch of an effect that has no setting of its own: it is on once she turned it on
 * (`effects.state`), or on the creations of her list; off is its starting state, stored as absent.
 */
export function stateSwitch(id: string): Pick<EffectSheet, 'on' | 'get' | 'set'> {
  return {
    on: (data) => !!data.effects?.[id],
    get: (d) => d.effects.state?.[id] === 'on',
    set: (d, on) => ({ effects: withEffectState(d.effects, id, on ? 'on' : null) }),
  };
}

/** The bytes an effect's own code adds to the page (its CSS and its script, as written). */
export function effectBytes(e: Pick<EffectSheet, 'css' | 'js'>): number {
  return new TextEncoder().encode(e.css + e.js).length;
}
