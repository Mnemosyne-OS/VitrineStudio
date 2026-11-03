import { compareJobs, runTranslations, TRANSLATE_MAX, type RunTally } from './translationRun';

const setup = (answer: (text: string, model: string | null) => Promise<{ text: string; model: string | null }>, stopAfter = Infinity) => {
  const put: Array<[string, string, string | null]> = [];
  const tallies: RunTally[] = [];
  let calls = 0;
  const io = {
    translate: (text: string, model: string | null) => { calls++; return answer(text, model); },
    put: (from: string, to: string, by: string | null) => { put.push([from, to, by]); },
    tally: (t: RunTally) => { tallies.push(t); },
    stopped: () => calls >= stopAfter,
  };
  return { io, put, tallies, calls: () => calls };
};

describe('a run of translations', () => {
  it('counts each inference, keeps going after a failure, says the first error', async () => {
    const s = setup(async (text, model) => {
      if (text === 'b') throw new Error('LLM_ABORTED');
      return { text: text === 'c' ? '  ' : ` ${text}-en `, model: model ?? 'cloud:mnemo-cloud' };
    });
    const out = await runTranslations([{ from: 'a', model: null }, { from: 'b', model: null }, { from: 'c', model: null }, { from: 'd', model: 'local:q' }], s.io);
    expect(s.put).toEqual([['a', 'a-en', 'cloud:mnemo-cloud'], ['d', 'd-en', 'local:q']]);
    expect(out).toMatchObject({ done: 4, total: 4, failed: 2, current: null });
    expect(String(out.error)).toContain('LLM_ABORTED');
    expect(s.tallies.some((t) => t.current === 'local:q')).toBe(true);
  });
  it('stops after the sentence in flight, keeps what it made, never sends the next', async () => {
    const s = setup(async (text) => ({ text: `${text}!`, model: 'local:q' }), 2);
    const out = await runTranslations([{ from: 'a', model: 'local:q' }, { from: 'b', model: 'local:q' }, { from: 'c', model: 'local:q' }], s.io);
    expect(s.calls()).toBe(2);
    expect(s.put.map((p) => p[0])).toEqual(['a', 'b']);
    expect(out).toMatchObject({ done: 2, stoppedAt: 2 });
    // While the second sentence was back with Stop pressed, the readout said it was stopping.
    expect(s.tallies.at(-1)!.stopping).toBe(true);
  });
  it('never sends a text longer than the host takes', async () => {
    const s = setup(async (text) => ({ text, model: null }));
    const out = await runTranslations([{ from: 'x'.repeat(TRANSLATE_MAX + 1), model: null }, { from: 'ok', model: null }], s.io);
    expect(s.calls()).toBe(1);
    expect(out).toMatchObject({ tooLong: 1, done: 1 });
  });
  it('asks each model each sentence, sentence by sentence', () => {
    expect(compareJobs(['a', 'b'], ['m1', 'm2'])).toEqual([{ from: 'a', model: 'm1' }, { from: 'a', model: 'm2' }, { from: 'b', model: 'm1' }, { from: 'b', model: 'm2' }]);
  });
});
