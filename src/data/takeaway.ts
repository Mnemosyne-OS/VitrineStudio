/**
 * Carrying the studio away and bringing it back (doc 145 §10.13, Tony: « si
 * quelqu'un veut prendre et partir avec, il doit pouvoir facilement, et même
 * réimporter »), through the host's takeaway door: a folder she picks (a USB
 * key), written by relative names only.
 *
 * The whole studio is its folder's records, copied as they are, plus every
 * picture and clip they point at. A record names its files by absolute path
 * on THIS machine; in the copy each one becomes `kit-media:<name>` (the kit's
 * own convention, model/kit.ts) and the file goes into `media/`. Brought back,
 * the media are copied into her studio and the names point at them again.
 *
 * 🚨 Bringing back never replaces anything of hers: a record whose file
 * already exists is kept as it is, and said (`kept`). The one exception is a
 * studio with no creation and no scene yet (a new machine): its settings are
 * only first-run defaults, and the copy's settings replace them. A failed file is named
 * by path (`failed`), never skipped in silence.
 */
import { joinPath, PIECES_DIR, SCENES_DIR, STUDIO_DIR, type FolderIO } from './folderStore';
import { KIT_MEDIA } from '../model/kit';

/** The copy's own file: what it holds, and from when. */
export const BACKUP_FILE = 'atelier-studio.json';
export const BACKUP_SCHEMA = 'atelier-studio-backup/1';
/** What a copy carries from the studio folder (MnemoCRM's markets stay MnemoCRM's). */
const RECORD_DIRS = [PIECES_DIR, SCENES_DIR, STUDIO_DIR];
/** The host's list (main/site/takeaway.ts): a path with another extension is not a file to carry. */
const MEDIA_EXT = /\.(webp|png|jpe?g|gif|avif|mp4|webm|svg|md|txt|json|csv|html|css|js|woff2)$/i;
const ABSOLUTE = /^([A-Za-z]:[\\/]|\/)/;

export interface BackupManifest {
  schema: typeof BACKUP_SCHEMA;
  name: string;
  createdAt: string;
  /** Every record, by its path relative to the studio folder ('products/p1.json'). */
  records: string[];
  /** Every media file, by its name under media/. */
  media: string[];
}

/** The host's takeaway door, as the cartridge sees it (data/host.ts). */
export interface TakeawayDoor {
  write: (folderId: string, rel: string, text: string) => Promise<void>;
  writeBase64: (folderId: string, rel: string, base64: string) => Promise<void>;
  copyFrom: (folderId: string, rel: string, from: string) => Promise<void>;
  read: (folderId: string, rel: string) => Promise<string>;
  copyTo: (folderId: string, rel: string, to: string) => Promise<void>;
}

export interface Progress { done: number; total: number }
export interface TakeawayOutcome { written: number; failed: string[] }
export interface RestoreOutcome { added: number; kept: string[]; failed: string[] }

/** A file name for a media copy: its own name, made plain, numbered so two never collide. */
export function mediaName(path: string, n: number): string {
  const base = (path.split(/[\\/]/).pop() ?? 'file').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '').slice(-100) || 'file';
  return `${String(n).padStart(4, '0')}-${base}`;
}

/** Every string of a value that is a file of this machine worth carrying. */
export function mediaPaths(v: unknown, out = new Set<string>()): Set<string> {
  if (typeof v === 'string') { if (ABSOLUTE.test(v) && MEDIA_EXT.test(v)) out.add(v); }
  else if (Array.isArray(v)) v.forEach((x) => mediaPaths(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => mediaPaths(x, out));
  return out;
}

/** The value with each mapped string replaced (a path → `kit-media:x`, or back). */
export function remap<T>(v: T, map: Map<string, string>): T {
  if (typeof v === 'string') return (map.get(v) ?? v) as T;
  if (Array.isArray(v)) return v.map((x: unknown) => remap(x, map)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remap(x, map)])) as T;
  return v;
}

/** What belongs to THIS machine in the site's settings: a folder id of its host, a folder path. */
const MACHINE_KEYS: Record<string, string[]> = { [`${STUDIO_DIR}/site.json`]: ['siteId', 'siteName', 'kitSource'] };

/**
 * The value without anything that only means something on this machine: the
 * named keys, and any path still absolute once the media were renamed (a
 * folder, a file of a kind not carried). Each one dropped is named.
 */
export function withoutMachine(v: unknown, rel: string, dropped: string[], at = ''): unknown {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.filter((x, i) => {
    if (typeof x === 'string' && ABSOLUTE.test(x)) { dropped.push(`${rel} › ${at}[${i}]`); return false; }
    return true;
  }).map((x, i) => withoutMachine(x, rel, dropped, `${at}[${i}]`));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const here = at ? `${at}.${k}` : k;
      if (!at && MACHINE_KEYS[rel]?.includes(k)) continue;
      if (typeof x === 'string' && ABSOLUTE.test(x)) { dropped.push(`${rel} › ${here}`); continue; }
      out[k] = withoutMachine(x, rel, dropped, here);
    }
    return out;
  }
  return v;
}

/** Every record file of the studio folder, relative ('studio/films/film-x.json'). */
async function listRecords(io: FolderIO, root: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (rel: string, depth: number) => {
    const listed = await io.readDir(joinPath(root, ...rel.split('/')));
    if (!listed.success) {
      if (listed.error === 'Directory does not exist') return;
      throw new Error(`LIST_FAILED: ${rel} (${listed.error})`);
    }
    for (const f of listed.files ?? []) {
      if (f.name.startsWith('.')) continue;
      if (f.isDirectory && depth < 2) await walk(`${rel}/${f.name}`, depth + 1);
      else if (!f.isDirectory && f.name.toLowerCase().endsWith('.json')) out.push(`${rel}/${f.name}`);
    }
  };
  for (const dir of RECORD_DIRS) await walk(dir, 0);
  return out.sort();
}

/**
 * The whole studio into the folder picked: every record with its paths made
 * `kit-media:` names, every file they point at under media/, and the copy's
 * own file LAST (a copy without it is a copy that did not finish).
 */
export async function exportStudio(io: FolderIO, root: string, folderId: string, door: TakeawayDoor, name: string, onProgress: (p: Progress) => void, now = new Date()): Promise<TakeawayOutcome> {
  const rels = await listRecords(io, root);
  const records: Array<{ rel: string; value: unknown }> = [];
  for (const rel of rels) {
    const read = await io.readFile(joinPath(root, ...rel.split('/')));
    if (!read.success || typeof read.content !== 'string') throw new Error(`READ_FAILED: ${rel}`);
    records.push({ rel, value: JSON.parse(read.content) });
  }
  const paths = [...mediaPaths(records.map((r) => r.value))].sort();
  const toToken = new Map(paths.map((p, i) => [p, `${KIT_MEDIA}${mediaName(p, i + 1)}`]));
  const total = paths.length + records.length + 1;
  let done = 0;
  const failed: string[] = [];
  const media: string[] = [];
  for (const p of paths) {
    const file = toToken.get(p)!.slice(KIT_MEDIA.length);
    try {
      await door.copyFrom(folderId, `media/${file}`, p);
      media.push(file);
    } catch (err) {
      console.warn('[vitrine-studio] a file was not copied:', p, err);
      failed.push(p);
    }
    onProgress({ done: ++done, total });
  }
  for (const r of records) {
    // A path left after the renaming would point at this machine on the other one: dropped and named.
    const dropped: string[] = [];
    const value = withoutMachine(remap(r.value, toToken), r.rel, dropped);
    failed.push(...dropped);
    await door.write(folderId, r.rel, `${JSON.stringify(value, null, 2)}\n`);
    onProgress({ done: ++done, total });
  }
  const manifest: BackupManifest = { schema: BACKUP_SCHEMA, name, createdAt: now.toISOString(), records: rels, media };
  await door.write(folderId, BACKUP_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  onProgress({ done: ++done, total });
  return { written: done - failed.length, failed };
}

/** True when the studio folder has at least one record in `dir`. */
async function hasRecords(io: FolderIO, root: string, dir: string): Promise<boolean> {
  const listed = await io.readDir(joinPath(root, dir));
  return !!listed.success && (listed.files ?? []).some((f) => !f.isDirectory && f.name.toLowerCase().endsWith('.json'));
}

/** A copy's own file read and checked: a folder that is not a copy says so. */
export function readManifest(text: string): BackupManifest {
  const raw = JSON.parse(text) as Partial<BackupManifest>;
  if (raw?.schema !== BACKUP_SCHEMA) throw new Error('NOT_A_STUDIO_COPY');
  const safe = (s: unknown) => typeof s === 'string' && !s.includes('..') && !ABSOLUTE.test(s) && !s.startsWith('.');
  const records = (Array.isArray(raw.records) ? raw.records : []).filter((r): r is string => safe(r) && /\.json$/i.test(r) && RECORD_DIRS.includes((r).split('/')[0]!));
  const media = (Array.isArray(raw.media) ? raw.media : []).filter((m): m is string => safe(m) && /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/.test(m));
  return { schema: BACKUP_SCHEMA, name: typeof raw.name === 'string' ? raw.name : '', createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '', records, media };
}

/**
 * A copy brought back into her studio: its media copied under
 * `media/<stamp>/`, then every record she does not already have, its names
 * pointing at those files. What she has stays hers.
 */
export async function restoreStudio(io: FolderIO, root: string, folderId: string, door: TakeawayDoor, onProgress: (p: Progress) => void, now = new Date()): Promise<RestoreOutcome> {
  const manifest = readManifest(await door.read(folderId, BACKUP_FILE));
  const stamp = `copy-${now.toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
  const total = manifest.media.length + manifest.records.length;
  let done = 0;
  const failed: string[] = [];
  const back = new Map<string, string>();
  for (const file of manifest.media) {
    const to = joinPath(root, 'media', stamp, file);
    try {
      await door.copyTo(folderId, `media/${file}`, to);
      back.set(`${KIT_MEDIA}${file}`, to);
    } catch (err) {
      console.warn('[vitrine-studio] a file of the copy was not brought back:', file, err);
      failed.push(`media/${file}`);
    }
    onProgress({ done: ++done, total });
  }
  let added = 0;
  const kept: string[] = [];
  // A studio with no creation and no scene holds nothing of hers yet: its settings are the
  // defaults of a first run (a new machine), and the copy's own settings take their place.
  const fresh = !(await hasRecords(io, root, PIECES_DIR)) && !(await hasRecords(io, root, SCENES_DIR));
  for (const rel of manifest.records) {
    const path = joinPath(root, ...rel.split('/'));
    const there = await io.readFile(path);
    if (there.success && !(fresh && rel.startsWith(`${STUDIO_DIR}/`))) {
      kept.push(rel);
    } else {
      try {
        const value = remap(JSON.parse(await door.read(folderId, rel)) as unknown, back);
        const dir = path.slice(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')));
        const made = await io.mkdir(dir);
        if (!made.success) throw new Error(made.error);
        const written = await io.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
        if (!written.success) throw new Error(written.error);
        added++;
      } catch (err) {
        console.warn('[vitrine-studio] a record of the copy was not brought back:', rel, err);
        failed.push(rel);
      }
    }
    onProgress({ done: ++done, total });
  }
  return { added, kept, failed };
}

/** A cell of the creations table: `;` separated, quoted when it holds one, a quote or a line break. */
export function csvCell(v: string | number | undefined | null, decimalComma = false): string {
  if (v === undefined || v === null || v === '') return '';
  const s = typeof v === 'number' ? (decimalComma ? String(v).replace('.', ',') : String(v)) : v;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The headers of the creations table, in the site's language. */
const TABLE_HEADERS: Record<'en' | 'fr' | 'es', string[]> = {
  en: ['Name', 'Kind', 'Price', 'Currency', 'Status', 'Stock', 'Length (cm)', 'Width (cm)', 'Height (cm)', 'Weight (g)', 'Categories', 'Description', 'Photo', 'More photos'],
  fr: ['Nom', 'Type', 'Prix', 'Devise', 'Statut', 'Stock', 'Longueur (cm)', 'Largeur (cm)', 'Hauteur (cm)', 'Poids (g)', 'Catégories', 'Description', 'Photo', 'Autres photos'],
  es: ['Nombre', 'Tipo', 'Precio', 'Moneda', 'Estado', 'Stock', 'Largo (cm)', 'Ancho (cm)', 'Alto (cm)', 'Peso (g)', 'Categorías', 'Descripción', 'Foto', 'Otras fotos'],
};

export interface TablePiece {
  id: string; name: string; kind: string; price?: number; status?: string; stock?: number; description?: string; photoPath?: string;
}
export interface TableShow { size?: { l?: number; w?: number; h?: number }; weight?: number; photos?: string[]; cats?: string[] }

/**
 * The creations as a table a spreadsheet opens (`;`, UTF-8 with its mark, a
 * decimal comma in French and Spanish), and the photos it names, to copy
 * beside it under photos/. The table names each photo by that copy's name.
 */
export function creationsTable(pieces: readonly TablePiece[], show: Record<string, TableShow>, categories: ReadonlyArray<{ id: string; name: string }>, currency: string, lang: 'en' | 'fr' | 'es'): { csv: string; photos: Array<{ rel: string; from: string }> } {
  const comma = lang !== 'en';
  const photos: Array<{ rel: string; from: string }> = [];
  const used = new Set<string>();
  const photoOf = (piece: TablePiece, path: string | undefined, n: number): string => {
    if (!path) return '';
    const ext = (path.split('.').pop() ?? 'jpg').toLowerCase();
    let base = `${piece.name || piece.id}${n ? `-${n + 1}` : ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || piece.id;
    while (used.has(base)) base = `${base}-b`;
    used.add(base);
    const rel = `photos/${base}.${ext}`;
    photos.push({ rel, from: path });
    return rel;
  };
  const rows = pieces.map((p) => {
    const s = show[p.id] ?? {};
    const cats = (s.cats ?? []).map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean).join(', ');
    const more = (s.photos ?? []).map((path, i) => photoOf(p, path, i + 1)).filter(Boolean).join(', ');
    return [p.name, p.kind, p.price, p.price === undefined ? '' : currency, p.status, p.stock, s.size?.l, s.size?.w, s.size?.h, s.weight, cats, p.description, photoOf(p, p.photoPath, 0), more]
      .map((v) => csvCell(v, comma)).join(';');
  });
  return { csv: `\uFEFF${[TABLE_HEADERS[lang].join(';'), ...rows].join('\r\n')}\r\n`, photos };
}
