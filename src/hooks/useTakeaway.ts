import { getLanguage, useI18n } from '../i18n';
import { hostIO, pickTakeaway, takeawayDoor } from '../data/host';
import { creationsTable, exportStudio, restoreStudio, type Progress } from '../data/takeaway';
import type { TakeawayKind, TakeawayResult } from '../components/TakeawayCard';
import type { Studio } from './useStudio';

/**
 * The four ways the studio leaves on a key, and the way it comes back
 * (data/takeaway.ts, doc 145 §10.13). Each one asks where first, in the
 * system's own dialog; the copy goes into its own subfolder named after the
 * workshop and the day.
 */
export function useTakeaway(studio: Studio, exportSiteTo: (folderId: string, onProgress: (done: number, total: number) => void) => Promise<{ files: number; failed: string[] }>) {
  const { t } = useI18n();
  const { folder, pieces, site, load } = studio;
  const lang = getLanguage();
  const tableLang = lang === 'fr' || lang === 'es' ? lang : 'en';
  const day = new Date().toISOString().slice(0, 10);
  const brand = site.brand.name.trim() || 'Atelier';

  const run = async (kind: TakeawayKind, onProgress: (p: Progress) => void): Promise<TakeawayResult> => {
    if (!folder) throw new Error('NO_FOLDER');
    const picked = await pickTakeaway('export', `${brand} – ${t(`takeaway.folder.${kind}`)} ${day}`);
    if (kind === 'all') {
      const r = await exportStudio(hostIO, folder, picked.id, takeawayDoor, brand, onProgress);
      return { folder: picked.name, written: r.written, failed: r.failed };
    }
    if (kind === 'site') {
      const r = await exportSiteTo(picked.id, (done, total) => onProgress({ done, total }));
      return { folder: picked.name, written: r.files, failed: r.failed };
    }
    // The creations as a table, with the photos it names beside it.
    const table = creationsTable(pieces, site.showcase, site.categories, site.currency.main, tableLang);
    const total = table.photos.length + 1;
    const failed: string[] = [];
    let done = 0;
    for (const p of table.photos) {
      try {
        await takeawayDoor.copyFrom(picked.id, p.rel, p.from);
      } catch (err) {
        console.warn('[vitrine-studio] a photo was not copied:', p.from, err);
        failed.push(p.from);
      }
      onProgress({ done: ++done, total });
    }
    await takeawayDoor.write(picked.id, `${t('takeaway.tableFile')}.csv`, table.csv);
    onProgress({ done: ++done, total });
    return { folder: picked.name, written: done - failed.length, failed };
  };

  /** A copy brought back; the studio is read again so everything it added shows at once. */
  const restore = async (onProgress: (p: Progress) => void): Promise<TakeawayResult> => {
    if (!folder) throw new Error('NO_FOLDER');
    const picked = await pickTakeaway('import');
    const r = await restoreStudio(hostIO, folder, picked.id, takeawayDoor, onProgress);
    if (r.added) await load(folder);
    return { folder: picked.name, written: r.added, added: r.added, kept: r.kept, failed: r.failed };
  };

  return { run, restore };
}
