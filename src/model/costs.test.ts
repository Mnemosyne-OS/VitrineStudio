import { CREDIT_MARKUP, estimateClip, estimateImage, formatUsd, normalizeCosts, totalOf, type CostEntry } from './costs';

const line = (record: string, usd: number | null, kind: CostEntry['kind'] = 'image'): CostEntry => ({ at: '2026-10-10T00:00:00Z', record, kind, model: 'm', usd });

describe('costs', () => {
  it('reads the ledger, keeps a missing debit as null and drops what is not a line', () => {
    const got = normalizeCosts({ entries: [line('a', 0.18), { ...line('b', null) }, { at: 1 }, { ...line('c', 0.5), usd: -1 }, null] });
    expect(got.map((e) => [e.record, e.usd])).toEqual([['a', 0.18], ['b', null], ['c', null]]);
    expect(normalizeCosts(null)).toEqual([]);
  });

  it('sums what was debited and counts apart the calls with no amount', () => {
    const t = totalOf([line('a', 0.18), line('a', null), line('b', 0.81, 'clip')], (e) => e.record === 'a');
    expect(t).toEqual({ usd: 0.18, count: 2, unmeasured: 1 });
  });

  it('estimates at list price times the credit markup, and knows when it has no price', () => {
    expect(estimateImage('gemini-3-pro-image')).toBeCloseTo(0.134 * CREDIT_MARKUP);
    expect(estimateImage('unknown-model')).toBeNull();
    expect(estimateClip(6)).toBeCloseTo(0.81);
  });

  it('writes a dash for an unknown amount, never zero', () => {
    expect(formatUsd(null, 'fr')).toBe('—');
    expect(formatUsd(0.8, 'en')).toBe('$0.80');
    expect(formatUsd(0.8, 'fr')).toMatch(/^0,80\s\$$/);
  });
});
