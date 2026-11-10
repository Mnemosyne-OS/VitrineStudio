/**
 * The catalogue of effects (doc 145 §10.25): every folder beside this file that holds an
 * `effect.ts` is an effect. Nothing lists them by hand: adding one is adding its folder.
 */
import type { SiteData } from '../buildSite';
import type { EffectSheet } from './contract';

const SHEETS = import.meta.glob<EffectSheet>('./*/effect.ts', { eager: true, import: 'default' });

/** Every effect, in the catalogue's order. */
export const EFFECTS: readonly EffectSheet[] = Object.values(SHEETS).sort((a, b) => a.order - b.order);

/** The effects the site as built has on: the export writes these, and only these, into the page. */
export function activeEffects(data: SiteData): EffectSheet[] {
  return EFFECTS.filter((e) => e.on(data));
}

/** The folder each sheet was read from, for the test that holds an id to its folder's name. */
export const EFFECT_FOLDERS: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(SHEETS).map(([path, e]) => [e.id, path.split('/')[1] ?? '']));
