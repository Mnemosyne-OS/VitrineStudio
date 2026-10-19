/**
 * Everything Vitrine Studio asks of the host, in one place.
 *
 * Rule 9: every bridge call carries its own deadline. File calls answer in
 * milliseconds (15 s). A picture takes 5 to 40 s on the credit route (the
 * host gives up at 200 s). The calls that open a dialog keep the SDK's long
 * default: a person reading a dialog must not be timed out.
 */
import type { TakeawayDoor } from './takeaway';
import { MnemoCartridgeSDK } from '../sdk/mnemo-sdk';
import type { DirEntry, FolderIO } from './folderStore';
import type { ClipJob } from './makeClip';
import { POST_EXTENSIONS } from '../model/blog';
import { noteOwnWrite } from './folderWatch';

/** Must match "name" in mnemo-plugin.json. */
export const PLUGIN_ID = '@mnemosyne-plugins/artisan-studio';

export const sdk = new MnemoCartridgeSDK(PLUGIN_ID);

const IO_TIMEOUT_MS = 15_000;
const IMAGE_TIMEOUT_MS = 210_000;

/** The file calls the folder store needs, through the host's own dialog door. */
export const hostIO: FolderIO = {
  mkdir: (dirPath) => sdk.invoke('dialog.mkdir', { dirPath }, IO_TIMEOUT_MS),
  readDir: (dirPath) => sdk.invoke<{ success: boolean; files?: DirEntry[]; error?: string }>('dialog.readDir', { dirPath }, IO_TIMEOUT_MS),
  readFile: (filePath) => sdk.invoke('dialog.readFile', { filePath }, IO_TIMEOUT_MS),
  // Each write is noted before and after the host answers, so the folder watch never reads it as someone else's.
  writeFile: (filePath, content) => ownWrite(filePath, () => sdk.invoke('dialog.writeFile', { filePath, content }, IO_TIMEOUT_MS)),
  deleteFile: (filePath) => ownWrite(filePath, () => sdk.invoke('dialog.deleteFile', { filePath }, IO_TIMEOUT_MS)),
};

function ownWrite<T>(path: string, run: () => Promise<T>): Promise<T> {
  noteOwnWrite(path);
  return run().finally(() => noteOwnWrite(path));
}

/** The system folder picker. Resolves null when the person cancels. */
export function pickFolder(): Promise<string | null> {
  return sdk.selectFolder();
}

/** The system file picker, a written note (Markdown or text). Resolves the path, or null when cancelled. */
export async function pickPostFile(): Promise<string | null> {
  const path = await sdk.selectFile([{ name: 'Markdown', extensions: [...POST_EXTENSIONS] }]);
  return typeof path === 'string' && path ? path : null;
}

/** The system file picker, pictures only. Resolves the path, or null when cancelled. */
export async function pickImage(filterName: string): Promise<string | null> {
  const path = await sdk.selectFile([{ name: filterName, extensions: ['jpg', 'jpeg', 'png', 'webp'] }]);
  return typeof path === 'string' && path ? path : null;
}

// ── Where the studio lives ────────────────────────────────────────────────
// localStorage is fast; the host mirror (doc 73) survives the iframe's
// origin changing (dev port vs packaged).

const FOLDER_KEY = 'artisan_studio_folder';

/** The studio folder this origin remembers, or null (first run, or storage refused). */
export function readRememberedFolder(): string | null {
  try {
    return localStorage.getItem(FOLDER_KEY);
  } catch (err) {
    console.warn('[vitrine-studio] localStorage unreadable:', err);
    return null;
  }
}

/** The studio folder the host remembers for this cartridge (survives a change of origin). */
export async function readMirroredFolder(): Promise<string | null> {
  const res = await sdk.invoke<{ state: { folder?: unknown } | null }>('state.get', undefined, IO_TIMEOUT_MS);
  const folder = res?.state?.folder;
  return typeof folder === 'string' && folder.trim() ? folder : null;
}

/** Remembers the studio folder here and in the host. */
export async function rememberFolder(folder: string): Promise<void> {
  try {
    localStorage.setItem(FOLDER_KEY, folder);
  } catch (err) {
    console.warn('[vitrine-studio] localStorage write refused:', err);
  }
  await sdk.invoke('state.set', { state: { folder } }, IO_TIMEOUT_MS);
}

// ── Pictures ──────────────────────────────────────────────────────────────

const imageCache = new Map<string, Promise<string>>();
/** The pictures on screen at once, with room to spare: past it the oldest is let go. */
const IMAGE_CACHE_MAX = 60;

/** A data URL of a picture on disk, or the host's reason. A failure is not cached. */
export function readImage(path: string): Promise<string> {
  const hit = imageCache.get(path);
  if (hit) {
    // Most recently used goes last, so the oldest is the one let go.
    imageCache.delete(path);
    imageCache.set(path, hit);
    return hit;
  }
  if (imageCache.size >= IMAGE_CACHE_MAX) imageCache.delete(imageCache.keys().next().value!);
  const pending = sdk
    .invoke<{ success: boolean; content?: string; isBinary?: boolean; error?: string }>('dialog.readFile', { filePath: path }, IO_TIMEOUT_MS)
    .then((res) => {
      if (res?.success && res.isBinary && typeof res.content === 'string' && res.content.startsWith('data:image/')) return res.content;
      throw new Error(res?.error ?? 'NOT_AN_IMAGE');
    });
  imageCache.set(path, pending);
  pending.catch(() => imageCache.delete(path));
  return pending;
}

export interface GenerateRequest {
  prompt: string;
  aspectRatio?: string;
  modelId?: string;
  editImagePath?: string;
  refImagePaths?: string[];
}

/** One picture on the person's credits (`image.generate`, doc 145). Resolves its path on disk. */
export async function generateImage(req: GenerateRequest): Promise<{ path: string; model: string; billedUsdMicro: number | null }> {
  const res = await sdk.invoke<{ path?: string; model?: string; billedUsdMicro?: number | null }>('image.generate', req, IMAGE_TIMEOUT_MS);
  if (!res?.path) throw new Error('NO_PICTURE_RETURNED');
  // A host from before the debit rode the answer says nothing: null, never 0.
  return { path: res.path, model: res.model ?? '', billedUsdMicro: typeof res.billedUsdMicro === 'number' ? res.billedUsdMicro : null };
}

/** The credit route's models (doc 92): the cheapest by default, the higher-quality one on request. */
export const MODEL_FOR_QUALITY: Record<'quality' | 'fast', string> = {
  quality: 'gemini-3-pro-image',
  fast: 'gemini-3.1-flash-lite-image',
};

// ── The website (doc 145 lot 3) ───────────────────────────────────────────
// The site folder is picked in the host's own dialog and named by an id; the
// hosting token is sealed by the host and never comes back here.

export interface SiteFolder { id: string; name: string; addedAt: string; missing: boolean }
export interface TokenState { present: boolean; savedAt: number | null; seal: string }
export interface Deployment { id: string; url: string; aliases: string[]; readyState: string; files: number }

/** Asks the person to pick the website's folder (system dialog). No deadline: they are choosing. */
export const declareSiteFolder = () => sdk.invoke<SiteFolder>('site.declareFolder', undefined, 0);
/** The website folders this cartridge declared, without their paths. */
export const siteFolders = () => sdk.invoke<SiteFolder[]>('site.folders', undefined, IO_TIMEOUT_MS);
/** Writes one file of the site (relative name, base64 bytes) into its declared folder. */
export const saveSiteAsset = (siteId: string, name: string, base64: string) =>
  sdk.invoke('site.saveAsset', { siteId, name, base64 }, 60_000);
/** Whether a hosting token is saved, when, how it is sealed. Never the token. */
export const siteTokenState = () => sdk.invoke<TokenState>('site.tokenState', undefined, IO_TIMEOUT_MS);
/** Seals the person's hosting token in the host; it never comes back. */
export const setSiteToken = (token: string) => sdk.invoke<TokenState>('site.setToken', { token }, IO_TIMEOUT_MS);
/** Deletes the sealed hosting token. */
export const removeSiteToken = () => sdk.invoke<TokenState>('site.removeToken', undefined, IO_TIMEOUT_MS);
/** A whole site upload can take minutes on a slow line. */
export const deploySite = (siteId: string, projectName: string) =>
  sdk.invoke<Deployment>('site.deploy', { siteId, projectName }, 11 * 60_000);

// ── The hosting: her own addresses and her visits (doc 145 §10.14) ───────

export interface DnsRecord { type: 'A' | 'CNAME' | 'TXT'; host: string; value: string }
/** A domain she attached: Vercel accepts it (`verified`), it points there (`configured`, null = not read), what to write at her registrar. */
export interface DomainState { name: string; verified: boolean; configured: boolean | null; records: DnsRecord[]; error?: string }
export interface HostingState { project: string; analytics: boolean | null; analyticsUrl: string; domains: DomainState[] }
export interface TrafficRow { name: string; visitors: number; pageviews: number }
/** A part Vercel did not answer is null, never an empty list. */
export interface Traffic { days: number; since: string; until: string; daily: Array<{ day: string; visitors: number; pageviews: number }> | null; referrers: TrafficRow[] | null; countries: TrafficRow[] | null; errors: string[] }

/** Each domain checked again and its configuration read: one or two calls per domain. */
export const readHosting = (projectName: string) => sdk.invoke<HostingState>('site.hosting', { projectName }, 65_000);
export const addSiteDomain = (projectName: string, domain: string) => sdk.invoke<{ name: string; verified: boolean }>('site.addDomain', { projectName, domain }, 35_000);
export const removeSiteDomain = (projectName: string, domain: string) => sdk.invoke<{ removed: string }>('site.removeDomain', { projectName, domain }, 35_000);
export const readTraffic = (projectName: string, days: number) => sdk.invoke<Traffic>('site.traffic', { projectName, days }, 35_000);

// ── Carry the studio away and back (doc 145 §10.13) ──────────────────────

/** A folder she picks in the system's dialog (a USB key): an id and a name, never a path. An export gets its own subfolder. */
export const pickTakeaway = (purpose: 'export' | 'import', subfolder?: string) =>
  sdk.invoke<{ id: string; name: string; purpose: 'export' | 'import' }>('takeaway.pickFolder', { purpose, ...(subfolder ? { subfolder } : {}) }, 0);
/** The takeaway door as data/takeaway.ts uses it: every call rejects with the host's reason. */
export const takeawayDoor: TakeawayDoor = {
  write: async (folderId, rel, text) => { await sdk.invoke('takeaway.write', { folderId, rel, text }, 60_000); },
  writeBase64: async (folderId, rel, base64) => { await sdk.invoke('takeaway.write', { folderId, rel, base64 }, 60_000); },
  copyFrom: async (folderId, rel, from) => { await sdk.invoke('takeaway.copyFrom', { folderId, rel, from }, 120_000); },
  read: async (folderId, rel) => (await sdk.invoke<{ text: string }>('takeaway.read', { folderId, rel }, 60_000)).text,
  copyTo: async (folderId, rel, to) => { await sdk.invoke('takeaway.copyTo', { folderId, rel, to }, 120_000); },
};

// ── Clips (doc 145 lot 4) ─────────────────────────────────────────────────

/** Starts a Veo clip on the person's credits. Answers a job at once. */
export const generateVideo = (params: Record<string, unknown>) => sdk.invoke<ClipJob>('video.generate', params, 90_000);
export const videoStatus = (jobId: string) => sdk.invoke<ClipJob>('video.status', { jobId }, IO_TIMEOUT_MS);

/** Local enlargement (doc 88): is the image engine there, are the weights, how big is their download. */
export interface UpscaleState { engine: boolean; weights: boolean; downloadBytes: number }
export const upscaleStatus = () => sdk.invoke<UpscaleState>('image.upscaleStatus', undefined, IO_TIMEOUT_MS);
/** One more window of this studio, outside the app (the site preview). */
export const openStudioWindow = (instance: string) => sdk.invoke<{ opened?: boolean }>('plugins.detach', { instance }, IO_TIMEOUT_MS);
/** Opens Mnemosyne's Settings on Images, where the upscaler is installed. Needs a click in the frame. */
export const openImageSettings = () => sdk.invoke<{ page: string }>('settings.open', { page: 'theia' }, IO_TIMEOUT_MS);
/** One picture, enlarged by `scale` beside its source. `path` = the file to use from now on. */
export const upscaleImage = (path: string, scale: number) =>
  sdk.invoke<{ path: string; alreadyWide?: boolean; reused?: boolean; device?: string; seconds?: number | null }>('image.upscale', { path, scale }, 17 * 60_000);

/** ffmpeg (doc 89): supported on this system, installed from Settings > Video, its download's size. */
export interface VideoToolsState { supported: boolean; installed: boolean; downloadBytes: number | null }
export const videoToolsStatus = () => sdk.invoke<VideoToolsState>('video.toolsStatus', undefined, IO_TIMEOUT_MS);
/** Opens Mnemosyne's Settings on Video, where ffmpeg is installed. Needs a click in the frame. */
export const openVideoSettings = () => sdk.invoke<{ page: string }>('settings.open', { page: 'video' }, IO_TIMEOUT_MS);
/** The film's parts joined into one file: `outBase` + .mp4 (.webm without an H.264 encoder). */
export const joinFilm = (parts: Array<{ path: string; in?: number; out?: number }>, outBase: string, web = false) =>
  sdk.invoke<{ path: string; encoder: string; seconds: number; web?: boolean }>('video.joinFilm', { parts, outBase, ...(web ? { web: true } : {}) }, 12 * 60_000);
/** Where a clip's lighter copy for the web is written: beside it, never over it. */
export const webClipBase = (clipPath: string) => `${clipPath.replace(/\.[^.\\/]+$/, '')}-web`;

/** Any file on disk as a data URL (a clip): readImage is for pictures only. */
export async function readMedia(path: string): Promise<string> {
  const res = await sdk.invoke<{ success: boolean; content?: string; isBinary?: boolean; error?: string }>('dialog.readFile', { filePath: path }, 60_000);
  if (res?.success && res.isBinary && typeof res.content === 'string' && res.content.startsWith('data:')) return res.content;
  throw new Error(res?.error ?? 'NOT_READABLE');
}
