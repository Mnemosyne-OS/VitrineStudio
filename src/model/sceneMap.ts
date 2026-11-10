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
  /**
   * The names written on the scenes (the place's big title, the scene's name,
   * the map's labels) hidden: the visitor walks through the pieces, the names
   * of the rooms bring nothing (an artisan, 02/11). Absent = shown.
   */
  titles?: 'off';
  /**
   * The list of the three steps beside each scene (the place, the piece, the
   * living) hidden; the scene's counter stays. Absent = shown.
   */
  steps?: 'off';
  /**
   * The names of the three steps, per language of the site, one line each.
   * A missing name keeps the trade profile's word.
   */
  stepNames?: Partial<Record<StepLang, Partial<Record<StepBeat, string>>>>;
}

export const STEP_LANGS = ['en', 'fr', 'es'] as const;
export type StepLang = (typeof STEP_LANGS)[number];
export const STEP_BEATS = ['place', 'piece', 'alive'] as const;
export type StepBeat = (typeof STEP_BEATS)[number];

/** The step names read back: known languages and steps only, one short line each, never empty. */
export function normalizeStepNames(raw: unknown): SceneMap['stepNames'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: NonNullable<SceneMap['stepNames']> = {};
  for (const l of STEP_LANGS) {
    const r = (raw as Record<string, unknown>)[l];
    if (!r || typeof r !== 'object') continue;
    const names: Partial<Record<StepBeat, string>> = {};
    for (const b of STEP_BEATS) {
      const v = (r as Record<string, unknown>)[b];
      const clean = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
      if (clean) names[b] = clean;
    }
    if (Object.keys(names).length) out[l] = names;
  }
  return Object.keys(out).length ? out : undefined;
}

export const DEFAULT_SCENE_MAP: SceneMap = { style: 'dots' };

export function normalizeSceneMap(raw: unknown): SceneMap {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SCENE_MAP };
  const r = raw as Record<string, unknown>;
  const style = (SCENE_MAP_STYLES as readonly unknown[]).includes(r.style) ? (r.style as SceneMapStyle) : 'dots';
  const color = typeof r.color === 'string' && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color.toLowerCase() : undefined;
  const way = (v: unknown) => ((SCENE_GUIDES as readonly unknown[]).includes(v) && v !== 'box' ? (v as SceneGuide) : undefined);
  const guide = way(r.guide), edges = way(r.edges);
  const stepNames = normalizeStepNames(r.stepNames);
  return { style, ...(color ? { color } : {}), ...(guide ? { guide } : {}), ...(edges ? { edges } : {}), ...(r.credit === 'line' ? { credit: 'line' as const } : {}), ...(r.titles === 'off' ? { titles: 'off' as const } : {}), ...(r.steps === 'off' ? { steps: 'off' as const } : {}), ...(stepNames ? { stepNames } : {}) };
}
