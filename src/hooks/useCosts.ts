import { useRef } from 'react';
import { useI18n } from '../i18n';
import { generateImage, hostIO, videoStatus, type GenerateRequest } from '../data/host';
import { loadStudioJson, saveStudioJson } from '../data/folderStore';
import type { ClipDeps } from '../data/makeClip';
import { clipDeps } from '../data/hostDeps';
import { COSTS_FILE, normalizeCosts, type CostEntry, type CostKind } from '../model/costs';
import type { Studio } from './useStudio';

/**
 * The ledger of what was spent (studio/costs.json). One line per debit, as
 * the host reported it; a debit it did not report is a line with no amount,
 * never a zero.
 */
export function useCosts(studio: Studio) {
  const { t } = useI18n();
  const { folder, costsReadable, setCosts, setNotice, alive } = studio;
  const chain = useRef<Promise<void>>(Promise.resolve());

  /**
   * One line per debit. The file is re-read before each write (one write at
   * a time) and never written when it could not be read.
   */
  const spend = (record: string, kind: CostKind, model: string, usdMicro: number | null | undefined) => {
    const entry: CostEntry = { at: new Date().toISOString(), record, kind, model, usd: typeof usdMicro === 'number' ? usdMicro / 1_000_000 : null };
    setCosts((all) => [...all, entry]);
    if (!folder || !costsReadable) return;
    const root = folder;
    chain.current = chain.current
      .then(async () => {
        const entries = normalizeCosts(await loadStudioJson(hostIO, root, COSTS_FILE));
        await saveStudioJson(hostIO, root, COSTS_FILE, { schema: 1, entries: [...entries, entry] });
      })
      .catch((err) => {
        console.error('[vitrine-studio] a cost line was not written:', err);
        if (alive.current) setNotice({ kind: 'error', text: t('costs.notSaved') });
      });
  };

  /** A picture drawn for `record`, its debit written down. */
  const spendingImage = (record: string) => async (req: GenerateRequest) => {
    const made = await generateImage(req);
    spend(record, 'image', made.model, made.billedUsdMicro);
    return made;
  };

  /** The clip follow-up for `record`: the debit arrives with the finished job, read once. */
  const spendingClips = (record: string): ClipDeps => ({
    ...clipDeps,
    status: async (id) => {
      const job = await videoStatus(id);
      if (job.state === 'done' && job.path) spend(record, 'clip', job.model ?? '', job.billedUsdMicro);
      return job;
    },
  });

  return { spendingImage, spendingClips };
}

export type Costs = ReturnType<typeof useCosts>;
