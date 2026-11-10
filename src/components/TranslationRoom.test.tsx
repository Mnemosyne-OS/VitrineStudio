/**
 * The translation room mounted (doc 145 §10.22): Escape with a draft, the old
 * host, Stop after the sentence in flight, Compare with an unnamed model, a
 * stale line. Written by the cold verification pass, adopted with its asserts.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TranslationRoom } from './TranslationRoom';
import type { HerWord, SiteTranslation } from '../model/translation';

const models = vi.fn();
const translate = vi.fn();
vi.mock('../data/host', async (orig) => {
  const real = await orig<typeof import('../data/host')>();
  return {
    ...real,
    translatorModels: (...a: unknown[]) => models(...a),
    translateText: (...a: unknown[]) => translate(...a),
  };
});

const CHOICES = [
  { id: 'local:q', label: 'Qwen', route: 'local', free: true },
  { id: 'cloud:mnemo-cloud', label: 'Fast', route: 'cloud', free: false },
];
const words: HerWord[] = [
  { text: 'Un', group: 'about', where: 'tagline' },
  { text: 'Deux', group: 'about', where: 'intro' },
  { text: 'Trois', group: 'creations', where: 'piece:p1:name' },
];

function mount(tr: SiteTranslation, over: { onChange?: ReturnType<typeof vi.fn>; onClose?: ReturnType<typeof vi.fn> } = {}) {
  const onChange = over.onChange ?? vi.fn();
  const onClose = over.onClose ?? vi.fn();
  // The room's onChange hands an updater; apply it on the latest state so the probe sees what the file would hold.
  let state = tr;
  onChange.mockImplementation((up: (c: SiteTranslation | undefined) => SiteTranslation | undefined) => { state = up(state) ?? state; });
  const r = render(<TranslationRoom lang="en" main="fr" translation={tr} words={words} onChange={onChange} onClose={onClose} />);
  return { onChange, onClose, state: () => state, rerender: (next: SiteTranslation) => r.rerender(<TranslationRoom lang="en" main="fr" translation={next} words={words} onChange={onChange} onClose={onClose} />) };
}

beforeEach(() => {
  models.mockReset().mockResolvedValue({ current: CHOICES[1], choices: CHOICES });
  translate.mockReset().mockImplementation(async (text: string, _s: string, _t: string, m: string | null) => ({ text: `${text} EN`, model: m ?? 'cloud:mnemo-cloud' }));
  localStorage.clear();
});

describe('the room mounted', () => {
  it('Escape while a draft is being typed writes the draft before closing', async () => {
    const tr: SiteTranslation = { lang: 'en', entries: { Un: { to: 'One', by: 'local:q', at: 'tagline' } } };
    const { onChange, onClose, state } = mount(tr);
    await screen.findAllByText('Qwen');
    const field = screen.getByLabelText<HTMLTextAreaElement | HTMLInputElement>('Translation of “Un”');
    expect(field.value).toBe('One');
    field.focus();
    fireEvent.change(field, { target: { value: 'One, by her' } });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalled();
    expect(state().entries.Un).toMatchObject({ to: 'One, by her', ok: true, ed: true });
  });

  it('an old host (no translator.models): says so, and translates with the current model unnamed', async () => {
    models.mockRejectedValue(new Error('unknown action translator.models'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { state } = mount({ lang: 'en', entries: {} });
    expect(await screen.findByText(/offers no other model/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Translate what is missing \(3\)/));
    await waitFor(() => expect(translate).toHaveBeenCalledTimes(3));
    expect(translate.mock.calls[0]![3]).toBeNull();
    await waitFor(() => expect(screen.getByText('No translation running')).toBeInTheDocument());
    // No model named, so no line is signed with a guess.
    expect(state().entries.Un).toEqual({ to: 'Un EN', by: 'cloud:mnemo-cloud', at: 'tagline' });
    warn.mockRestore();
  });

  it('Stop during the 2nd call: the readout says it is stopping, the 3rd sentence is never sent', async () => {
    let release: (() => void) | null = null;
    translate.mockImplementation((text: string, _s: string, _t: string, m: string | null) => new Promise((res) => {
      const done = () => res({ text: `${text} EN`, model: m });
      if (text === 'Deux') release = done; else done();
    }));
    const { state } = mount({ lang: 'en', entries: {} });
    await screen.findAllByText('Qwen');
    fireEvent.click(screen.getByText('Qwen'));
    fireEvent.click(screen.getByText(/Translate what is missing \(3\)/));
    await waitFor(() => expect(release).not.toBeNull());
    fireEvent.click(screen.getByText('Stop'));
    expect(screen.getByText('Stopping after this sentence')).toBeInTheDocument();
    await act(async () => { release!(); });
    await waitFor(() => expect(screen.getByText('No translation running')).toBeInTheDocument());
    expect(translate).toHaveBeenCalledTimes(2);
    expect(Object.keys(state().entries).sort()).toEqual(['Deux', 'Un']);
    expect(state().entries.Un).toMatchObject({ to: 'Un EN', by: 'local:q', at: 'tagline' });
    expect(localStorage.getItem('vitrine_tr_model')).toBe('local:q');
  });

  it('Compare: a host that names no model in its answer still fills the cells (the key is `by ?? model`)', async () => {
    translate.mockImplementation(async (text: string, _s: string, _t: string, m: string | null) => ({ text: `${text} by ${m}`, model: null }));
    const { state } = mount({ lang: 'en', entries: {} });
    await screen.findAllByText('Qwen');
    fireEvent.click(screen.getByText('Compare'));
    fireEvent.click(screen.getByText('Qwen'));
    fireEvent.click(screen.getByText('Fast'));
    fireEvent.click(screen.getByText(/Compare 3 sentences × 2 models/));
    await waitFor(() => expect(translate).toHaveBeenCalledTimes(6));
    await waitFor(() => expect(screen.getByText('No translation running')).toBeInTheDocument());
    const cells = screen.getAllByText(/ by (local:q|cloud:mnemo-cloud)$/);
    fireEvent.click(screen.getAllByText('Take all')[0]!);
    expect(cells.length).toBe(6);
    expect(state().entries.Un).toMatchObject({ to: 'Un by local:q', by: 'local:q' });
  });

  it('a stale line: Take back puts the old translation as a proposal and lets the orphan go', async () => {
    const tr: SiteTranslation = { lang: 'en', entries: { Uno: { to: 'One (old)', ok: true, by: 'local:q', at: 'tagline' } } };
    const { state } = mount(tr);
    await screen.findAllByText('Qwen');
    expect(screen.getAllByText('Text changed').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Reuse'));
    expect(state().entries).toEqual({ Un: { to: 'One (old)', by: 'local:q', at: 'tagline' } });
  });

  it('the readout and the widget counts on the three lines; Translate asks only the missing one', async () => {
    const tr: SiteTranslation = { lang: 'en', entries: { Un: { to: 'One', ok: true, at: 'tagline' }, Deux: { to: 'Two', at: 'intro' } } };
    mount(tr);
    await screen.findAllByText('Qwen');
    expect(screen.getByTitle('1 of 3 sentences read')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Translate what is missing \(1\)/));
    await waitFor(() => expect(screen.getByText('No translation running')).toBeInTheDocument());
    expect(translate).toHaveBeenCalledTimes(1);
    expect(translate.mock.calls[0]![0]).toBe('Trois');
  });

  it('translating a stale line lets the old translation it showed go, and only it', async () => {
    const tr: SiteTranslation = { lang: 'en', entries: { Uno: { to: 'One (old)', ok: true, at: 'tagline' }, Deux: { to: 'Two', ok: true, at: 'intro' } } };
    const { state } = mount(tr);
    await screen.findAllByText('Qwen');
    fireEvent.click(screen.getByText(/Translate what is missing \(2\)/));
    await waitFor(() => expect(screen.getByText('No translation running')).toBeInTheDocument());
    expect(Object.keys(state().entries).sort()).toEqual(['Deux', 'Trois', 'Un']);
  });

  it('a remembered model the host no longer offers falls back to the current one', async () => {
    localStorage.setItem('vitrine_tr_model', 'local:gone');
    mount({ lang: 'en', entries: {} });
    await screen.findAllByText('Qwen');
    expect(screen.getByText('With Fast')).toBeInTheDocument();
    expect(localStorage.getItem('vitrine_tr_model')).toBe('local:gone');
  });

  it('an answer landing on the line she is typing in never takes her words away', async () => {
    const tr: SiteTranslation = { lang: 'en', entries: {} };
    const { rerender } = mount(tr);
    await screen.findAllByText('Qwen');
    const field = screen.getByLabelText<HTMLTextAreaElement | HTMLInputElement>('Translation of “Un”');
    fireEvent.change(field, { target: { value: 'Mine' } });
    rerender({ lang: 'en', entries: { Un: { to: 'A model answer', by: 'local:q', at: 'tagline' } } });
    expect(screen.getByLabelText<HTMLTextAreaElement | HTMLInputElement>('Translation of “Un”').value).toBe('Mine');
  });
});
