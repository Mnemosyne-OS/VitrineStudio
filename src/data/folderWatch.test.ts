import { beforeEach, describe, expect, it } from 'vitest';
import type { FolderIO } from './folderStore';
import { changedPaths, forgetOwnWrites, keepOwn, noteOwnWrite, NO_WATCH, OWN_WRITE_MS, pathKey, snapshotDirs, watchStep, wroteRecently, type Snapshot, type WatchState } from './folderWatch';

type Entry = { name: string; mtime?: number; sizeBytes?: number; statFailed?: boolean; isDirectory?: boolean };

/** A folder whose listings the test sets by hand. */
function fakeIO(dirs: Record<string, Entry[] | 'missing' | 'refused'>): Pick<FolderIO, 'readDir'> {
  return {
    readDir: async (path) => {
      const dir = path.replace(/\\/g, '/').split('/').pop()!;
      const d = dirs[dir];
      if (d === undefined || d === 'missing') return { success: false, error: 'Directory does not exist' };
      if (d === 'refused') return { success: false, error: 'Access denied' };
      return { success: true, files: d.map((e) => ({ isDirectory: false, ...e, path: `C:/s/${dir}/${e.name}` })) };
    },
  };
}

const snap = (entries: Record<string, string>): Snapshot => new Map(Object.entries(entries));
const never = () => false;

/** Runs looks in order and returns the counts each one reported. */
function looks(snaps: (Snapshot | null)[], isOwn: (p: string) => boolean = never): number[] {
  let state: WatchState = NO_WATCH;
  return snaps.map((s) => {
    const step = watchStep(state, s, isOwn);
    state = step.state;
    return step.changed;
  });
}

beforeEach(() => forgetOwnWrites());

describe('snapshotDirs', () => {
  it('keeps the JSON records it could stat, keyed the way Windows compares paths', async () => {
    const io = fakeIO({
      products: [{ name: 'vase.json', mtime: 1, sizeBytes: 10 }, { name: 'photo.png', mtime: 1, sizeBytes: 9 }, { name: 'sub', isDirectory: true, mtime: 1, sizeBytes: 0 }],
      scenes: [{ name: 'S1.JSON', mtime: 2, sizeBytes: 20 }],
    });
    const s = await snapshotDirs(io, 'C:/s');
    expect([...s!.entries()]).toEqual([['c:/s/products/vase.json', '1|10'], ['c:/s/scenes/s1.json', '2|20']]);
  });

  it('leaves out a file the host could not stat: its zeros are not a date', async () => {
    const s = await snapshotDirs(fakeIO({ scenes: [{ name: 'a.json', mtime: 0, sizeBytes: 0, statFailed: true }, { name: 'b.json' }] }), 'C:/s');
    expect(s!.size).toBe(0);
  });

  it('reads a folder nobody made yet as empty, and any other refusal as unknown', async () => {
    expect((await snapshotDirs(fakeIO({ products: 'missing', scenes: [] }), 'C:/s'))!.size).toBe(0);
    expect(await snapshotDirs(fakeIO({ products: [], scenes: 'refused' }), 'C:/s')).toBeNull();
  });
});

describe('changedPaths', () => {
  it('names what was added, removed and changed', () => {
    expect(changedPaths(snap({ a: '1|1', b: '1|1', c: '1|1' }), snap({ a: '1|1', b: '2|1', d: '1|1' })).sort()).toEqual(['b', 'c', 'd']);
  });
});

describe('watchStep', () => {
  const base = snap({ a: '1|1' });
  const moved = snap({ a: '1|1', b: '5|5' });

  it('takes the first look as what the studio holds', () => {
    expect(looks([moved])).toEqual([0]);
  });

  it('reads a change again once it holds still for a second look, and only once', () => {
    expect(looks([base, moved, moved, moved])).toEqual([0, 0, 1, 0]);
  });

  it('waits while a file is still being written (it changes between two looks)', () => {
    const writing = snap({ a: '1|1', b: '5|2' });
    expect(looks([base, writing, moved, moved])).toEqual([0, 0, 0, 1]);
  });

  it('never reads back what the studio wrote itself', () => {
    expect(looks([base, moved, moved], (p) => p === 'b')).toEqual([0, 0, 0]);
  });

  it('counts only the files someone else changed when both wrote', () => {
    const both = snap({ a: '2|2', b: '5|5' });
    expect(looks([base, both, both], (p) => p === 'a')).toEqual([0, 0, 1]);
  });

  it('decides nothing on a look that failed', () => {
    expect(looks([base, moved, null, moved])).toEqual([0, 0, 0, 1]);
  });

  it('drops a change that went back before it settled', () => {
    expect(looks([base, moved, base, base])).toEqual([0, 0, 0, 0]);
  });
});

describe('own writes', () => {
  it('are remembered for a few seconds, whatever the separator or case', () => {
    noteOwnWrite('C:\\S\\Scenes\\x.json', 1_000);
    expect(wroteRecently(pathKey('c:/s/scenes/x.json'), 1_000 + OWN_WRITE_MS)).toBe(true);
    expect(wroteRecently('c:/s/scenes/x.json', 1_001 + OWN_WRITE_MS)).toBe(false);
    expect(wroteRecently('c:/s/scenes/y.json', 1_000)).toBe(false);
  });
});

describe('keepOwn', () => {
  const held = [{ id: 'a', v: 'mine' }, { id: 'b', v: 'mine' }, { id: 'n', v: 'mine' }];
  const fresh = [{ id: 'a', v: 'disk' }, { id: 'b', v: 'disk' }, { id: 'c', v: 'disk' }];

  it('takes the disk, except a record the studio just wrote, which keeps the copy in hand', () => {
    noteOwnWrite('C:/s/scenes/a.json', 1_000);
    noteOwnWrite('C:/s/scenes/n.json', 1_000);
    expect(keepOwn('C:/s', 'scenes', fresh, held, 2_000)).toEqual([{ id: 'a', v: 'mine' }, { id: 'b', v: 'disk' }, { id: 'c', v: 'disk' }, { id: 'n', v: 'mine' }]);
  });

  it('takes the disk once the write is old', () => {
    noteOwnWrite('C:/s/scenes/a.json', 1_000);
    expect(keepOwn('C:/s', 'scenes', fresh, held, 2_000 + OWN_WRITE_MS)).toEqual(fresh);
  });
});
