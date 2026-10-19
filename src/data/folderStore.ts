/**
 * The studio on disk: one JSON file per record, in a folder the person chose.
 * The folder is the source of truth; nothing lives only in the iframe.
 *
 *   <root>/products/<id>.json        pieces, SAME files as MnemoCRM's products
 *   <root>/scenes/<id>.json          staged scenes (this cartridge)
 *   <root>/studio/settings.json      trade profile, quality, picture shape
 *
 * The record helpers follow MnemoCRM's folderStore on purpose (doc 124 §4):
 * a listing failure is an ERROR, never an empty result, and a file that
 * cannot be read is reported by name, never silently dropped.
 */
export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

/** The four host calls this store needs. Injected so tests run without a host. */
export interface FolderIO {
  mkdir(dirPath: string): Promise<{ success: boolean; error?: string }>;
  readDir(dirPath: string): Promise<{ success: boolean; files?: DirEntry[]; error?: string }>;
  readFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }>;
  /** Permanent: the host unlinks the file. Used only after the person chose "delete for good". */
  deleteFile(filePath: string): Promise<{ success: boolean; error?: string }>;
}

export const PIECES_DIR = 'products';
export const SCENES_DIR = 'scenes';
export const STUDIO_DIR = 'studio';
export const SETTINGS_FILE = 'settings.json';
/** Archived records: `<root>/archive/<dir>/<id>.json`, out of the studio but never lost. */
export const ARCHIVE_DIR = 'archive';

/** Join with the separator the root already uses, so a Windows path stays one. */
/** The file name at the end of a path, either separator. */
export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function joinPath(root: string, ...parts: string[]): string {
  const sep = root.includes('\\') && !root.includes('/') ? '\\' : '/';
  return [root.replace(/[\\/]+$/, ''), ...parts].join(sep);
}

/** Only a plain id may become a file name: no separators, no dots, no traversal. */
export function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,80}$/.test(id);
}

export class StoreError extends Error {
  constructor(public readonly code: 'MKDIR_FAILED' | 'LIST_FAILED' | 'WRITE_FAILED' | 'BAD_ID', detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'StoreError';
  }
}

export interface LoadResult<T> {
  records: T[];
  /** Files that exist but could not be read as a record. Shown to the person. */
  unreadable: string[];
}

export async function loadRecords<T extends { id: string }>(
  io: FolderIO,
  root: string,
  dir: string,
  normalize: (raw: unknown) => T | null,
  /** false for a folder that belongs to another app (MnemoCRM's markets): read it if it is there, never create it. */
  create = true,
): Promise<LoadResult<T>> {
  const path = joinPath(root, dir);
  if (create) {
    const made = await io.mkdir(path);
    if (!made.success) throw new StoreError('MKDIR_FAILED', made.error);
  }
  const listed = await io.readDir(path);
  // Absent is not unreadable: another app's folder that was never made is simply empty.
  if (!listed.success && !create && listed.error === 'Directory does not exist') return { records: [], unreadable: [] };
  if (!listed.success) throw new StoreError('LIST_FAILED', listed.error);
  const files = (listed.files ?? []).filter((f) => !f.isDirectory && f.name.toLowerCase().endsWith('.json'));
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const read = await io.readFile(file.path);
        if (!read.success || typeof read.content !== 'string') return { file, record: null };
        return { file, record: normalize(JSON.parse(read.content)) };
      } catch (err) {
        console.warn(`[vitrine-studio] could not read ${dir}/${file.name}:`, err);
        return { file, record: null };
      }
    }),
  );
  const records: T[] = [];
  const unreadable: string[] = [];
  const seen = new Set<string>();
  for (const { file, record } of results) {
    // Two files claiming one id: the second is reported, never merged.
    if (!record || seen.has(record.id)) {
      unreadable.push(`${dir}/${file.name}`);
      continue;
    }
    seen.add(record.id);
    records.push(record);
  }
  unreadable.sort();
  return { records, unreadable };
}

export async function saveRecord(io: FolderIO, root: string, dir: string, record: { id: string }): Promise<void> {
  if (!isSafeId(record.id)) throw new StoreError('BAD_ID', record.id);
  const path = joinPath(root, dir);
  const made = await io.mkdir(path);
  if (!made.success) throw new StoreError('MKDIR_FAILED', made.error);
  const written = await io.writeFile(joinPath(path, `${record.id}.json`), `${JSON.stringify(record, null, 2)}\n`);
  if (!written.success) throw new StoreError('WRITE_FAILED', written.error);
}

/**
 * The settings file. 🎭 Absent is a first run (null); unreadable is NOT absent:
 * it throws, so a broken file is never quietly overwritten with defaults.
 */
export async function loadSettingsRaw(io: FolderIO, root: string): Promise<unknown> {
  const read = await io.readFile(joinPath(root, STUDIO_DIR, SETTINGS_FILE));
  if (!read.success) {
    if (read.error === 'File does not exist') return null;
    throw new StoreError('LIST_FAILED', read.error);
  }
  return JSON.parse(read.content ?? 'null');
}

export async function saveSettings(io: FolderIO, root: string, settings: unknown): Promise<void> {
  const dir = joinPath(root, STUDIO_DIR);
  const made = await io.mkdir(dir);
  if (!made.success) throw new StoreError('MKDIR_FAILED', made.error);
  const written = await io.writeFile(joinPath(dir, SETTINGS_FILE), `${JSON.stringify(settings, null, 2)}\n`);
  if (!written.success) throw new StoreError('WRITE_FAILED', written.error);
}

export const MARKETS_DIR = 'markets';
export const SITE_FILE = 'site.json';
/** The first film (doc 145 §10.7). */
export const FILM_FILE = 'film.json';
/** Every film made after the first, one file each. */
export const FILMS_DIR = 'studio/films';

/** A JSON file under studio/. Absent = null; unreadable throws (never overwritten with defaults). */
export async function loadStudioJson(io: FolderIO, root: string, name: string): Promise<unknown> {
  const read = await io.readFile(joinPath(root, STUDIO_DIR, name));
  if (!read.success) {
    if (read.error === 'File does not exist') return null;
    throw new StoreError('LIST_FAILED', read.error);
  }
  return JSON.parse(read.content ?? 'null');
}

export async function saveStudioJson(io: FolderIO, root: string, name: string, value: unknown): Promise<void> {
  const dir = joinPath(root, STUDIO_DIR);
  const made = await io.mkdir(dir);
  if (!made.success) throw new StoreError('MKDIR_FAILED', made.error);
  const written = await io.writeFile(joinPath(dir, name), `${JSON.stringify(value, null, 2)}
`);
  if (!written.success) throw new StoreError('WRITE_FAILED', written.error);
}
