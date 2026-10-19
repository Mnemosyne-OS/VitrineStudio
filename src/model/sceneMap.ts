/**
 * The site's little map of the places (bottom right of the scenes): how it is
 * drawn and in what colour, chosen apart from the rest of the site (Tony:
 * « différents modèles, de la personnalisation, la couleur à part »).
 */
export const SCENE_MAP_STYLES = ['dots', 'bars', 'numbers', 'thumbs', 'glass'] as const;
export type SceneMapStyle = (typeof SCENE_MAP_STYLES)[number];

/**
 * How the site tells a first visitor how to move between the scenes (Tony:
 * « plus visible, un petit encadré »): a framed guide (mouse wheel and arrow
 * keys on a computer, a hand on a touch screen), the line of text, or nothing.
 */
export const SCENE_GUIDES = ['box', 'text', 'none'] as const;
export type SceneGuide = (typeof SCENE_GUIDES)[number];

export interface SceneMap {
  style: SceneMapStyle;
  /** `#rrggbb`; absent = the site's ink. */
  color?: string;
  /** Absent = the framed guide. */
  guide?: SceneGuide;
  /** The neighbouring rooms' names at the screen's edges, the same three ways; absent = framed. */
  edges?: SceneGuide;
  /**
   * « Generated setting · real piece » written under each scene (Tony: the
   * picture is generated, the piece is real). Absent = only in the pictures' alt.
   */
  credit?: 'line';
}

export const DEFAULT_SCENE_MAP: SceneMap = { style: 'dots' };

export function normalizeSceneMap(raw: unknown): SceneMap {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SCENE_MAP };
  const r = raw as Record<string, unknown>;
  const style = (SCENE_MAP_STYLES as readonly unknown[]).includes(r.style) ? (r.style as SceneMapStyle) : 'dots';
  const color = typeof r.color === 'string' && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color.toLowerCase() : undefined;
  const way = (v: unknown) => ((SCENE_GUIDES as readonly unknown[]).includes(v) && v !== 'box' ? (v as SceneGuide) : undefined);
  const guide = way(r.guide), edges = way(r.edges);
  return { style, ...(color ? { color } : {}), ...(guide ? { guide } : {}), ...(edges ? { edges } : {}), ...(r.credit === 'line' ? { credit: 'line' as const } : {}) };
}
