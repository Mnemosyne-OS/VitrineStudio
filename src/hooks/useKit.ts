import { useState } from 'react';
import { hostIO, pickFolder, readMedia } from '../data/host';
import { saveImageBase64 } from '../data/photos';
import { installKit, makeKit, saveKitFile, type KitDoors } from '../data/kitIO';
import { baseName, joinPath } from '../data/folderStore';
import { applyKit, KIT_FOLDER_FILE, KIT_MAX_CHARS, KitError, mergeShowcase } from '../model/kit';
import { describeError } from '../components/errors';
import type { Studio } from './useStudio';

type ErrorShown = { key: string; raw?: string };
export type KitResult =
  | { kind: 'made'; file: string; pages: number }
  | { kind: 'installed'; name: string; kept: string[]; pages: number; added: number };

const doors: KitDoors = { io: hostIO, readMedia, saveImage: saveImageBase64 };

/**
 * The site kit (model/kit.ts): made on the maker's side, put in place on the
 * artisan's side. Its pages go into the website at every export (useSite).
 */
export function useKit(studio: Studio) {
  const { folder, site, patchSite, alive, pieces, scenes, markets, film, load } = studio;
  const [busy, setBusy] = useState<'make' | 'install' | null>(null);
  const [error, setError] = useState<ErrorShown | null>(null);
  const [result, setResult] = useState<KitResult | null>(null);

  const run = async (kind: 'make' | 'install', job: () => Promise<KitResult | null>) => {
    setBusy(kind);
    setError(null);
    setResult(null);
    try {
      const r = await job();
      if (alive.current) setResult(r);
    } catch (err) {
      console.warn(`[vitrine-studio] kit ${kind} failed:`, err);
      if (alive.current) setError(describeError(err));
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  /** The folder of hand-made pages the kit carries, remembered with the site. */
  const choosePages = async () => {
    const dir = await pickFolder();
    if (dir) await patchSite((cur) => ({ ...cur, kitSource: dir }));
  };
  const forgetPages = () => void patchSite((cur) => { const { kitSource: _gone, ...rest } = cur; return rest; });

  const make = () => run('make', async () => {
    if (!folder) return null;
    const kit = await makeKit(site, site.kitSource ?? null, doors);
    const path = await saveKitFile(folder, kit, hostIO);
    return { kind: 'made', file: baseName(path), pages: kit.pages.length };
  });

  /** A kit dropped on the zone, or picked in the system dialog. */
  const installFile = (file: File) => install(async () => {
    if (file.size > KIT_MAX_CHARS) throw new KitError('KIT_TOO_LARGE');
    // A folder dropped on the zone arrives as a file that cannot be read: the button chooses folders.
    try {
      return await file.text();
    } catch (err) {
      console.warn('[vitrine-studio] the dropped kit is not a readable file:', err);
      throw new KitError('KIT_DROPPED_FOLDER');
    }
  });
  /** A kit FOLDER (kit.json + media/), chosen in the system dialog: the only form that carries the studio's work. */
  const installPicked = () => install(async () => {
    const dir = await pickFolder();
    if (!dir) return null;
    const read = await hostIO.readFile(joinPath(dir, KIT_FOLDER_FILE));
    if (!read.success || typeof read.content !== 'string') throw new KitError('KIT_FOLDER_UNREADABLE', `${KIT_FOLDER_FILE}: ${read.error ?? ''}`);
    return { text: read.content, dir };
  });

  const install = (get: () => Promise<string | { text: string; dir: string } | null>) => run('install', async () => {
    if (!folder) return null;
    const got = await get();
    if (got === null) return null;
    const { text, dir } = typeof got === 'string' ? { text: got, dir: undefined } : got;
    const have = { pieces: new Set(pieces.map((p) => p.id)), scenes: new Set(scenes.map((s) => s.id)), markets: new Set(markets.map((m) => m.id)), film: !!film };
    const out = await installKit(text, folder, site, doors, dir, have);
    // Applied to the settings as they are NOW (an export may have finished during the install), with the pictures just written.
    let kept = out.kept;
    await patchSite((cur) => {
      const r = applyKit(cur, out.kit, cur.kit, out.logoPath, out.portraitPath);
      kept = r.kept;
      return { ...r.site, kit: r.applied, showcase: mergeShowcase(cur.showcase, out.kit, out.kitDir, joinPath) };
    });
    // The scenes, creations and film just written are read like any others.
    if (out.added > 0) await load(folder);
    return { kind: 'installed', name: out.kit.name, kept, pages: out.kit.pages.length, added: out.added };
  });

  /** Forgets the kit in place: its pages leave the next export, the settings stay as they are. */
  const removeKit = () => void patchSite((cur) => { const { kit: _gone, ...rest } = cur; return rest; });

  return { busy, error, result, make, installFile, installPicked, choosePages, forgetPages, removeKit };
}

export type KitActions = ReturnType<typeof useKit>;
