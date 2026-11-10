/**
 * The site's theme as she chose it (doc 145 §10.25). Stored sparse: a site
 * from before reads as `{}`, which is the starting theme with her own colours,
 * exactly the page it had.
 */
export interface ThemeSettings {
  /** The theme's id (src/site/themes). Absent = the starting theme. */
  id?: string;
  /** `theme` = the theme's own colours replace hers on the site. Absent = her colours, whatever the theme. */
  colours?: 'theme';
}

/** The theme every site starts with: the page as it was before themes existed. */
export const STARTING_THEME = 'atelier';

/**
 * The theme as read from site.json. The starting theme is never stored (it is the absence of a
 * choice), and anything that is not an id or the word `theme` is dropped.
 */
export function normalizeTheme(raw: unknown): ThemeSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: ThemeSettings = {};
  if (typeof r.id === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(r.id) && r.id !== STARTING_THEME) out.id = r.id;
  if (r.colours === 'theme') out.colours = 'theme';
  return out;
}
