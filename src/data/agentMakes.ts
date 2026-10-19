/**
 * An agent asks the studio to make a scene's pictures (Tony, 2026-10-12:
 * "my aim is that you handle everything, the user knows it costs").
 *
 * The pictures can only be made here: the steps, the matte, the cost journal
 * all live in the studio. So the host's door (`studio.makeScene`) drops a
 * REQUEST FILE in `studio/requests/<sceneId>.json` and the open studio takes it.
 *
 * 🚨 The request is its own file, never a flag in the scene: the scene has
 * one writer (the studio), the request has one writer (the host) and one
 * deleter (the studio). A flag in the scene would race the studio's own saves
 * and be dropped in silence.
 * 🚨 One scene at a time, never two in parallel, whichever door started the
 * other one (the person's button, the agent's `makeScene`): each picture is paid.
 * 🚨 `agentMake.state = 'making'` is written BEFORE the first picture, so a
 * studio closed mid-way finds it at its next start and makes what is missing
 * (only the missing pictures, so the rest is not paid twice).
 * A request whose scene is gone, or already has every picture, is removed
 * without making anything.
 */
import { joinPath, STUDIO_DIR, type FolderIO } from './folderStore';
import type { Scene } from '../model/types';
import { nextBeat } from '../model/records';

export const REQUESTS_DIR = 'requests';
/** How often the studio looks for a request while it is open. */
export const REQUESTS_EVERY_MS = 3_000;

export interface MakeRequest {
  sceneId: string;
  requestedAt: string;
  /** Where the file is, to remove it once taken. */
  path: string;
}

const isInstant = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** A request file's content, or null when it is not one. */
export function parseRequest(raw: unknown, path: string): MakeRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.sceneId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(r.sceneId) || !isInstant(r.requestedAt)) return null;
  return { sceneId: r.sceneId, requestedAt: r.requestedAt, path };
}

/** The requests waiting, oldest first; null when the folder could not be listed (decide nothing). */
export async function readRequests(io: Pick<FolderIO, 'readDir' | 'readFile'>, root: string): Promise<MakeRequest[] | null> {
  const listed = await io.readDir(joinPath(root, STUDIO_DIR, REQUESTS_DIR));
  if (!listed.success) return listed.error === 'Directory does not exist' ? [] : null;
  const out: MakeRequest[] = [];
  for (const f of listed.files ?? []) {
    if (f.isDirectory || !f.name.toLowerCase().endsWith('.json')) continue;
    try {
      const read = await io.readFile(f.path);
      const req = read.success && typeof read.content === 'string' ? parseRequest(JSON.parse(read.content), f.path) : null;
      if (req) out.push(req);
      else console.warn('[vitrine-studio] a make request could not be read and is left aside:', f.name);
    } catch (err) {
      console.warn('[vitrine-studio] a make request could not be read and is left aside:', f.name, err);
    }
  }
  return out.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
}

export type NextMake =
  | { kind: 'make'; scene: Scene; requestedAt: string; request?: MakeRequest }
  | { kind: 'drop'; request: MakeRequest }
  /** Every picture is there but the scene still says 'making' (closed right after the last one): it is done. */
  | { kind: 'settle'; scene: Scene }
  | null;

/**
 * What to do next. Nothing while pictures are being made for ANY scene, by
 * this door or another (one at a time). A make interrupted earlier comes
 * first, then the oldest request. A scene being worked on otherwise (its clip,
 * its layers) is not started under that work: it waits for the next look.
 */
export function nextMake(
  requests: readonly MakeRequest[],
  scenes: readonly Scene[],
  running: boolean,
  busy: (sceneId: string) => boolean = () => false,
): NextMake {
  if (running) return null;
  const finished = scenes.find((s) => s.agentMake?.state === 'making' && !nextBeat(s));
  if (finished) return { kind: 'settle', scene: finished };
  const interrupted = scenes.find((s) => s.agentMake?.state === 'making' && nextBeat(s));
  if (interrupted) {
    const request = requests.find((r) => r.sceneId === interrupted.id);
    if (busy(interrupted.id)) return null;
    return { kind: 'make', scene: interrupted, requestedAt: interrupted.agentMake!.requestedAt, ...(request ? { request } : {}) };
  }
  for (const request of requests) {
    const scene = scenes.find((s) => s.id === request.sceneId);
    if (!scene || !nextBeat(scene)) return { kind: 'drop', request };
    if (busy(scene.id)) return null;
    return { kind: 'make', scene, requestedAt: request.requestedAt, request };
  }
  return null;
}
