/**
 * The site kit on disk (model/kit.ts): made on the maker's side from the
 * studio's settings and a folder of pages, put in place on the artisan's
 * side, and its pages written into the website at every export.
 *
 * Doors are injected so the whole round trip is tested without a host.
 */
import { applyKit, checkKitPath, isNewer, mergeShowcase, needsFolder, resolveMedia, isTextFile, KIT_PAGES_DIR, KIT_SCHEMA, KitError, kitFileName, pageTitles, readKit, type Kit, type KitApplied, type KitFile, type SiteLike } from '../model/kit';
import { dataUrlPayload, utf8Base64 } from './bytes';
import type { PieceShow } from '../model/showcase';
import { FILM_FILE, joinPath, loadStudioJson, MARKETS_DIR, PIECES_DIR, saveRecord, SCENES_DIR, saveStudioJson, type FolderIO } from './folderStore';

export const KIT_FILE = 'kit.json';
/** How deep a pages folder is read: pages/ + three folders + the file, the five segments the host writes. */
const MAX_DEPTH = 4;

/** A picture's extension as a kit carries it, or why it cannot. */
function imageExt(path: string): 'png' | 'jpg' | 'webp' {
  const ext = path.toLowerCase().match(/\.(png|jpe?g|webp)$/)?.[1];
  if (!ext) throw new KitError('KIT_LOGO_TYPE', path);
  return ext === 'jpeg' ? 'jpg' : (ext as 'png' | 'jpg' | 'webp');
}

export interface KitDoors {
  io: FolderIO;
  /** A binary file on disk, as a data URL. */
  readMedia: (path: string) => Promise<string>;
  /** Writes a picture into the cartridge's own store; resolves its absolute path. */
  saveImage: (name: string, base64: string) => Promise<string>;
}

/** Every file of a pages folder, as kit files under pages/. A file the site would refuse refuses the kit, by name. */
export async function readPagesFolder(dir: string, doors: KitDoors): Promise<Array<KitFile & { text?: string }>> {
  const out: Array<KitFile & { text?: string }> = [];
  const walk = async (path: string, rel: string, depth: number) => {
    const list = await doors.io.readDir(path);
    if (!list.success) throw new KitError('KIT_FOLDER_UNREADABLE', `${path}: ${list.error ?? ''}`);
    for (const e of list.files ?? []) {
      if (e.name.startsWith('.')) continue;
      const childRel = `${rel}/${e.name}`;
      if (e.isDirectory) {
        if (depth >= MAX_DEPTH) throw new KitError('KIT_BAD_PATH', childRel);
        await walk(e.path, childRel, depth + 1);
        continue;
      }
      checkKitPath(childRel);
      if (isTextFile(childRel)) {
        const read = await doors.io.readFile(e.path);
        if (!read.success || typeof read.content !== 'string') throw new KitError('KIT_FILE_UNREADABLE', `${childRel}: ${read.error ?? ''}`);
        out.push({ rel: childRel, base64: utf8Base64(read.content), text: read.content });
      } else {
        try {
          out.push({ rel: childRel, base64: dataUrlPayload(await doors.readMedia(e.path)) });
        } catch (err) {
          throw new KitError('KIT_FILE_UNREADABLE', `${childRel}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  };
  await walk(dir, KIT_PAGES_DIR, 1);
  return out;
}

/**
 * The kit of this studio: its brand, its logo (a picture logo's bytes with
 * it), and the pages of `pagesFolder` when one is given.
 */
export async function makeKit(site: SiteLike, pagesFolder: string | null, doors: KitDoors, now = new Date()): Promise<Kit> {
  const files = pagesFolder ? await readPagesFolder(pagesFolder, doors) : [];
  const { brand, identity } = site;
  const portrait = brand.portrait;
  const kit: Kit = {
    schema: KIT_SCHEMA,
    name: brand.name.trim() || 'Site',
    version: now.toISOString(),
    brand: { name: brand.name, tagline: brand.tagline, about: brand.about, email: brand.email, instagram: brand.instagram, accent: brand.accent, ink: brand.ink, paper: brand.paper, introLine: brand.introLine, portraitCaption: brand.portraitCaption, contactNote: brand.contactNote, formspree: brand.formspree },
    pages: pageTitles(files),
    files: files.map(({ rel, base64 }) => ({ rel, base64 })),
  };
  if (portrait) {
    kit.portraitFile = { ext: imageExt(portrait), base64: dataUrlPayload(await doors.readMedia(portrait)) };
  }
  if (identity.svg || identity.logoPath) {
    // Never a path of this machine: the picture the logo was traced from stays here.
    const { logoPath, ratio: _measured, vectorFrom: _here, ...rest } = identity;
    kit.identity = rest;
    if (logoPath && !identity.svg) {
      kit.logoFile = { ext: imageExt(logoPath), base64: dataUrlPayload(await doors.readMedia(logoPath)) };
    }
  }
  return kit;
}

/** Writes the kit next to the studio's records (never into the website folder: it would go online). Resolves its path. */
export async function saveKitFile(folder: string, kit: Kit, io: FolderIO): Promise<string> {
  const path = joinPath(folder, kitFileName(kit.name));
  const written = await io.writeFile(path, JSON.stringify(kit));
  if (!written.success) throw new KitError('KIT_NOT_WRITTEN', written.error);
  return path;
}

/**
 * Puts a kit in place: it is kept under studio/ (its pages go into the
 * website at every export), a picture logo is written on this machine, and
 * the settings take what the kit brings, minus what the person changed.
 */
export async function installKit<S extends SiteLike & { kit?: KitApplied }>(text: string, folder: string, site: S, doors: KitDoors, kitDir?: string, have?: StudioHave): Promise<{ site: S; kit: Kit; kept: string[]; added: number; logoPath?: string; portraitPath?: string; kitDir?: string }> {
  const kit = readKit(text);
  // An older kit, or the same one, does not come back over the one in place.
  if (!isNewer(kit, site.kit)) throw new KitError('KIT_NOT_NEWER');
  if (needsFolder(kit) && !kitDir) throw new KitError('KIT_NEEDS_FOLDER');
  const { records, ...settings } = kit;
  const added = records && kitDir ? await installRecords(records, kitDir, folder, doors.io, have ?? { pieces: new Set(), scenes: new Set(), markets: new Set(), film: false }) : 0;
  // The kit kept with her records is its settings and pages; the work lives in its own files.
  await saveStudioJson(doors.io, folder, KIT_FILE, settings);
  const stamp = Date.parse(kit.version);
  // Pictures are written only when the kit's will be used: one she chose stays, and leaves no stray copy.
  const ahead = applyKit(site, kit, site.kit, kit.logoFile ? 'logo' : undefined, kit.portraitFile ? 'portrait' : undefined).kept;
  const logoPath = kit.logoFile && !ahead.includes('identity') ? await doors.saveImage(`logo-kit-${stamp}.${kit.logoFile.ext}`, kit.logoFile.base64) : undefined;
  const portraitPath = kit.portraitFile && !ahead.includes('portrait') ? await doors.saveImage(`portrait-kit-${stamp}.${kit.portraitFile.ext}`, kit.portraitFile.base64) : undefined;
  const out = applyKit(site, kit, site.kit, logoPath, portraitPath);
  const showcase = mergeShowcase((site as { showcase?: Record<string, PieceShow> }).showcase ?? {}, kit, kitDir, joinPath);
  return { site: { ...out.site, kit: out.applied, ...(kit.showcase ? { showcase } : {}) }, kit, kept: out.kept, added, ...(logoPath ? { logoPath } : {}), ...(portraitPath ? { portraitPath } : {}), ...(kitDir ? { kitDir } : {}) };
}

/** What the studio already holds: a record of hers with the same id is never replaced by the kit's. */
export interface StudioHave { pieces: Set<string>; scenes: Set<string>; markets: Set<string>; film: boolean }

/**
 * The kit's work written into her studio, its media pointing into the kit
 * folder. Only what she does not have yet: her own scene, creation or film
 * stays hers. Resolves how many records were added.
 */
export async function installRecords(records: NonNullable<Kit['records']>, kitDir: string, folder: string, io: FolderIO, have: StudioHave): Promise<number> {
  const r = resolveMedia(records, kitDir, joinPath);
  let added = 0;
  for (const [dir, list, own] of [[PIECES_DIR, r.pieces, have.pieces], [SCENES_DIR, r.scenes, have.scenes], [MARKETS_DIR, r.markets, have.markets]] as const) {
    for (const rec of list) {
      if (own.has(rec.id)) continue;
      await saveRecord(io, folder, dir, rec);
      added++;
    }
  }
  if (r.film && !have.film) {
    await saveStudioJson(io, folder, FILM_FILE, r.film);
    added++;
  }
  return added;
}

/** The kit in place, read again (null when there is none). */
export async function loadKit(folder: string, io: FolderIO): Promise<Kit | null> {
  const raw = await loadStudioJson(io, folder, KIT_FILE);
  return raw === null ? null : readKit(JSON.stringify(raw));
}
