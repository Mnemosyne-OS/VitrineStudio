import { describe, expect, it } from 'vitest';
import type { FolderIO } from './folderStore';
import { nextMake, parseRequest, readRequests, type MakeRequest } from './agentMakes';
import { normalizeScene } from '../model/records';
import type { Scene } from '../model/types';

const scene = (id: string, images: Scene['images'] = {}, agentMake?: Scene['agentMake']): Scene => ({
  schema: 1, id, pieceId: 'p', universe: 'Salon', variant: '', placeDescription: 'x', animation: '', aspectRatio: '16:9',
  images, validated: false, createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z', ...(agentMake ? { agentMake } : {}),
});
const req = (sceneId: string, requestedAt = '2026-10-12T10:00:00.000Z'): MakeRequest => ({ sceneId, requestedAt, path: `C:/s/studio/requests/${sceneId}.json` });
const ALL = { place: 'a.png', piece: 'b.png', alive: 'c.png' };

describe('nextMake', () => {
  it('makes the oldest request\'s scene', () => {
    expect(nextMake([req('a'), req('b')], [scene('a'), scene('b')], false)).toMatchObject({ kind: 'make', scene: { id: 'a' }, request: { sceneId: 'a' } });
  });

  it('makes nothing while a make is running: one scene at a time', () => {
    expect(nextMake([req('a')], [scene('a')], true)).toBeNull();
  });

  it('starts nothing on a scene whose clip or layers are running, and takes it at a later look', () => {
    const busy = (id: string) => id === 'a';
    expect(nextMake([req('a'), req('b')], [scene('a'), scene('b')], false, busy)).toBeNull();
    expect(nextMake([req('a')], [scene('a')], false, () => false)).toMatchObject({ kind: 'make', scene: { id: 'a' } });
    const half = scene('h', { place: 'a.png' }, { state: 'making', requestedAt: '2026-10-12T09:00:00.000Z' });
    expect(nextMake([], [half], false, (id) => id === 'h')).toBeNull();
  });

  it('removes a request whose scene is gone or already has every picture, without making anything', () => {
    expect(nextMake([req('gone')], [scene('a')], false)).toMatchObject({ kind: 'drop', request: { sceneId: 'gone' } });
    expect(nextMake([req('a')], [scene('a', ALL)], false)).toMatchObject({ kind: 'drop' });
  });

  it('resumes a make the studio was closed in the middle of, before any new request', () => {
    const half = scene('h', { place: 'a.png' }, { state: 'making', requestedAt: '2026-10-12T09:00:00.000Z' });
    expect(nextMake([req('a')], [scene('a'), half], false)).toEqual({ kind: 'make', scene: half, requestedAt: '2026-10-12T09:00:00.000Z' });
  });

  it('settles a scene that got every picture but was closed before saying so', () => {
    const full = scene('f', ALL, { state: 'making', requestedAt: '2026-10-12T09:00:00.000Z' });
    expect(nextMake([], [full], false)).toEqual({ kind: 'settle', scene: full });
  });

  it('leaves a scene that ended alone', () => {
    expect(nextMake([], [scene('d', ALL, { state: 'done', requestedAt: '2026-10-12T09:00:00.000Z' }), scene('x', {}, { state: 'failed', requestedAt: '2026-10-12T09:00:00.000Z' })], false)).toBeNull();
  });
});

describe('request files', () => {
  it('reads a request, and refuses a bad id or date', () => {
    expect(parseRequest({ sceneId: 'scene-a', requestedAt: '2026-10-12T10:00:00.000Z' }, 'p')).toEqual({ sceneId: 'scene-a', requestedAt: '2026-10-12T10:00:00.000Z', path: 'p' });
    expect(parseRequest({ sceneId: '../x', requestedAt: '2026-10-12T10:00:00.000Z' }, 'p')).toBeNull();
    expect(parseRequest({ sceneId: 'a', requestedAt: 'soon' }, 'p')).toBeNull();
  });

  it('lists them oldest first, an absent folder is none, a refused listing is unknown', async () => {
    const files: Record<string, string> = {
      'C:/s/studio/requests/b.json': JSON.stringify({ sceneId: 'b', requestedAt: '2026-10-12T11:00:00.000Z' }),
      'C:/s/studio/requests/a.json': JSON.stringify({ sceneId: 'a', requestedAt: '2026-10-12T10:00:00.000Z' }),
      'C:/s/studio/requests/bad.json': '{ no',
    };
    const io: Pick<FolderIO, 'readDir' | 'readFile'> = {
      readDir: async () => ({ success: true, files: Object.keys(files).map((p) => ({ name: p.split('/').pop()!, path: p, isDirectory: false })) }),
      readFile: async (p) => ({ success: true, content: files[p] }),
    };
    expect((await readRequests(io, 'C:/s'))!.map((r) => r.sceneId)).toEqual(['a', 'b']);
    expect(await readRequests({ ...io, readDir: async () => ({ success: false, error: 'Directory does not exist' }) }, 'C:/s')).toEqual([]);
    expect(await readRequests({ ...io, readDir: async () => ({ success: false, error: 'Access denied' }) }, 'C:/s')).toBeNull();
  });
});

describe('agentMake on the scene', () => {
  it('survives a reload, and an unknown state is dropped', () => {
    const at = { state: 'failed', requestedAt: '2026-10-12T10:00:00.000Z', at: '2026-10-12T10:01:00.000Z', error: 'error.credits' } as const;
    expect(normalizeScene({ ...scene('a'), agentMake: at })?.agentMake).toEqual(at);
    expect(normalizeScene({ ...scene('a'), agentMake: { state: 'paused', requestedAt: '2026-10-12T10:00:00.000Z' } })).not.toHaveProperty('agentMake');
  });
});
