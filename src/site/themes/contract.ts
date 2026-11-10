/**
 * The contract of a theme (doc 145 §10.25): one folder per theme under
 * `src/site/themes/<id>/`, holding its sheet (`theme.ts`, this type). A theme
 * is a set of TOKENS laid on the one template (template.html is the
 * structure): the fonts, the titles, the labels, the corners, the spacing,
 * the shape of the menu and of the titles, and a palette. It holds no markup
 * and no rule of its own. Adding a theme is adding a folder.
 *
 * Her colours stay hers: a theme's palette is used only when she asks for it
 * (`ThemeSettings.colours`). The starting theme IS the page of before: its
 * tokens are the values the template carried, one for one.
 */
import type { Lang } from '../../model/profiles';

type Words = Record<Lang, string>;

/** The tokens the template reads, each a CSS value. */
export interface ThemeTokens {
  /** The words' font, and its weight. */
  font: string;
  bodyWeight: string;
  /** The titles: their font, size, weight, style, tracking, line height, case, and the space under a page's title. */
  fontTitle: string;
  titleSize: string;
  titleWeight: string;
  titleStyle: string;
  titleTracking: string;
  titleLh: string;
  titleCase: string;
  titleGap: string;
  /** The small labels (menu, captions, buttons): their font, their case, and how far their letters stand apart (1 = as drawn). */
  fontLabel: string;
  labelCase: string;
  track: string;
  /** The corners: of a picture, of a card of words, of a pill, of a button. */
  radius: string;
  radiusUi: string;
  radiusPill: string;
  radiusBtn: string;
  /** The page's margin, the gap between tiles, and a tile's least width. */
  pad: string;
  gap: string;
  tile: string;
}

export const MENU_SHAPES = ['plain', 'pill', 'under'] as const;
export type MenuShape = (typeof MENU_SHAPES)[number];
export const TITLE_SHAPES = ['plain', 'centered', 'rule'] as const;
export type TitleShape = (typeof TITLE_SHAPES)[number];

export interface ThemeSheet {
  /** Its folder's name. */
  id: string;
  /** Its place among the themes. */
  order: number;
  name: Words;
  /** What it looks like, in one line. */
  about: Words;
  tokens: ThemeTokens;
  menu: MenuShape;
  titles: TitleShape;
  /** Its own palette, used only when she asks for the theme's colours. */
  colours: { ink: string; paper: string; accent: string };
  /** `jost`: the font file travels inside the page. null: the visitor's own fonts, no file. */
  font: 'jost' | null;
}

/** The token's name in the page's CSS, by its key. */
const VAR: Record<keyof ThemeTokens, string> = {
  font: '--font', bodyWeight: '--body-weight', fontTitle: '--font-title', titleSize: '--title-size', titleWeight: '--title-weight', titleStyle: '--title-style',
  titleTracking: '--title-tracking', titleLh: '--title-lh', titleCase: '--title-case', titleGap: '--title-gap', fontLabel: '--font-label', labelCase: '--label-case', track: '--track',
  radius: '--radius', radiusUi: '--radius-ui', radiusPill: '--radius-pill', radiusBtn: '--radius-btn', pad: '--pad', gap: '--gap', tile: '--tile',
};
export const TOKEN_KEYS = Object.keys(VAR) as Array<keyof ThemeTokens>;

/** A theme's tokens as the declarations of `:root`. A value that could leave its declaration is refused: a theme never writes a rule. */
export function tokensCss(tokens: ThemeTokens): string {
  return TOKEN_KEYS.map((k) => {
    const v = tokens[k];
    if (/[;{}<>]/.test(v)) throw new Error(`BAD_THEME_TOKEN: ${k}`);
    return `${VAR[k]}: ${v};`;
  }).join(' ');
}

/** The same tokens as an element's inline style (the studio's thumbnails). */
export function tokensStyle(tokens: ThemeTokens): Record<string, string> {
  return Object.fromEntries(TOKEN_KEYS.map((k) => [VAR[k], tokens[k]]));
}
