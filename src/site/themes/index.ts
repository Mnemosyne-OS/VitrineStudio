/**
 * The themes (doc 145 §10.25): every folder beside this file that holds a
 * `theme.ts` is a theme. Nothing lists them by hand.
 */
import { STARTING_THEME, type ThemeSettings } from '../../model/theme';
import type { ThemeSheet } from './contract';

const SHEETS = import.meta.glob<ThemeSheet>('./*/theme.ts', { eager: true, import: 'default' });

/** Every theme, the starting one first. */
export const THEMES: readonly ThemeSheet[] = Object.values(SHEETS).sort((a, b) => a.order - b.order);

/** The folder each sheet was read from, for the test that holds an id to its folder's name. */
export const THEME_FOLDERS: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(SHEETS).map(([path, t]) => [t.id, path.split('/')[1] ?? '']));

/** A theme by its id; one nobody knows (a theme removed since) is the starting theme, never a broken page. */
export function themeOf(id: string | undefined): ThemeSheet {
  const start = THEMES.find((t) => t.id === STARTING_THEME)!;
  return THEMES.find((t) => t.id === (id ?? STARTING_THEME)) ?? start;
}

/** The three colours the site is painted with: hers, unless she asked for the theme's own. */
export function paletteOf<C extends { ink: string; paper: string; accent: string }>(theme: ThemeSettings | undefined, hers: C): { ink: string; paper: string; accent: string } {
  return theme?.colours === 'theme' ? themeOf(theme.id).colours : { ink: hers.ink, paper: hers.paper, accent: hers.accent };
}

/** The classes the page's root carries for a theme's shapes; none for the plain ones. */
export function themeClasses(t: ThemeSheet): string {
  return [t.menu !== 'plain' ? `menu-${t.menu}` : '', t.titles !== 'plain' ? `titles-${t.titles}` : ''].filter(Boolean).join(' ');
}
