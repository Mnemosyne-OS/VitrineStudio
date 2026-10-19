/**
 * The studio notices a record that someone else wrote into its folder (Tony,
 * 2026-10-12: an agent in Claude Code or another IDE creates a scene, and the
 * open studio shows it). The host has no file watch for a cartridge, but
 * `dialog.readDir` already gives each file's mtime and size, so the studio
 * reads its record folders' listings every few seconds while it is on screen.
 *
 * Three rules keep that from lying or flapping:
 * - 🚨 its OWN writes are not a change: every write and delete through
 *   `hostIO` is noted, and a change made only of paths the studio wrote in the
 *   last few seconds is taken as the new baseline, never reloaded;
 * - 🚨 a change is read only once it holds still for two looks in a row: an
 *   agent writing a JSON file mid-look would otherwise read as unreadable;
 * - 🎭 a listing that fails, or a file the host could not stat, decides
 *   nothing: an unknown is never taken as "the file changed".
 *
 * Only the folders of records an agent creates are watched (pieces, scenes,
 * markets). Settings, site and films are edited by the studio's own screens.
 */
import { joinPath, MARKETS_DIR, PIECES_DIR, SCENES_DIR, type DirEntry, type FolderIO } from './folderStore';

export const WATCHED_DIRS = [PIECES_DIR, SCENES_DIR, MARKETS_DIR] as const;
/** How often the folder is looked at while the studio is on screen. */
export const WATCH_EVERY_MS = 3_000;
/** A path the studio wrote this recently is its own change. */
export const OWN_WRITE_MS = 10_000;

/** What `dialog.readDir` gives besides the name: absent on an old host. */
type Listed = DirEntry & { mtime?: number; sizeBytes?: number; statFailed?: boolean };

/** One path, compared the way Windows compares it. */
export const pathKey = (path: string): string => path.replace(/\\/g, '/').toLowerCase();

// ── The studio's own writes ───────────────────────────────────────────────

const ownWrites = new Map<string, number>();

/** Notes a write or delete the studio makes itself (called before AND after the host answers). */
export function noteOwnWrite(path: string, now = Date.now()): void {
  ownWrites.set(pathKey(path), now);
  if (ownWrites.size > 500) for (const [k, at] of ownWrites) if (now - at > OWN_WRITE_MS) ownWrites.delete(k);
}

/** Whether the studio itself wrote `path` in the last few seconds. */
export function wroteRecently(path: string, now = Date.now()): boolean {
  const at = ownWrites.get(pathKey(path));
  return at !== undefined && now - at <= OWN_WRITE_MS;
}

/** Test seam: forgets every noted write. */
export function forgetOwnWrites(): void {
  ownWrites.clear();
}

// ── What the folder looks like ────────────────────────────────────────────

/** Path → "mtime|size" for every record file the host could stat. */
export type Snapshot = Map<string, string>;

/** The record folders as they are now; null when one could not be listed (decide nothing). */
export async function snapshotDirs(io: Pick<FolderIO, 'readDir'>, root: string, dirs: readonly string[] = WATCHED_DIRS): Promise<Snapshot | null> {
  const snap: Snapshot = new Map();
  for (const dir of dirs) {
    const listed = await io.readDir(joinPath(root, dir));
    if (!listed.success) {
      // A folder nobody made yet is empty; any other refusal is an unknown.
      if (listed.error === 'Directory does not exist') continue;
      return null;
    }
    for (const f of (listed.files ?? []) as Listed[]) {
      if (f.isDirectory || !f.name.toLowerCase().endsWith('.json')) continue;
      // No stat, no verdict: zeros the host could not read are not a date.
      if (f.statFailed || typeof f.mtime !== 'number' || typeof f.sizeBytes !== 'number') continue;
      snap.set(pathKey(f.path), `${f.mtime}|${f.sizeBytes}`);
    }
  }
  return snap;
}

/** Every path added, removed or changed between two looks. */
export function changedPaths(before: Snapshot, after: Snapshot): string[] {
  const out: string[] = [];
  for (const [p, sig] of after) if (before.get(p) !== sig) out.push(p);
  for (const p of before.keys()) if (!after.has(p)) out.push(p);
  return out;
}

const sameSnapshot = (a: Snapshot, b: Snapshot) => a.size === b.size && changedPaths(a, b).length === 0;

export interface WatchState {
  /** What the studio holds was read from this. */
  base: Snapshot | null;
  /** A change seen once, waiting for a second identical look. */
  pending: Snapshot | null;
}

export const NO_WATCH: WatchState = { base: null, pending: null };

/**
 * One look. Returns the next state and, when the studio must re-read its
 * folder, how many record files someone else changed.
 */
export function watchStep(state: WatchState, snap: Snapshot | null, isOwn: (path: string) => boolean): { state: WatchState; changed: number } {
  if (!snap) return { state, changed: 0 };
  if (!state.base) return { state: { base: snap, pending: null }, changed: 0 };
  const changes = changedPaths(state.base, snap);
  if (!changes.length) return { state: { base: state.base, pending: null }, changed: 0 };
  const theirs = changes.filter((p) => !isOwn(p));
  if (!theirs.length) return { state: { base: snap, pending: null }, changed: 0 };
  if (state.pending && sameSnapshot(state.pending, snap)) return { state: { base: snap, pending: null }, changed: theirs.length };
  return { state: { base: state.base, pending: snap }, changed: 0 };
}

/**
 * The records read again, except the ones the studio wrote in the last
 * seconds: those keep the copy in hand (its save may still be on its way, and
 * the disk would put the version before it back), even when the disk does not
 * have them yet.
 */
export function keepOwn<T extends { id: string }>(root: string, dir: string, fresh: T[], held: T[], now = Date.now()): T[] {
  const mine = (id: string) => wroteRecently(joinPath(root, dir, `${id}.json`), now);
  const out = fresh.map((r) => (mine(r.id) ? held.find((x) => x.id === r.id) ?? r : r));
  for (const h of held) if (mine(h.id) && !out.some((r) => r.id === h.id)) out.push(h);
  return out;
}
