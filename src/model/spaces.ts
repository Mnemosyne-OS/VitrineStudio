/**
 * Where every screen of the studio is filed (doc 145 §10.25): three spaces for
 * three questions, instead of a row of tabs.
 *
 * - `content`: what she shows (creations, scenes, the film, the blog, her pages).
 * - `design`: what it looks like (one screen, the real site in the middle).
 * - `online`: whether it is found (state and address, search, languages, connection, copies).
 *
 * Costs and Settings stay two tools beside them. Pure: the screens themselves
 * are picked by App, and the agent door's old names are resolved here.
 */

export const SPACES = ['content', 'design', 'online'] as const;
export type Space = (typeof SPACES)[number];

/** A screen of the studio: a built-in one, or a page she added, by its id. */
export type Screen = 'pieces' | 'scenes' | 'film' | 'blog' | 'about' | 'contact' | 'legal' | 'design' | 'site' | 'costs' | 'settings' | `page:${string}`;

/** The parts of the Online space, in the order they are needed after the first day. */
export const SITE_SECTIONS = ['online', 'seo', 'languages', 'connect', 'copies'] as const;
export type SiteSection = (typeof SITE_SECTIONS)[number];

/** The parts of the Design screen's panel. */
export const DESIGN_PARTS = ['theme', 'identity', 'effects', 'details'] as const;
export type DesignPart = (typeof DESIGN_PARTS)[number];

/** The Content space's entries, in her order of work; `pages` is the list of her pages. */
export const CONTENT_NAV = ['pieces', 'scenes', 'film', 'blog', 'pages'] as const;
export type ContentEntry = (typeof CONTENT_NAV)[number];

/** A screen that is one of her pages: About, Contact, the legal pages, or a page she added. */
export function isPageScreen(screen: Screen): boolean {
  return screen === 'about' || screen === 'contact' || screen === 'legal' || screen.startsWith('page:');
}

/** The space a screen is filed in; null for the two tools (costs, settings). */
export function spaceOf(screen: Screen): Space | null {
  if (screen === 'design') return 'design';
  if (screen === 'site') return 'online';
  if (screen === 'costs' || screen === 'settings') return null;
  return 'content';
}

/** The Content entry that is lit for a screen; null outside Content. */
export function contentEntryOf(screen: Screen): ContentEntry | null {
  if (spaceOf(screen) !== 'content') return null;
  if (isPageScreen(screen)) return 'pages';
  return screen as ContentEntry;
}

/** Where a name leads: the screen, and the part of it to open when the name says one. */
export interface Destination { screen: Screen; section?: SiteSection; part?: DesignPart }

const BUILT_IN: readonly Screen[] = ['pieces', 'scenes', 'film', 'blog', 'about', 'contact', 'legal', 'design', 'site', 'costs', 'settings'];

/**
 * A screen's name as a click, the site bar or an agent gives it, led to where
 * it is filed now. The names of before stay entries (doc 145 §10.19, §10.20):
 * `hosting` is Online › Online, `logo` and the old Site › Look are
 * Design › Identity (the name and the tagline are there). A name nobody knows leads to Creations, never nowhere.
 */
export function destinationOf(name: string, part?: string): Destination {
  if (name === 'hosting') return { screen: 'site', section: 'online' };
  if (name === 'logo') return { screen: 'design', part: 'identity' };
  if (name === 'pages') return { screen: 'about' };
  if (name === 'online') return { screen: 'site' };
  if (name === 'site') {
    // Site › Look moved to the Design screen. Those who still ask for it want the name or the tagline: Identity.
    if (part === 'look') return { screen: 'design', part: 'identity' };
    return (SITE_SECTIONS as readonly string[]).includes(part ?? '') ? { screen: 'site', section: part as SiteSection } : { screen: 'site' };
  }
  if (name === 'design') return (DESIGN_PARTS as readonly string[]).includes(part ?? '') ? { screen: 'design', part: part as DesignPart } : { screen: 'design' };
  if (name.startsWith('page:') && name.length > 5) return { screen: name as Screen };
  return (BUILT_IN as readonly string[]).includes(name) ? { screen: name as Screen } : { screen: 'pieces' };
}

/** The screen a space opens on: the one last seen there, else its first. */
export function openingOf(space: Space, last: Partial<Record<Space, Screen>>): Screen {
  const seen = last[space];
  if (seen && spaceOf(seen) === space) return seen;
  return space === 'content' ? 'pieces' : space === 'design' ? 'design' : 'site';
}
