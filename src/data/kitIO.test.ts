import { installKit, KIT_FILE, loadKit, makeKit, saveKitFile, type KitDoors } from './kitIO';
import type { DirEntry, FolderIO } from './folderStore';
import { normalizeSiteSettings } from '../model/records';
import { DEFAULT_IDENTITY } from '../site/logo';

/** A disk in memory: text files, binary files as data URLs, folders implied by paths. */
function disk(files: Record<string, string>): { doors: KitDoors; files: Record<string, string>; images: string[] } {
  const images: string[] = [];
  const io: FolderIO = {
    mkdir: async () => ({ success: true }),
    readDir: async (dir) => {
      const seen = new Map<string, DirEntry>();
      for (const p of Object.keys(files)) {
        if (!p.startsWith(dir + '/')) continue;
        const name = p.slice(dir.length + 1).split('/')[0]!;
        seen.set(name, { name, path: `${dir}/${name}`, isDirectory: p.slice(dir.length + 1).includes('/') });
      }
      return seen.size ? { success: true, files: [...seen.values()] } : { success: false, error: 'no such folder' };
    },
    readFile: async (p) => (p in files && !files[p]!.startsWith('data:') ? { success: true, content: files[p] } : { success: false, error: 'File does not exist' }),
    writeFile: async (p, c) => { files[p] = c; return { success: true }; },
    deleteFile: async () => ({ success: true }),
  };
  return {
    files,
    images,
    doors: {
      io,
      readMedia: async (p) => { if (!files[p]?.startsWith('data:')) throw new Error('NOT_READABLE'); return files[p]; },
      saveImage: async (name) => { images.push(name); return `D:/vault/${name}`; },
    },
  };
}

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';

describe('a kit from one studio to another', () => {
  it('is made from the settings and a folder of pages, and put in place on the other side', async () => {
    const tony = disk({
      'T:/pages/01-atelier.html': '<title>L’atelier</title><img src="img/four.webp">',
      'T:/pages/style.css': 'body{}',
      'T:/pages/img/four.webp': 'data:image/webp;base64,UklGRg==',
    });
    const site = normalizeSiteSettings({ brand: { name: 'Atelier Rosalie', accent: '#7a4b2a' }, identity: { ...DEFAULT_IDENTITY, svg, anim: 'parts' } }, 'x');
    const kit = await makeKit(site, 'T:/pages', tony.doors, new Date('2026-10-10T10:00:00Z'));
    expect(kit.pages).toEqual([{ rel: 'pages/01-atelier.html', title: 'L’atelier' }]);
    expect(kit.files.map((f) => f.rel).sort()).toEqual(['pages/01-atelier.html', 'pages/img/four.webp', 'pages/style.css']);
    const path = await saveKitFile('T:/studio-root', kit, tony.doors.io);
    expect(path).toBe('T:/studio-root/atelier-rosalie.kit.json');

    const claire = disk({});
    const hers = normalizeSiteSettings({}, 'claire');
    const out = await installKit(tony.files[path]!, 'D:/atelier', hers, claire.doors);
    expect(out.site.brand.name).toBe('Atelier Rosalie');
    expect(out.site.identity.anim).toBe('parts');
    expect(out.site.kit?.version).toBe('2026-10-10T10:00:00.000Z');
    // Kept with her records, read back whole.
    expect(claire.files[`D:/atelier/studio/${KIT_FILE}`]).toBeDefined();
    expect((await loadKit('D:/atelier', claire.doors.io))?.files).toHaveLength(3);
  });

  it('carries a picture logo as bytes, written on her machine', async () => {
    const tony = disk({ 'T:/logo.png': 'data:image/png;base64,iVBORw0KGgo=' });
    const site = normalizeSiteSettings({ brand: { name: 'Atelier Rosalie' }, identity: { ...DEFAULT_IDENTITY, logoPath: 'T:/logo.png' } }, 'x');
    const kit = await makeKit(site, null, tony.doors);
    expect(kit.logoFile).toEqual({ ext: 'png', base64: 'iVBORw0KGgo=' });
    expect(kit.identity?.logoPath).toBeUndefined();
    const claire = disk({});
    const out = await installKit(JSON.stringify(kit), 'D:/atelier', normalizeSiteSettings({}, 'd'), claire.doors);
    expect(claire.images).toHaveLength(1);
    expect(out.site.identity.logoPath).toMatch(/^D:\/vault\/logo-kit-\d+\.png$/);
  });

  it('refuses, by name, a page file the website would refuse', async () => {
    const tony = disk({ 'T:/pages/a.html': '<title>A</title>', 'T:/pages/logo.svg': '<svg/>' });
    const site = normalizeSiteSettings({}, 'x');
    await expect(makeKit(site, 'T:/pages', tony.doors)).rejects.toThrow(/KIT_FILE_TYPE: pages\/logo.svg/);
  });

  it('says there is no kit when there is none', async () => {
    expect(await loadKit('D:/atelier', disk({}).doors.io)).toBeNull();
  });
});

describe('a kit folder with the studio work', () => {
  const kitJson = (records: unknown) => JSON.stringify({
    schema: 'atelier-studio-kit/1', name: 'Atelier Rosalie', version: '2026-10-10T10:00:00.000Z', brand: { name: 'Atelier Rosalie' }, pages: [], files: [], records,
  });
  const records = {
    pieces: [{ id: 'piece-1', name: 'Vase', photoPath: 'kit-media:p1.jpg' }, { id: 'piece-2', name: 'Hers already' }],
    scenes: [{ id: 'scene-1', pieceId: 'piece-1', images: { place: 'kit-media:s1a.png' } }],
    markets: [{ id: 'market-1', name: 'Marché' }],
    film: { clips: { making: 'kit-media:clip1.mp4' } },
  };

  it('writes her the work she does not have yet, its media pointing into the kit folder', async () => {
    const d = disk({});
    const have = { pieces: new Set(['piece-2']), scenes: new Set<string>(), markets: new Set<string>(), film: false };
    const out = await installKit(kitJson(records), 'D:/atelier', normalizeSiteSettings({}, 'd'), d.doors, 'D:/Kit Atelier', have);
    expect(out.added).toBe(4);
    expect(JSON.parse(d.files['D:/atelier/products/piece-1.json']!).photoPath).toBe('D:/Kit Atelier/media/p1.jpg');
    expect(d.files['D:/atelier/products/piece-2.json']).toBeUndefined();
    expect(JSON.parse(d.files['D:/atelier/scenes/scene-1.json']!).images.place).toBe('D:/Kit Atelier/media/s1a.png');
    expect(JSON.parse(d.files['D:/atelier/studio/film.json']!).clips.making).toBe('D:/Kit Atelier/media/clip1.mp4');
    // The kit kept with her records is its settings and pages only.
    expect(JSON.parse(d.files[`D:/atelier/studio/${KIT_FILE}`]!).records).toBeUndefined();
  });

  it('keeps her own film, and refuses a kit with media given as a lone file', async () => {
    const d = disk({});
    const have = { pieces: new Set<string>(), scenes: new Set<string>(), markets: new Set<string>(), film: true };
    await installKit(kitJson(records), 'D:/atelier', normalizeSiteSettings({}, 'd'), d.doors, 'D:/kit', have);
    expect(d.files['D:/atelier/studio/film.json']).toBeUndefined();
    await expect(installKit(kitJson(records), 'D:/atelier', normalizeSiteSettings({}, 'd'), disk({}).doors)).rejects.toThrow(/KIT_NEEDS_FOLDER/);
  });
});

describe('the portrait in a kit', () => {
  it('travels as bytes, is written on her machine, and a portrait she chose since stays hers', async () => {
    const tony = disk({ 'T:/claire.webp': 'data:image/webp;base64,UklGRg==' });
    const site = normalizeSiteSettings({ brand: { name: 'Atelier Rosalie', portrait: 'T:/claire.webp', portraitCaption: 'Claire' } }, 'x');
    const kit = await makeKit(site, null, tony.doors);
    expect(kit.portraitFile).toEqual({ ext: 'webp', base64: 'UklGRg==' });
    expect(kit.brand.portraitCaption).toBe('Claire');
    const d = disk({});
    const first = await installKit(JSON.stringify(kit), 'D:/a', normalizeSiteSettings({}, 'd'), d.doors);
    expect(first.site.brand.portrait).toMatch(/^D:\/vault\/portrait-kit-\d+\.webp$/);
    expect(first.site.brand.portraitCaption).toBe('Claire');
    const hers = { ...first.site, brand: { ...first.site.brand, portrait: 'D:/mine.jpg' } };
    const next = await installKit(JSON.stringify({ ...kit, version: '2030-01-01T00:00:00.000Z' }), 'D:/a', hers, d.doors);
    expect(next.site.brand.portrait).toBe('D:/mine.jpg');
    expect(next.kept).toContain('portrait');
  });
});

describe('what the verification found in the kit doors (10/10)', () => {
  it('reads a page three folders down, as deep as the host writes', async () => {
    const tony = disk({ 'T:/pages/a/b/c/x.html': '<title>X</title>', 'T:/pages/index.html': '<title>I</title>' });
    const kit = await makeKit(normalizeSiteSettings({}, 'x'), 'T:/pages', tony.doors);
    expect(kit.files.map((f) => f.rel).sort()).toEqual(['pages/a/b/c/x.html', 'pages/index.html']);
  });

  it('never puts in the kit the picture the logo was traced from', async () => {
    const site = normalizeSiteSettings({ identity: { ...DEFAULT_IDENTITY, svg, vectorFrom: 'C:/Users/crypt/mon logo.png' } }, 'x');
    expect((await makeKit(site, null, disk({}).doors)).identity?.vectorFrom).toBeUndefined();
  });

  it('refuses an older or the same kit itself, before writing anything', async () => {
    const d = disk({});
    const first = await installKit(JSON.stringify(await makeKit(normalizeSiteSettings({ brand: { name: 'A' } }, 'x'), null, d.doors, new Date('2026-10-10T00:00:00Z'))), 'D:/a', normalizeSiteSettings({}, 'd'), d.doors);
    const older = JSON.stringify(await makeKit(normalizeSiteSettings({ brand: { name: 'A' } }, 'x'), null, d.doors, new Date('2026-10-01T00:00:00Z')));
    await expect(installKit(older, 'D:/a', first.site, d.doors)).rejects.toThrow(/KIT_NOT_NEWER/);
  });

  it('writes no stray picture when hers is kept', async () => {
    const tony = disk({ 'T:/p.webp': 'data:image/webp;base64,UklGRg==' });
    const kit = await makeKit(normalizeSiteSettings({ brand: { name: 'A', portrait: 'T:/p.webp' } }, 'x'), null, tony.doors, new Date('2026-10-10T00:00:00Z'));
    const d = disk({});
    const first = await installKit(JSON.stringify(kit), 'D:/a', normalizeSiteSettings({}, 'd'), d.doors);
    const hers = { ...first.site, brand: { ...first.site.brand, portrait: 'D:/mine.jpg' } };
    const before = d.images.length;
    const out = await installKit(JSON.stringify({ ...kit, version: '2030-01-01T00:00:00.000Z' }), 'D:/a', hers, d.doors);
    expect(d.images.length).toBe(before);
    expect(out.kept).toContain('portrait');
  });
});
