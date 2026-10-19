import { applyKit, checkKitPath, isNewer, needsFolder, resolveMedia, KIT_SCHEMA, kitFileName, normalizeKitApplied, pageTitles, readKit } from './kit';
import { DEFAULT_IDENTITY } from '../site/logo';
import { normalizeSiteSettings } from './records';
import { utf8Base64 } from '../data/bytes';

const page = '<html><head><title>L’atelier</title></head><body>…</body></html>';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="none" stroke="#fff"/></svg>';
const kitText = (over: Record<string, unknown> = {}) => JSON.stringify({
  schema: KIT_SCHEMA, name: 'Atelier Rosalie', version: '2026-10-10T10:00:00.000Z',
  brand: { name: 'Atelier Rosalie', tagline: 'Céramique', accent: '#7a4b2a', email: 'not checked here' },
  identity: { svg, mode: 'logo', size: 'l', tint: true, anim: 'parts', speed: 'normal', hover: false, logoPath: 'C:/Users/tony/logo.png', ratio: 1 },
  pages: [{ rel: 'pages/01-atelier.html', title: 'L’atelier' }],
  files: [{ rel: 'pages/01-atelier.html', base64: utf8Base64(page) }, { rel: 'pages/img/four.webp', base64: 'UklGRg==' }],
  ...over,
});

describe('reading a kit', () => {
  it('takes the brand, the logo, the pages and their files', () => {
    const kit = readKit(kitText());
    expect(kit.name).toBe('Atelier Rosalie');
    expect(kit.brand).toEqual({ name: 'Atelier Rosalie', tagline: 'Céramique', accent: '#7a4b2a', email: 'not checked here' });
    expect(kit.pages).toEqual([{ rel: 'pages/01-atelier.html', title: 'L’atelier' }]);
    expect(kit.files.map((f) => f.rel)).toEqual(['pages/01-atelier.html', 'pages/img/four.webp']);
    // The maker's disk never travels; the svg is cleaned again.
    expect(kit.identity?.logoPath).toBeUndefined();
    expect(kit.identity?.svg).toContain('<circle');
  });

  it('refuses a file outside pages/, a way up, a hidden one, or a type the site door refuses', () => {
    for (const rel of ['index.html', 'assets/a.html', 'studio/kit.json', 'pages/../index.html', 'pages/.env', '/pages/a.html', 'C:/pages/a.html', 'pages/a/b/c/d/e.html']) {
      expect(() => checkKitPath(rel)).toThrow(/KIT_BAD_PATH/);
    }
    expect(() => checkKitPath('pages/logo.svg')).toThrow(/KIT_FILE_TYPE/);
    expect(() => checkKitPath('pages/run.exe')).toThrow(/KIT_FILE_TYPE/);
    expect(checkKitPath('pages\\img\\a.jpg')).toBe('pages/img/a.jpg');
  });

  it('refuses what is not a kit, and a menu entry that points at no file', () => {
    expect(() => readKit('{')).toThrow(/KIT_NOT_JSON/);
    expect(() => readKit(JSON.stringify({ schema: 'other' }))).toThrow(/KIT_NOT_A_KIT/);
    expect(() => readKit(kitText({ version: 'yesterday' }))).toThrow(/KIT_NOT_A_KIT/);
    expect(() => readKit(kitText({ pages: [{ rel: 'pages/ghost.html', title: 'x' }] }))).toThrow(/KIT_PAGE_MISSING/);
    expect(() => readKit(kitText({ files: [{ rel: 'pages/a.html', base64: 'not base64!' }] }))).toThrow(/KIT_BAD_FILE/);
  });

  it("never carries a picture logo path from the maker's disk", () => {
    expect(readKit(kitText({ identity: { ...DEFAULT_IDENTITY, logoPath: 'C:/Users/tony/logo.png' } })).identity?.logoPath).toBeUndefined();
  });

  it('drops a colour that is not one, keeps the rest', () => {
    expect(readKit(kitText({ brand: { accent: 'red', ink: '#112233' } })).brand).toEqual({ ink: '#112233' });
  });
});

describe('the menu entries of a folder of pages', () => {
  it('titles each top page by its <title>, its file otherwise, in file order', () => {
    expect(pageTitles([
      { rel: 'pages/02-cours.html', text: '<title>\n  Les cours </title>' },
      { rel: 'pages/01-atelier.html', text: '<p>no title</p>' },
      { rel: 'pages/img/x.html', text: '<title>Inside</title>' },
      { rel: 'pages/style.css', text: '' },
    ])).toEqual([
      { rel: 'pages/01-atelier.html', title: 'atelier' },
      { rel: 'pages/02-cours.html', title: 'Les cours' },
    ]);
  });
});

describe('putting a kit in place', () => {
  const base = normalizeSiteSettings({}, 'mon-dossier');
  const kit = readKit(kitText());

  it('first kit: what it brings wins, what it leaves empty stays hers', () => {
    const mine = { ...base, brand: { ...base.brand, about: 'Mon texte', instagram: '@moi' } };
    const out = applyKit(mine, kit, undefined);
    expect(out.site.brand.name).toBe('Atelier Rosalie');
    expect(out.site.brand.accent).toBe('#7a4b2a');
    expect(out.site.brand.about).toBe('Mon texte');
    expect(out.site.identity.anim).toBe('parts');
    expect(out.kept).toEqual([]);
  });

  it('a newer kit replaces what she left as it was, and keeps and names what she changed', () => {
    const first = applyKit(base, kit, undefined);
    const hers = { ...first.site, brand: { ...first.site.brand, tagline: 'Grès et porcelaine' } };
    const next = readKit(kitText({ version: '2026-11-01T00:00:00.000Z', brand: { name: 'Atelier Rosalie', tagline: 'Céramique et plantes', accent: '#335544' } }));
    const out = applyKit(hers, next, first.applied);
    expect(out.site.brand.accent).toBe('#335544');
    expect(out.site.brand.tagline).toBe('Grès et porcelaine');
    expect(out.kept).toEqual(['tagline']);
  });

  it('a field the last kit left alone and she filled is hers', () => {
    const first = applyKit(base, readKit(kitText({ brand: { name: 'Atelier Rosalie' } })), undefined);
    const hers = { ...first.site, brand: { ...first.site.brand, instagram: '@atelier' } };
    const out = applyKit(hers, readKit(kitText({ brand: { instagram: '@kit' } })), first.applied);
    expect(out.site.brand.instagram).toBe('@atelier');
    expect(out.kept).toEqual(['instagram']);
  });

  it('a logo measured on her machine (its ratio) is still the kit\'s logo', () => {
    const first = applyKit(base, kit, undefined);
    const measured = { ...first.site, identity: { ...first.site.identity, ratio: 1.37 } };
    const next = readKit(kitText({ version: '2026-11-01T00:00:00.000Z', identity: { ...DEFAULT_IDENTITY, svg, anim: 'draw' } }));
    const out = applyKit(measured, next, first.applied);
    expect(out.site.identity.anim).toBe('draw');
    expect(out.kept).toEqual([]);
  });

  it('a logo she changed stays hers', () => {
    const first = applyKit(base, kit, undefined);
    const hers = { ...first.site, identity: { ...first.site.identity, anim: 'spin' as const } };
    const out = applyKit(hers, readKit(kitText({ version: '2026-11-01T00:00:00.000Z' })), first.applied);
    expect(out.site.identity.anim).toBe('spin');
    expect(out.kept).toEqual(['identity']);
  });

  it('a picture logo is hers on her disk: the path written there, never the maker\'s', () => {
    const raster = readKit(kitText({ identity: { ...DEFAULT_IDENTITY, mode: 'logo' }, logoFile: { ext: 'png', base64: 'iVBORw0KGgo=' } }));
    expect(raster.logoFile?.ext).toBe('png');
    const out = applyKit(base, raster, undefined, 'D:/claire/vault/logo-kit.png');
    expect(out.site.identity.logoPath).toBe('D:/claire/vault/logo-kit.png');
    expect(out.applied.identity?.logoPath).toBe('D:/claire/vault/logo-kit.png');
  });

  it('what the kit put there is read back from site.json, and a newer kit is told apart', () => {
    const first = applyKit(base, kit, undefined);
    const back = normalizeSiteSettings(JSON.parse(JSON.stringify({ ...first.site, kit: first.applied })), 'x');
    expect(back.kit?.version).toBe(kit.version);
    expect(back.kit?.brand.accent).toBe('#7a4b2a');
    expect(normalizeKitApplied({ name: 'x' })).toBeUndefined();
    expect(isNewer(kit, back.kit)).toBe(false);
    expect(isNewer({ ...kit, version: '2027-01-01T00:00:00.000Z' }, back.kit)).toBe(true);
    expect(isNewer(kit, undefined)).toBe(true);
  });

  it('names the file after the kit', () => {
    expect(kitFileName('Atelier Rosalie')).toBe('atelier-rosalie.kit.json');
    expect(kitFileName('Céramique & Co')).toBe('ceramique-co.kit.json');
  });
});

describe('the studio work a kit carries', () => {
  const records = {
    pieces: [{ id: 'piece-1', name: 'Vase', photoPath: 'kit-media:p1.jpg' }],
    scenes: [{ id: 'scene-1', pieceId: 'piece-1', images: { place: 'kit-media:s1a.png', piece: 'kit-media:s1b.png' } }],
    markets: [],
    film: { clips: { making: 'kit-media:clip1.mp4' } },
  };

  it('reads it, and turns each media name into a file of the kit folder', () => {
    const kit = readKit(kitText({ records }));
    expect(needsFolder(kit)).toBe(true);
    const r = resolveMedia(kit.records!, 'D:/kit', (...p: string[]) => p.join('/'));
    expect(r.scenes[0]!.images).toEqual({ place: 'D:/kit/media/s1a.png', piece: 'D:/kit/media/s1b.png' });
    expect((r.film as { clips: { making: string } }).clips.making).toBe('D:/kit/media/clip1.mp4');
    expect(needsFolder(readKit(kitText()))).toBe(false);
  });

  it('refuses a media name that leaves media/, and a record without a plain id', () => {
    expect(() => readKit(kitText({ records: { ...records, pieces: [{ id: 'p', photoPath: 'kit-media:../secret.png' }] } }))).toThrow(/KIT_BAD_PATH/);
    expect(() => readKit(kitText({ records: { ...records, scenes: [{ id: '../x' }] } }))).toThrow(/KIT_BAD_RECORD/);
  });
});

describe('what the verification found (10/10)', () => {
  const base = normalizeSiteSettings({}, 'd');
  const later = (over: Record<string, unknown> = {}) => readKit(kitText({ version: '2026-11-01T00:00:00.000Z', ...over }));

  it('never carries the picture the maker traced the logo from', () => {
    expect(readKit(kitText({ identity: { ...DEFAULT_IDENTITY, svg, vectorFrom: 'C:/Users/crypt/mon logo.png' } })).identity?.vectorFrom).toBeUndefined();
  });

  it('a logo she set after a kit that brought none is hers, and named', () => {
    const first = applyKit(base, readKit(kitText({ identity: undefined })), undefined);
    expect(first.applied.identity).toBeUndefined();
    const hers = { ...first.site, identity: { ...DEFAULT_IDENTITY, svg, anim: 'spin' as const } };
    const out = applyKit(hers, later(), first.applied);
    expect(out.site.identity.anim).toBe('spin');
    expect(out.kept).toContain('identity');
  });

  it('drops a kit record whose version is no date, so the next kit is a first one again', () => {
    expect(normalizeKitApplied({ name: 'x', version: 'garbled' })).toBeUndefined();
  });

  it('refuses a record that names a path on the maker\'s disk', () => {
    for (const path of ['C:/Users/crypt/a.jpg', 'D:\\photos\\a.jpg', '\\\\nas\\a.jpg', '/Users/tony/a.jpg']) {
      expect(() => readKit(kitText({ records: { pieces: [{ id: 'p', photoPath: path }], scenes: [], markets: [] } }))).toThrow(/KIT_BAD_RECORD/);
    }
    expect(() => readKit(kitText({ records: { pieces: [{ id: 'p', name: '1/2 vase' }], scenes: [], markets: [] } }))).not.toThrow();
  });

  it('refuses a file name the host would refuse at her export (over 200 characters)', () => {
    // Every segment is a valid one (under 100): only the whole name is too long.
    const seg = (c: string) => c.repeat(50);
    expect(checkKitPath(`pages/${seg('a')}/${seg('b')}/x.html`)).toBeTruthy();
    expect(() => checkKitPath(`pages/${seg('a')}/${seg('b')}/${seg('c')}/${seg('d')}.html`)).toThrow(/KIT_BAD_PATH/);
  });
});
