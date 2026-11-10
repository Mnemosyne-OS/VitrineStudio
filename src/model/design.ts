/**
 * What the Design screen sets, and the trial in between (doc 145 §10.25).
 *
 * On that screen nothing is written at once: a change is TRIED, shown on the
 * real site in the middle of the screen, and written only when she keeps it.
 * The trial holds only the fields she touched; a field put back to what the
 * site has leaves the trial, so « 2 changes tried » is always true.
 *
 * Only the fields of how the site looks travel here. Her words on the About
 * and Contact pages live in the same `brand` record: they are never part of a
 * trial, so keeping one cannot write an old text over a new one.
 */
import type { Brand, ExportQuality, ImageKb, SiteSettings, VideoLevel } from '../site/buildSite';
import type { Identity } from '../site/logo';
import type { Loader } from '../site/loader';
import type { CreationsHover } from './showcase';
import type { SceneMap } from './sceneMap';
import type { ViewerSettings } from './viewer';
import type { EffectsSettings } from './effects';
import { STARTING_THEME } from './theme';
import { stableJson } from './publish';

/** Of her brand, what says how the site looks: its name and lines, its colours, the dark pages, the loading screen. */
export interface DesignLook {
  name: string;
  tagline: string;
  introLine: string;
  ink: string;
  paper: string;
  accent: string;
  /** `never` is stored as absent in the site's settings. */
  dark: 'auto' | 'never';
  /** null is stored as absent. */
  loader: Loader | null;
}

/** Every field the Design screen sets, each with a value (what is absent in the settings has its starting value here). */
export interface DesignFields {
  look: DesignLook;
  identity: Identity;
  viewer: ViewerSettings;
  creationsHover: CreationsHover;
  sceneMap: SceneMap;
  quality: ExportQuality;
  imageKb: ImageKb;
  /** `light` is stored as absent. */
  videoLevel: 'light' | VideoLevel;
  /** The effects turned on or off (model/effects.ts). */
  effects: EffectsSettings;
  /** The theme, and whose colours paint the site: hers (`own`, stored as absent) or the theme's. */
  theme: { id: string; colours: 'own' | 'theme' };
}
export type DesignKey = keyof DesignFields;
/** A trial: the fields she changed and has not kept yet. */
export type DesignDraft = Partial<DesignFields>;

/** How the site looks now, read from its settings. */
export function designOf(site: SiteSettings): DesignFields {
  const b = site.brand;
  return {
    look: { name: b.name, tagline: b.tagline, introLine: b.introLine, ink: b.ink, paper: b.paper, accent: b.accent, dark: b.dark ?? 'never', loader: b.loader ?? null },
    identity: site.identity,
    viewer: site.viewer,
    creationsHover: site.creationsHover,
    sceneMap: site.sceneMap,
    quality: site.quality,
    imageKb: site.imageKb,
    videoLevel: site.videoLevel ?? 'light',
    effects: site.effects,
    theme: { id: site.theme.id ?? STARTING_THEME, colours: site.theme.colours ?? 'own' },
  };
}

const same = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);

/** The trial with one more change. A field equal to what the site has is not a change: it leaves the trial. */
export function tryDesign(site: SiteSettings, draft: DesignDraft, change: DesignDraft): DesignDraft {
  const now = designOf(site) as unknown as Record<string, unknown>;
  const next: DesignDraft = { ...draft, ...change };
  for (const k of Object.keys(next) as DesignKey[]) if (next[k] === undefined || same(next[k], now[k])) delete next[k];
  return next;
}

/** The fields a trial changes, in the order of the screen. */
export function draftKeys(draft: DesignDraft): DesignKey[] {
  return (Object.keys(draft) as DesignKey[]).filter((k) => draft[k] !== undefined);
}

/**
 * How many settings a trial changes, as she would count them: a field that holds several settings
 * (her colours, the catalogue's layout and its loupe, the effects' switches) counts each one that differs.
 */
export function draftCount(site: SiteSettings, draft: DesignDraft): number {
  const now = designOf(site) as unknown as Record<string, unknown>;
  const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const count = (x: unknown, y: unknown, depth: number): number => {
    if (same(x, y)) return 0;
    // A group she never touched is absent: beside one that holds settings, it is an empty group.
    const a = x === undefined && plain(y) ? {} : x, b = y === undefined && plain(x) ? {} : y;
    if (!plain(a) || !plain(b) || depth === 0) return 1;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].reduce((n, k) => n + count(a[k], b[k], depth - 1), 0);
  };
  // Two levels: `look.accent`, `viewer.layout`, `effects.state.<id>`; a loading screen or a list changed is one setting.
  return draftKeys(draft).reduce((n, k) => n + count(now[k], draft[k], k === 'effects' ? 2 : 1), 0);
}

/**
 * The site with a trial laid on it: what the preview shows, and what keeping
 * writes. Sparse as the settings are: a starting value is stored as absent.
 */
export function withDesign(site: SiteSettings, draft: DesignDraft): SiteSettings {
  if (!draftKeys(draft).length) return site;
  const next: SiteSettings = { ...site };
  if (draft.look) {
    const { dark, loader, ...words } = draft.look;
    const brand: Brand = { ...site.brand, ...words };
    if (dark === 'auto') brand.dark = 'auto'; else delete brand.dark;
    if (loader) brand.loader = loader; else delete brand.loader;
    next.brand = brand;
  }
  if (draft.identity) next.identity = draft.identity;
  if (draft.viewer) next.viewer = draft.viewer;
  if (draft.creationsHover) next.creationsHover = draft.creationsHover;
  if (draft.sceneMap) next.sceneMap = draft.sceneMap;
  if (draft.quality) next.quality = draft.quality;
  if (draft.imageKb !== undefined) next.imageKb = draft.imageKb;
  if (draft.effects) next.effects = draft.effects;
  if (draft.theme) next.theme = { ...(draft.theme.id !== STARTING_THEME ? { id: draft.theme.id } : {}), ...(draft.theme.colours === 'theme' ? { colours: 'theme' as const } : {}) };
  if (draft.videoLevel) { if (draft.videoLevel === 'light') delete next.videoLevel; else next.videoLevel = draft.videoLevel; }
  return next;
}

/**
 * A trial kept: only the settings she changed, laid on the site as it is NOW. A trial holds
 * whole groups (her colours with her name, every effect's switch): what another door wrote into
 * the same group while the trial waited (a loupe put on one creation from its card, a tagline an
 * agent rewrote, a colour set from the preview's palette) is not hers to undo. `before` is the
 * site the trial was read against: a setting is hers when it differs from that one.
 */
export function keepDesign(current: SiteSettings, before: SiteSettings, draft: DesignDraft): SiteSettings {
  const was = designOf(before) as unknown as Record<string, unknown>, now = designOf(current) as unknown as Record<string, unknown>;
  const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const lay = (cur: unknown, old: unknown, next: unknown, depth: number): unknown => {
    if (same(old, next)) return cur;
    const o = old === undefined && plain(next) ? {} : old, n = next === undefined && plain(old) ? {} : next;
    if (!plain(o) || !plain(n) || depth === 0) return next;
    const out: Record<string, unknown> = plain(cur) ? { ...cur } : {};
    for (const k of new Set([...Object.keys(o), ...Object.keys(n)])) {
      const v = lay(out[k], o[k], n[k], depth - 1);
      if (v === undefined || (plain(v) && !Object.keys(v).length && depth > 1)) delete out[k]; else out[k] = v;
    }
    return out;
  };
  const merged: Record<string, unknown> = {};
  // The same depth as the count: `look.accent`, `viewer.layout`, `identity.height`, `effects.state.<id>`.
  for (const k of draftKeys(draft)) merged[k] = lay(now[k], was[k], draft[k], k === 'effects' ? 2 : 1);
  return withDesign(current, merged);
}

/**
 * A trial carried over a change of the site made by another door (a creation's card, an agent, the
 * preview's palette): the trial is read against the site as it is, so it must follow it. What she
 * changed stays changed, what the other door wrote is taken in, and a setting the site has caught
 * up with leaves the trial.
 */
export function rebaseDesign(before: SiteSettings, now: SiteSettings, draft: DesignDraft): DesignDraft {
  const keys = draftKeys(draft);
  if (!keys.length) return draft;
  const kept = designOf(keepDesign(now, before, draft));
  return tryDesign(now, {}, Object.fromEntries(keys.map((k) => [k, kept[k]])));
}

/** The parts of the site a click on the preview can lead to: each has its card in the panel. */
export const DESIGN_TARGETS = ['logo', 'words', 'menu', 'title', 'gallery', 'viewer', 'scene', 'map', 'loader'] as const;
export type DesignTarget = (typeof DESIGN_TARGETS)[number];
