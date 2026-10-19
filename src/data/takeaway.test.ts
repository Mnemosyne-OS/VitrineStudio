import { BACKUP_FILE, creationsTable, csvCell, exportStudio, mediaName, readManifest, restoreStudio, type TakeawayDoor } from './takeaway';
import type { FolderIO } from './folderStore';

/** A disk in memory: files by path, folders implied. */
function memoryIO(files: Record<string, string>): FolderIO {
  const norm = (p: string) => p.replace(/\\/g, '/');
  return {
    mkdir: async () => ({ success: true }),
    readDir: async (dir) => {
      const d = norm(dir).replace(/\/$/, '');
      const names = new Map<string, boolean>();
      for (const p of Object.keys(files)) {
        if (!p.startsWith(`${d}/`)) continue;
        const rest = p.slice(d.length + 1).split('/');
        names.set(rest[0]!, rest.length > 1);
      }
      if (!names.size) return { success: false, error: 'Directory does not exist' };
      return { success: true, files: [...names].map(([name, isDirectory]) => ({ name, path: `${d}/${name}`, isDirectory })) };
    },
    readFile: async (p) => (norm(p) in files ? { success: true, content: files[norm(p)] } : { success: false, error: 'File does not exist' }),
    writeFile: async (p, content) => { files[norm(p)] = content; return { success: true }; },
    deleteFile: async () => ({ success: true }),
  };
}

/** The key: what the door wrote, and the files of this machine it copied from. */
function memoryKey(machine: Record<string, string>, failOn: string[] = []) {
  const key: Record<string, string> = {};
  const door: TakeawayDoor = {
    write: async (_f, rel, text) => { key[rel] = text; },
    writeBase64: async (_f, rel, b64) => { key[rel] = b64; },
    copyFrom: async (_f, rel, from) => {
      if (failOn.includes(from) || !(from in machine)) throw new Error('SOURCE_MISSING');
      key[rel] = machine[from]!;
    },
    read: async (_f, rel) => { if (!(rel in key)) throw new Error('File does not exist'); return key[rel]!; },
    copyTo: async (_f, rel, to) => { machine[to.replace(/\\/g, '/')] = key[rel]!; },
  };
  return { key, door };
}

const ROOT = 'C:/Users/deb/Atelier';
function studio(): Record<string, string> {
  return {
    [`${ROOT}/products/p1.json`]: JSON.stringify({ id: 'p1', name: 'Vase', photoPath: 'C:/Users/deb/Pictures/vase.jpg' }),
    [`${ROOT}/scenes/s1.json`]: JSON.stringify({ id: 's1', images: { place: 'C:/Users/deb/.mnemosyne/gen/a.png', piece: 'C:/Users/deb/.mnemosyne/gen/b.png' } }),
    [`${ROOT}/studio/site.json`]: JSON.stringify({ brand: { name: 'Atelier', portrait: 'C:/Users/deb/Pictures/moi.jpg' }, lastPublish: { url: 'https://x.vercel.app' }, siteId: 'abc123', siteName: 'deploy', kitSource: 'C:/Users/deb/Pages' }),
    [`${ROOT}/studio/films/film-b.json`]: JSON.stringify({ id: 'film-b', clips: { alive: 'C:/Users/deb/.mnemosyne/gen/c.mp4' } }),
    // Media of this machine.
    'C:/Users/deb/Pictures/vase.jpg': 'VASE', 'C:/Users/deb/.mnemosyne/gen/a.png': 'A', 'C:/Users/deb/.mnemosyne/gen/b.png': 'B',
    'C:/Users/deb/Pictures/moi.jpg': 'MOI', 'C:/Users/deb/.mnemosyne/gen/c.mp4': 'CLIP',
  };
}

describe('the whole studio carried away', () => {
  it('copies every record and every file they point at, with no path of this machine left in the copy', async () => {
    const disk = studio();
    const { key, door } = memoryKey(disk);
    const steps: number[] = [];
    const out = await exportStudio(memoryIO(disk), ROOT, 'f', door, 'Atelier', (p) => steps.push(p.done), new Date('2026-10-11T12:00:00Z'));
    expect(out.failed).toEqual([]);
    // What only means something on this machine stays here: its site folder, the kit's folder.
    const site = JSON.parse(key['studio/site.json']!) as Record<string, unknown>;
    expect(site.siteId).toBeUndefined();
    expect(site.kitSource).toBeUndefined();
    expect(site.lastPublish).toEqual({ url: 'https://x.vercel.app' });
    const records = Object.keys(key).filter((k) => k.endsWith('.json') && k !== BACKUP_FILE).sort();
    expect(records).toEqual(['products/p1.json', 'scenes/s1.json', 'studio/films/film-b.json', 'studio/site.json']);
    const all = records.map((r) => key[r]).join('\n');
    expect(all).not.toMatch(/C:\/Users\/deb/);
    expect(all).toContain('kit-media:');
    expect(Object.keys(key).filter((k) => k.startsWith('media/'))).toHaveLength(5);
    // The copy's own file is written last: a copy without it did not finish.
    expect(Object.keys(key).at(-1)).toBe(BACKUP_FILE);
    expect(steps.at(-1)).toBe(10);
  });

  it('drops a path of this machine that is not a file to carry, and names it', async () => {
    const disk = { ...studio(), [`${ROOT}/studio/settings.json`]: JSON.stringify({ notesDir: 'C:/Users/deb/Notes', keep: 'x' }) };
    const { key, door } = memoryKey(disk);
    const out = await exportStudio(memoryIO(disk), ROOT, 'f', door, 'Atelier', () => {});
    expect(out.failed).toEqual(['studio/settings.json › notesDir']);
    expect(JSON.parse(key['studio/settings.json']!)).toEqual({ keep: 'x' });
  });

  it('names a file it could not copy, and still writes the rest', async () => {
    const disk = studio();
    const { door } = memoryKey(disk, ['C:/Users/deb/.mnemosyne/gen/c.mp4']);
    const out = await exportStudio(memoryIO(disk), ROOT, 'f', door, 'Atelier', () => {});
    expect(out.failed).toEqual(['C:/Users/deb/.mnemosyne/gen/c.mp4']);
  });
});

describe('a copy brought back', () => {
  it('into an empty studio: every record, its files copied in and pointed at', async () => {
    const source = studio();
    const { key, door } = memoryKey(source);
    await exportStudio(memoryIO(source), ROOT, 'f', door, 'Atelier', () => {});
    const target: Record<string, string> = {};
    const NEW = 'D:/Users/ana/Atelier';
    // The other machine: what the key copies in lands on its disk.
    const there: TakeawayDoor = { ...door, copyTo: async (_f, rel, to) => { target[to] = key[rel]!; } };
    const r = await restoreStudio(memoryIO(target), NEW, 'g', there, () => {}, new Date('2026-10-12T09:00:00Z'));
    expect(r).toEqual({ added: 4, kept: [], failed: [] });
    const piece = JSON.parse(target[`${NEW}/products/p1.json`]!) as { photoPath: string };
    expect(piece.photoPath.startsWith(`${NEW}/media/copy-2026-10-12-09-00-00/`)).toBe(true);
    expect(target[piece.photoPath]).toBe('VASE');
    const film = JSON.parse(target[`${NEW}/studio/films/film-b.json`]!) as { clips: { alive: string } };
    expect(target[film.clips.alive]).toBe('CLIP');
    expect(Object.values(target).join('')).not.toContain('kit-media:');
  });

  it('never replaces anything she already has, and says what it kept', async () => {
    const source = studio();
    const { door } = memoryKey(source);
    await exportStudio(memoryIO(source), ROOT, 'f', door, 'Atelier', () => {});
    const NEW = 'D:/Users/ana/Atelier';
    const target: Record<string, string> = { [`${NEW}/studio/site.json`]: '{"brand":{"name":"Mine"}}', [`${NEW}/products/mine.json`]: '{"id":"mine"}' };
    const r = await restoreStudio(memoryIO(target), NEW, 'g', door, () => {});
    expect(r.kept).toEqual(['studio/site.json']);
    expect(target[`${NEW}/studio/site.json`]).toBe('{"brand":{"name":"Mine"}}');
    expect(r.added).toBe(3);
  });

  it('on a new machine (no creation, no scene yet), lets the copy’s settings replace the first-run ones', async () => {
    const source = studio();
    const { key, door } = memoryKey(source);
    await exportStudio(memoryIO(source), ROOT, 'f', door, 'Atelier', () => {});
    const NEW = 'D:/Users/ana/Atelier';
    const target: Record<string, string> = { [`${NEW}/studio/site.json`]: '{"brand":{"name":""}}' };
    const there: TakeawayDoor = { ...door, copyTo: async (_f, rel, to) => { target[to] = key[rel]!; } };
    const r = await restoreStudio(memoryIO(target), NEW, 'g', there, () => {});
    expect(r.kept).toEqual([]);
    expect((JSON.parse(target[`${NEW}/studio/site.json`]!) as { brand: { name: string } }).brand.name).toBe('Atelier');
  });

  it('refuses a folder that is not a copy, and a copy that names a way out', () => {
    expect(() => readManifest('{"schema":"something-else"}')).toThrow('NOT_A_STUDIO_COPY');
    const m = readManifest(JSON.stringify({ schema: 'atelier-studio-backup/1', records: ['products/p.json', '../evil.json', 'C:/x.json', 'other/x.json'], media: ['0001-a.png', '../b.png'] }));
    expect(m.records).toEqual(['products/p.json']);
    expect(m.media).toEqual(['0001-a.png']);
  });
});

describe('the creations as a table', () => {
  it('opens in a spreadsheet: its mark, `;`, a decimal comma in French, quotes where needed, the photos beside it', () => {
    const t = creationsTable(
      [{ id: 'p1', name: 'Vase été', kind: 'unique', price: 42.5, description: 'Grès; émail "lin"\nbrillant', photoPath: 'C:/x/vase.JPG' }],
      { p1: { size: { l: 14.5, h: 22 }, weight: 800, cats: ['c1'], photos: ['C:/x/vase2.png'] } },
      [{ id: 'c1', name: 'Vases' }], 'EUR', 'fr');
    expect(t.csv.startsWith('\uFEFFNom;Type;Prix')).toBe(true);
    const row = t.csv.split('\r\n')[1]!;
    expect(row).toBe('Vase été;unique;42,5;EUR;;;14,5;;22;800;Vases;"Grès; émail ""lin""\nbrillant";photos/Vase-ete.jpg;photos/Vase-ete-2.png');
    expect(t.photos).toEqual([{ rel: 'photos/Vase-ete-2.png', from: 'C:/x/vase2.png' }, { rel: 'photos/Vase-ete.jpg', from: 'C:/x/vase.JPG' }]);
  });
  it('keeps a plain cell plain and leaves an absent value empty', () => {
    expect(csvCell('Vase')).toBe('Vase');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(3.5)).toBe('3.5');
  });
  it('names a media copy plainly and numbers it', () => {
    expect(mediaName('C:\\Users\\deb\\Mes photos\\été 1.JPG', 7)).toBe('0007-t-1.JPG');
  });
});
