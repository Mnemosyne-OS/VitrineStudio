/**
 * Reading and making records. A file written by someone else (MnemoCRM, a
 * person editing by hand, an older version) is read through these, never
 * trusted as is: a field that cannot be read is ABSENT, never a made-up value.
 */
import { normalizeIdentity, type Identity } from '../site/logo';
import { normalizeKitApplied, type KitApplied } from './kit';
import { formspreeId, normalizeMenu, normalizeMenuOrder, type Brand, type MenuKey, type MenuNames } from '../site/buildSite';
import { normalizeCategories, normalizeHover, normalizePieceOrder, normalizeShowcase, type Category, type CreationsHover, type PieceShow } from './showcase';
import { normalizeCurrency, type CurrencySettings } from './currency';
import { normalizePosts, type BlogPost } from './blog';
import { DEFAULT_SETTINGS, PIECE_SCHEMA, PROMPT_MAX, SCENE_SCHEMA, type Beat, type Piece, type PromptKey, type Scene, type StudioSettings, CLIP_CAMERAS, CLIP_LIGHTS, type ClipCamera, type ClipLight, type ClipStyle, SCENE_MOTIONS, type SceneMotion, AGENT_MAKE_STATES, type AgentMake } from './types';
import { keepTakes, MAX_TAKES } from './takes';
import { normalizeCaption } from './caption';
import { normalizeSceneMap, type SceneMap } from './sceneMap';
import { normalizePageId, normalizePages, type SitePage } from './pages';
import { normalizeSocials } from './socials';
import { PHOTO_TAKES_MAX } from './photoTakes';
import { normalizeViewer, type ViewerSettings } from './viewer';
import { normalizeLegal, type Legal } from './legal';
import { PROFILES } from './profiles';
import { normalizeLayers } from './sceneLayers';

const text = (v: unknown, max = 200): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const isInstant = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const ASPECTS = ['1:1', '4:3', '3:4', '16:9', '9:16'];

/** A MnemoCRM product, or a piece the studio wrote: same file, same reading. */
export function normalizePiece(raw: unknown): Piece | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = text(r.id, 80);
  const name = text(r.name);
  if (!id || !name) return null;
  const piece: Piece = {
    schema: PIECE_SCHEMA,
    id,
    name,
    kind: r.kind === 'unique' ? 'unique' : 'series',
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string').slice(0, 30) : [],
  };
  if (typeof r.price === 'number' && Number.isFinite(r.price) && r.price >= 0) piece.price = r.price;
  if (typeof r.stock === 'number' && Number.isInteger(r.stock) && r.stock >= 0) piece.stock = r.stock;
  if (r.status === 'available' || r.status === 'reserved' || r.status === 'sold') piece.status = r.status;
  const photo = text(r.photoPath, 1000);
  if (photo) piece.photoPath = photo;
  const description = text(r.description, 2000);
  if (description) piece.description = description;
  if (isInstant(r.createdAt)) piece.createdAt = r.createdAt;
  if (isInstant(r.updatedAt)) piece.updatedAt = r.updatedAt;
  const pageId = normalizePageId(r.pageId);
  if (pageId) piece.pageId = pageId;
  const takes = (Array.isArray(r.photoTakes) ? r.photoTakes : []).filter((p): p is string => typeof p === 'string' && !!p).map((p) => p.slice(0, 1000)).slice(0, PHOTO_TAKES_MAX);
  if (takes.length) piece.photoTakes = takes;
  const cut = r.cutout as Record<string, unknown> | undefined;
  if (cut && typeof cut.from === 'string' && typeof cut.path === 'string' && cut.from && cut.path) piece.cutout = { from: cut.from.slice(0, 1000), path: cut.path.slice(0, 1000) };
  return piece;
}

export function normalizeScene(raw: unknown): Scene | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = text(r.id, 80);
  const pieceId = text(r.pieceId, 80);
  if (!id || !pieceId) return null;
  const images: Partial<Record<Beat, string>> = {};
  const rawImages = (r.images && typeof r.images === 'object' ? r.images : {}) as Record<string, unknown>;
  for (const beat of ['place', 'piece', 'alive'] as Beat[]) {
    const p = text(rawImages[beat], 1000);
    if (p) images[beat] = p;
  }
  const now = new Date(0).toISOString();
  const scene: Scene = {
    schema: SCENE_SCHEMA,
    id,
    pieceId,
    universe: text(r.universe, 60) ?? '',
    variant: text(r.variant, 60) ?? '',
    placeDescription: text(r.placeDescription, 1500) ?? '',
    animation: text(r.animation, 500) ?? '',
    aspectRatio: typeof r.aspectRatio === 'string' && ASPECTS.includes(r.aspectRatio) ? r.aspectRatio : DEFAULT_SETTINGS.aspectRatio,
    images,
    validated: r.validated === true,
    createdAt: isInstant(r.createdAt) ? r.createdAt : now,
    updatedAt: isInstant(r.updatedAt) ? r.updatedAt : now,
  };
  const profileId = text(r.profileId, 60);
  if (profileId && PROFILES.some((p) => p.id === profileId)) scene.profileId = profileId;
  if (r.placeFromPhoto === true) scene.placeFromPhoto = true;
  const placeSource = text(r.placeSourcePath, 1000);
  if (placeSource && !scene.placeFromPhoto) scene.placeSourcePath = placeSource;
  const prompts = readPrompts(r.prompts, ['place', 'piece', 'alive', 'clip']);
  if (prompts) scene.prompts = prompts;
  const animationRef = text(r.animationRefPath, 1000);
  if (animationRef) scene.animationRefPath = animationRef;
  if (typeof r.decorChange === 'number' && r.decorChange >= 0 && r.decorChange <= 1) scene.decorChange = r.decorChange;
  const layers = normalizeLayers(r.layers);
  if (layers) scene.layers = layers;
  if (typeof r.motion === 'string' && (SCENE_MOTIONS as readonly string[]).includes(r.motion)) scene.motion = r.motion as SceneMotion;
  const clip = text(r.clipPath, 1000);
  if (clip) scene.clipPath = clip;
  const frames = r.clipFrames as Record<string, unknown> | undefined;
  const framesFrom = frames?.from as Record<string, unknown> | undefined;
  const fp = text(frames?.piece, 1000), fa = text(frames?.alive, 1000), ffp = text(framesFrom?.piece, 1000), ffa = text(framesFrom?.alive, 1000);
  if (fp && fa && ffp && ffa) scene.clipFrames = { piece: fp, alive: fa, from: { piece: ffp, alive: ffa } };
  const takesRaw = (r.takes && typeof r.takes === 'object' ? r.takes : {}) as Record<string, unknown>;
  const takes: Partial<Record<Beat, string[]>> = {};
  for (const beat of ['place', 'piece', 'alive'] as Beat[]) {
    const list = Array.isArray(takesRaw[beat]) ? (takesRaw[beat] as unknown[]).map((p) => text(p, 1000)).filter((p): p is string => !!p && p !== scene.images[beat]) : [];
    if (list.length) takes[beat] = [...new Set(list)].slice(0, MAX_TAKES);
  }
  if (Object.keys(takes).length) scene.takes = takes;
  if (Array.isArray(r.clipTakes)) {
    const clips: NonNullable<Scene['clipTakes']> = [];
    for (const c of r.clipTakes as Array<Record<string, unknown>>) {
      const p = text(c?.path, 1000);
      if (!p || p === clip || clips.some((x) => x.path === p)) continue;
      const take: NonNullable<Scene['clipTakes']>[number] = { path: p };
      const cc = c.cut as Record<string, unknown> | undefined;
      if (cc && typeof cc.in === 'number' && typeof cc.out === 'number' && cc.in >= 0 && cc.out > cc.in) take.cut = { in: cc.in, out: cc.out };
      const cs = c.style as Record<string, unknown> | undefined;
      if (cs && typeof cs === 'object') {
        const st: ClipStyle = {};
        if ((CLIP_CAMERAS as readonly unknown[]).includes(cs.camera)) st.camera = cs.camera as ClipCamera;
        if ((CLIP_LIGHTS as readonly unknown[]).includes(cs.light)) st.light = cs.light as ClipLight;
        if (text(cs.note, 300)) st.note = text(cs.note, 300)!;
        if (Object.keys(st).length) take.style = st;
      }
      clips.push(take);
    }
    if (clips.length) scene.clipTakes = clips.slice(0, MAX_TAKES);
  }
  const notesRaw = (r.beatNotes && typeof r.beatNotes === 'object' ? r.beatNotes : {}) as Record<string, unknown>;
  const notes: Partial<Record<Beat, string>> = {};
  for (const beat of ['place', 'piece', 'alive'] as Beat[]) {
    const n = text(notesRaw[beat], 300);
    if (n) notes[beat] = n;
  }
  if (Object.keys(notes).length) scene.beatNotes = notes;
  const caption = normalizeCaption(r.caption);
  if (caption) scene.caption = caption;
  const am = r.agentMake as Record<string, unknown> | undefined;
  if (am && typeof am === 'object' && (AGENT_MAKE_STATES as readonly unknown[]).includes(am.state) && isInstant(am.requestedAt)) {
    const made: AgentMake = { state: am.state as AgentMake['state'], requestedAt: am.requestedAt };
    if (isInstant(am.at)) made.at = am.at;
    const error = text(am.error, 120);
    if (error) made.error = error;
    scene.agentMake = made;
  }
  const style = r.clipStyle as Record<string, unknown> | undefined;
  if (style && typeof style === 'object') {
    const st: ClipStyle = {};
    if ((CLIP_CAMERAS as readonly unknown[]).includes(style.camera)) st.camera = style.camera as ClipCamera;
    if ((CLIP_LIGHTS as readonly unknown[]).includes(style.light)) st.light = style.light as ClipLight;
    const note = text(style.note, 300);
    if (note) st.note = note;
    if (Object.keys(st).length) scene.clipStyle = st;
  }
  const cut = r.clipCut as Record<string, unknown> | undefined;
  if (clip && cut && typeof cut.in === 'number' && typeof cut.out === 'number' && cut.in >= 0 && cut.out > cut.in) scene.clipCut = { in: cut.in, out: cut.out };
  const job = r.clipJob as Record<string, unknown> | undefined;
  if (job && typeof job.id === 'string' && job.id && isInstant(job.startedAt)) scene.clipJob = { id: job.id, startedAt: job.startedAt };
  const enlarged = (r.enlarged && typeof r.enlarged === 'object' ? r.enlarged : {}) as Record<string, unknown>;
  for (const beat of ['place', 'piece', 'alive'] as Beat[]) {
    const e = enlarged[beat] as Record<string, unknown> | undefined;
    const from = text(e?.from, 1000);
    // Only for a beat that has its picture: an enlargement of nothing is dropped.
    // A record from before the factor (it said a width) keeps its original and is redone: scale 0.
    const scale = typeof e?.scale === 'number' && e.scale > 1 ? e.scale : 0;
    if (from && images[beat]) (scene.enlarged ??= {})[beat] = { from, scale };
  }
  const pageId = normalizePageId(r.pageId);
  if (pageId) scene.pageId = pageId;
  return scene;
}

/** Hand-written instructions, by key. Only known keys, only non-empty text; none = absent. */
export function readPrompts<K extends string>(raw: unknown, keys: readonly K[]): Partial<Record<K, string>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<K, string>> = {};
  for (const k of keys) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, PROMPT_MAX);
  }
  return Object.keys(out).length ? out : undefined;
}

/** The instruction the scene sends for `key`: the person's own when written, the trade's otherwise. */
export const promptFor = (scene: Scene, key: PromptKey, auto: string): string => scene.prompts?.[key] ?? auto;

export function normalizeSettings(raw: unknown): StudioSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    profileId: typeof r.profileId === 'string' && PROFILES.some((p) => p.id === r.profileId) ? r.profileId : DEFAULT_SETTINGS.profileId,
    advanced: r.advanced === true,
    quality: r.quality === 'fast' ? 'fast' : 'quality',
    aspectRatio: typeof r.aspectRatio === 'string' && ASPECTS.includes(r.aspectRatio) ? r.aspectRatio : DEFAULT_SETTINGS.aspectRatio,
    upscaleScale: r.upscaleScale === 1.5 || r.upscaleScale === 3 || r.upscaleScale === 4 ? r.upscaleScale : 2,
    showCosts: r.showCosts === true,
  };
}

/** A plain id that is also a safe file name. */
export function newId(prefix: string, now: Date = new Date(), rand: () => number = Math.random): string {
  return `${prefix}-${now.getTime().toString(36)}-${Math.floor(rand() * 36 ** 4).toString(36).padStart(4, '0')}`;
}

export function newScene(input: Omit<Scene, 'schema' | 'id' | 'images' | 'validated' | 'createdAt' | 'updatedAt'>, now: Date = new Date()): Scene {
  const at = now.toISOString();
  return { schema: SCENE_SCHEMA, id: newId('scene', now), images: {}, validated: false, createdAt: at, updatedAt: at, ...input };
}

export function newPiece(name: string, photoPath: string | undefined, description: string | undefined, now: Date = new Date()): Piece {
  const at = now.toISOString();
  const piece: Piece = { schema: PIECE_SCHEMA, id: newId('piece', now), name: name.trim(), kind: 'unique', status: 'available', tags: [], createdAt: at, updatedAt: at };
  if (photoPath) piece.photoPath = photoPath;
  if (description?.trim()) piece.description = description.trim();
  return piece;
}

/**
 * What is left to make for a scene, in order. A beat can only be made once the
 * one before exists, because each picture is an edit of the previous one.
 */
export function nextBeat(scene: Scene): Beat | null {
  if (!scene.images.place) return 'place';
  if (!scene.images.piece) return 'piece';
  if (!scene.images.alive) return 'alive';
  return null;
}

/** Remaking a beat throws away the beats after it: they were edits of the old picture. */
export function withoutFrom(from: Scene, beat: Beat): Scene {
  const order: Beat[] = ['place', 'piece', 'alive'];
  // What leaves is kept as a take: it can be put back or deleted (model/takes.ts).
  const scene = keepTakes(from, order.slice(order.indexOf(beat)), true);
  const images: Partial<Record<Beat, string>> = {};
  for (const b of order.slice(0, order.indexOf(beat))) if (scene.images[b]) images[b] = scene.images[b];
  const next: Scene = { ...scene, images, validated: false };
  if (beat !== 'alive') delete next.decorChange;
  // An enlargement belongs to the picture it was made from: it leaves with it.
  if (scene.enlarged) {
    const kept: Partial<Record<Beat, { from: string; scale: number }>> = {};
    for (const b of order.slice(0, order.indexOf(beat))) if (scene.enlarged[b]) kept[b] = scene.enlarged[b];
    if (Object.keys(kept).length) next.enlarged = kept;
    else delete next.enlarged;
  }
  // The clip runs from the piece to the living: any remake outdates it.
  delete next.clipPath;
  delete next.clipCut;
  delete next.clipFrames;
  delete next.clipJob;
  return next;
}

/** A MnemoCRM market (doc 124), read for the website's events page. */
export function normalizeMarket(raw: unknown): { id: string; name: string; place?: string; startDate: string; endDate?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = text(r.id, 80);
  const name = text(r.name);
  const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const startDate = day(r.startDate);
  if (!id || !name || !startDate) return null;
  const m: { id: string; name: string; place?: string; startDate: string; endDate?: string } = { id, name, startDate };
  const place = text(r.place, 200);
  if (place) m.place = place;
  const end = day(r.endDate);
  if (end && end >= startDate) m.endDate = end;
  return m;
}

/** The website settings (studio/site.json). Unknown fields are dropped, missing ones empty. */
export function normalizeSiteSettings(raw: unknown, fallbackName: string) {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const b = (r.brand && typeof r.brand === 'object' ? r.brand : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const accent = typeof b.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.accent) ? b.accent : '#5F5A53';
  const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
  const brand: Brand = { accent, ink: hex(b.ink, '#2B2926'), paper: hex(b.paper, '#EEECE7'), name: str(b.name, 80) || fallbackName, tagline: str(b.tagline, 160), about: str(b.about, 4000), email: str(b.email, 200), instagram: str(b.instagram, 60), introLine: str(b.introLine, 300), portraitCaption: str(b.portraitCaption, 300), contactNote: str(b.contactNote, 2000), formspree: formspreeId(str(b.formspree, 120)) ?? '' };
  if (typeof b.portrait === 'string' && b.portrait) brand.portrait = b.portrait.slice(0, 1000);
  if (b.aboutLayout === 'left' || b.aboutLayout === 'top') brand.aboutLayout = b.aboutLayout;
  if (b.contactLayout === 'right') brand.contactLayout = b.contactLayout;
  const socials = normalizeSocials(b.socials, brand.instagram);
  if (Object.keys(socials).length) brand.socials = socials;
  const out: { siteId?: string; siteName?: string; projectName: string; brand: typeof brand; lastPublish?: { url: string; aliases: string[]; readyState: string; at: string; analytics?: boolean }; quality: 'standard' | 'high' | 'max'; imageKb: number | null; identity: Identity; lastExport?: { files: number; bytes: number; imageBytes: number; clipBytes: number; heavyClips?: number; at: string }; kit?: KitApplied; kitSource?: string; analytics?: boolean; showcase: Record<string, PieceShow>; creationsHover: CreationsHover; currency: CurrencySettings; posts: BlogPost[]; menu: MenuNames; menuOrder: MenuKey[]; pieceOrder: string[]; sceneOrder: string[]; categories: Category[]; sceneMap: SceneMap; pages: SitePage[]; viewer: ViewerSettings; legal: Legal } = {
    projectName: str(r.projectName, 60),
    brand,
    // Absent = 'high': a site made today is meant for large screens too.
    quality: r.quality === 'standard' || r.quality === 'max' ? r.quality : 'high',
    // Absent = 100 KB, about what a sharp large picture needs (Tony, 2026-10-09).
    identity: normalizeIdentity(r.identity),
    showcase: normalizeShowcase(r.showcase),
    creationsHover: normalizeHover(r.creationsHover),
    currency: normalizeCurrency(r.currency),
    posts: normalizePosts(r.posts),
    menu: normalizeMenu(r.menu),
    menuOrder: normalizeMenuOrder(r.menuOrder),
    pieceOrder: normalizePieceOrder(r.pieceOrder),
    sceneOrder: normalizePieceOrder(r.sceneOrder),
    categories: normalizeCategories(r.categories),
    sceneMap: normalizeSceneMap(r.sceneMap),
    pages: normalizePages(r.pages),
    viewer: normalizeViewer(r.viewer),
    legal: normalizeLegal(r.legal),
    imageKb: r.imageKb === null ? null : typeof r.imageKb === 'number' && r.imageKb >= 20 && r.imageKb <= 5000 ? Math.round(r.imageKb) : 100,
  };
  const le = r.lastExport as Record<string, unknown> | undefined;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  if (le && typeof le.at === 'string' && n(le.files) !== null && n(le.bytes) !== null && n(le.imageBytes) !== null && n(le.clipBytes) !== null) {
    out.lastExport = { at: le.at, files: n(le.files)!, bytes: n(le.bytes)!, imageBytes: n(le.imageBytes)!, clipBytes: n(le.clipBytes)!, ...(n(le.heavyClips) ? { heavyClips: n(le.heavyClips)! } : {}) };
  }
  if (typeof r.siteId === 'string' && r.siteId) out.siteId = r.siteId;
  // The site kit in place (model/kit.ts), and, on the maker's side, the folder its pages come from.
  const kit = normalizeKitApplied(r.kit);
  if (kit) out.kit = kit;
  if (typeof r.kitSource === 'string' && r.kitSource) out.kitSource = r.kitSource.slice(0, 1000);
  if (typeof r.siteName === 'string' && r.siteName) out.siteName = r.siteName;
  if (r.analytics === true) out.analytics = true;
  const lp = r.lastPublish as Record<string, unknown> | undefined;
  if (lp && typeof lp.url === 'string' && typeof lp.at === 'string') {
    out.lastPublish = { url: lp.url, aliases: Array.isArray(lp.aliases) ? lp.aliases.filter((x): x is string => typeof x === 'string') : [], readyState: str(lp.readyState, 20), at: lp.at, ...(lp.analytics === true ? { analytics: true } : {}) };
  }
  return out;
}
