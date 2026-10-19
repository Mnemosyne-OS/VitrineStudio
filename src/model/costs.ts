/**
 * What the studio spent, and what the next output will cost (Tony, 2026-10-09:
 * "un suivi des coûts, des estimations des coûts de sortie, le coût total du
 * projet").
 *
 * Two kinds of figure, never mixed:
 * - SPENT: what the gate DEBITED, read from its answer, one line per picture
 *   or clip in `studio/costs.json`. Append only: deleting or archiving a scene
 *   never removes what it cost. A call whose debit was not reported is a line
 *   with `usd: null`, shown "—" and counted apart, never 0.
 * - ESTIMATED: list price × the credit markup, dated. Only ever before a
 *   click, labelled as an estimate.
 */
export type CostKind = 'image' | 'clip';

export interface CostEntry {
  at: string;
  /** The scene id, or the film's id (`film`, `film-…`, model/filmRecord.ts). */
  record: string;
  kind: CostKind;
  model: string;
  /** What was debited, in USD. null = the gate did not say. */
  usd: number | null;
}

export const COSTS_FILE = 'costs.json';

export function normalizeCosts(raw: unknown): CostEntry[] {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { entries?: unknown }).entries) ? (raw as { entries: unknown[] }).entries : [];
  const out: CostEntry[] = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const r = e as Record<string, unknown>;
    if (typeof r.at !== 'string' || typeof r.record !== 'string' || (r.kind !== 'image' && r.kind !== 'clip')) continue;
    const usd = typeof r.usd === 'number' && Number.isFinite(r.usd) && r.usd >= 0 ? r.usd : null;
    out.push({ at: r.at, record: r.record.slice(0, 80), kind: r.kind, model: typeof r.model === 'string' ? r.model.slice(0, 100) : '', usd });
  }
  return out;
}

export interface CostTotal {
  /** Sum of the debits that were reported. */
  usd: number;
  /** Calls counted. */
  count: number;
  /** Calls whose debit was not reported: the sum is then "at least". */
  unmeasured: number;
}

export function totalOf(entries: CostEntry[], keep: (e: CostEntry) => boolean = () => true): CostTotal {
  let usd = 0;
  let count = 0;
  let unmeasured = 0;
  for (const e of entries) {
    if (!keep(e)) continue;
    count++;
    if (e.usd === null) unmeasured++;
    else usd += e.usd;
  }
  return { usd, count, unmeasured };
}

// ── Estimates ──────────────────────────────────────────────────────────────

/** The day the list prices below were read (the gate's table, license-gate/lib/credits.ts). */
export const PRICES_READ_ON = '2026-10-09';
/** The credit program's markup on the provider's list price (DEFAULT_CREDIT_MARKUP). */
export const CREDIT_MARKUP = 1.35;
/** List price per picture, USD (1K; Pro is the same price in 2K). */
export const IMAGE_LIST_USD: Record<string, number> = {
  'gemini-3-pro-image': 0.134,
  'gemini-3.1-flash-image': 0.067,
  'gemini-3.1-flash-lite-image': 0.0336,
  'gemini-2.5-flash-image': 0.039,
};
/** Veo 3.1 fast, with audio, 720p: list price per second. */
export const CLIP_LIST_USD_PER_SECOND = 0.1;

/** What one picture will cost, or null for a model with no listed price. */
export function estimateImage(model: string): number | null {
  const list = IMAGE_LIST_USD[model];
  return list === undefined ? null : list * CREDIT_MARKUP;
}

export function estimateClip(seconds: number): number {
  return CLIP_LIST_USD_PER_SECOND * seconds * CREDIT_MARKUP;
}

/** "0,54 $" / "$0.54"; null is a dash, never "0". */
export function formatUsd(usd: number | null, lang: string): string {
  if (usd === null) return '—';
  const n = usd.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return lang === 'en' ? `$${n}` : `${n} $`;
}
