/**
 * A run of translations: one sentence after another through the host's
 * translator, counted as it goes, stopped on her word.
 *
 * Every call is one inference she may pay for (a cloud model) or wait for (a
 * local one), so the run says how many it has made, how many failed, and the
 * one it is on. The host has no door to cut an inference in flight: Stop
 * takes effect after the sentence being translated, and the run says so
 * (`stopping`) until that sentence is back.
 */

/** The longest text one call may carry: the host's own limit (translator.translate refuses beyond). */
export const TRANSLATE_MAX = 50_000;

export interface RunTally {
  /** Inferences made (answered or failed). */
  done: number;
  total: number;
  failed: number;
  /** Sentences never sent: longer than the host takes. */
  tooLong: number;
  /** The model being asked now; null between calls. */
  current: string | null;
  stopping: boolean;
}

export interface RunJob { from: string; model: string | null }

/**
 * Runs `jobs` in order through `translate`. `put` receives each answer as it
 * comes (a run stopped halfway keeps what it made). Resolves with the final
 * tally; never rejects: a failed sentence is counted, the run goes on, and
 * the first error is kept to be said.
 */
export async function runTranslations(jobs: RunJob[], io: {
  translate: (text: string, model: string | null) => Promise<{ text: string; model: string | null }>;
  put: (from: string, to: string, by: string | null) => void;
  tally: (t: RunTally) => void;
  stopped: () => boolean;
}): Promise<RunTally & { error?: unknown; stoppedAt?: number }> {
  const t: RunTally = { done: 0, total: jobs.length, failed: 0, tooLong: 0, current: null, stopping: false };
  let error: unknown;
  io.tally({ ...t });
  for (let i = 0; i < jobs.length; i++) {
    if (io.stopped()) return { ...t, current: null, stopping: false, stoppedAt: i, ...(error ? { error } : {}) };
    const job = jobs[i]!;
    if (job.from.length > TRANSLATE_MAX) { t.tooLong++; io.tally({ ...t }); continue; }
    t.current = job.model;
    io.tally({ ...t });
    try {
      const res = await io.translate(job.from, job.model);
      const to = res.text.trim();
      if (to) io.put(job.from, to, res.model ?? job.model);
      else t.failed++;
    } catch (err) {
      t.failed++;
      error ??= err;
    }
    t.done++;
    t.current = null;
    io.tally({ ...t, stopping: io.stopped() });
  }
  return { ...t, current: null, stopping: false, ...(error ? { error } : {}) };
}

/** Each sentence asked of each model: the comparison's jobs, sentence by sentence so the first rows fill first. */
export const compareJobs = (froms: string[], models: string[]): RunJob[] => froms.flatMap((from) => models.map((model) => ({ from, model })));
