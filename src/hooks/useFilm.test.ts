import { act, renderHook, waitFor } from '@testing-library/react';
import { newFilm, type Film } from '../model/filmRecord';
import type { Studio } from './useStudio';
import type { Costs } from './useCosts';

const written: Array<{ where: string; id: string }> = [];
vi.mock('../data/host', () => ({ hostIO: {} }));
vi.mock('../data/folderStore', async (orig) => ({
  ...(await orig<typeof import('../data/folderStore')>()),
  saveStudioJson: vi.fn(async (_io: unknown, _root: string, name: string, f: Film) => { written.push({ where: name, id: f.id }); }),
  saveRecord: vi.fn(async (_io: unknown, _root: string, dir: string, f: Film) => { written.push({ where: dir, id: f.id }); }),
}));
let finish: (path: string) => void = () => {};
vi.mock('../data/removeFilm', () => ({ archiveFilm: vi.fn(async () => {}), deleteFilmForGood: vi.fn(async () => []), filesOwnedByFilm: vi.fn(() => []) }));
vi.mock('../data/makeClip', () => ({ followJob: vi.fn(() => new Promise<string>((resolve) => { finish = resolve; })) }));

const { useFilm } = await import('./useFilm');

/** Two films, the second one being looked at; the first has a clip being made. */
function fakeStudio() {
  const first: Film = { ...newFilm('ceramics-plants', '16:9'), clipJobs: { making: { id: 'job-1', startedAt: '2026-10-11T10:00:00Z' } } };
  const second: Film = { ...newFilm('ceramics-plants', '16:9', new Date(), 'film-b'), validated: true };
  const filmsRef = { current: [first, second] };
  const studio = {
    folder: 'C:/s', alive: { current: true }, loaded: false, setNotice: vi.fn(), setFilmId: vi.fn(), settings: { profileId: 'ceramics-plants' },
    filmsRef,
    dropFilm: vi.fn((id: string) => { filmsRef.current = filmsRef.current.filter((f) => f.id !== id); }),
    putFilm: (next: Film) => { filmsRef.current = filmsRef.current.map((f) => (f.id === next.id ? next : f)).concat(filmsRef.current.some((f) => f.id === next.id) ? [] : [next]); },
  } as unknown as Studio;
  const costs = { spendingClips: vi.fn(() => ({})) } as unknown as Costs;
  return { studio, costs, filmsRef };
}

describe('several films', () => {
  beforeEach(() => { written.length = 0; });

  it('write a finished clip to the film it was made for, never to the one on screen', async () => {
    const { studio, costs, filmsRef } = fakeStudio();
    const { result } = renderHook(() => useFilm(studio, costs));
    act(() => result.current.followFilmClip('film', 'making', { id: 'job-1', startedAt: '2026-10-11T10:00:00Z' }));
    await act(async () => { finish('C:/s/clip.mp4'); });
    await waitFor(() => expect(filmsRef.current[0]!.clips.making).toBe('C:/s/clip.mp4'));
    expect(filmsRef.current[1]!.clips.making).toBeUndefined();
    expect(written).toEqual([{ where: 'film.json', id: 'film' }]);
    // Its cost line is that film's.
    expect(costs.spendingClips).toHaveBeenCalledWith('film');
  });

  it('follow one job once per film', () => {
    const { studio, costs } = fakeStudio();
    const { result } = renderHook(() => useFilm(studio, costs));
    act(() => {
      result.current.followFilmClip('film', 'making', { id: 'job-1', startedAt: '2026-10-11T10:00:00Z' });
      result.current.followFilmClip('film', 'making', { id: 'job-1', startedAt: '2026-10-11T10:00:00Z' });
    });
    expect(costs.spendingClips).toHaveBeenCalledTimes(1);
  });

  it('put one film on the site and take the other off, each written to its own file', async () => {
    const { studio, costs, filmsRef } = fakeStudio();
    const { result } = renderHook(() => useFilm(studio, costs));
    await act(async () => { await result.current.setOnSite('film', true); });
    expect(filmsRef.current.map((f) => [f.id, f.validated])).toEqual([['film', true], ['film-b', false]]);
    expect(written.sort((a, b) => a.id.localeCompare(b.id))).toEqual([{ where: 'film.json', id: 'film' }, { where: 'studio/films', id: 'film-b' }]);
  });

  it('pick every film’s clips back after a reload, not only the first film’s', () => {
    const { studio, costs, filmsRef } = fakeStudio();
    filmsRef.current = [filmsRef.current[0]!, { ...filmsRef.current[1]!, clipJobs: { alive: { id: 'job-2', startedAt: '2026-10-11T10:00:00Z' } } }];
    renderHook(() => useFilm({ ...studio, loaded: true }, costs));
    expect((costs.spendingClips as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).sort()).toEqual(['film', 'film-b']);
  });

  it('remove a film, but never the one on the site nor one with a clip being made', async () => {
    const { studio, costs, filmsRef } = fakeStudio();
    const { result } = renderHook(() => useFilm(studio, costs));
    // film-b is on the site; « film » has a clip being made.
    expect(await result.current.removeFilm('film-b', 'archive', [])).toEqual({ ok: false, error: { key: 'film.remove.onSite' } });
    expect(await result.current.removeFilm('film', 'delete', [])).toEqual({ ok: false, error: { key: 'film.remove.running' } });
    expect(filmsRef.current).toHaveLength(2);
    filmsRef.current = filmsRef.current.map((f) => ({ ...f, validated: false }));
    await act(async () => { expect(await result.current.removeFilm('film-b', 'archive', [])).toEqual({ ok: true, left: [] }); });
    expect(studio.dropFilm).toHaveBeenCalledWith('film-b');
  });

  it('duplicate a film: same pictures and videos, its own id and file, off the site, no video being made', async () => {
    const { studio, costs, filmsRef } = fakeStudio();
    filmsRef.current = [{ ...filmsRef.current[0]!, validated: true, keyframes: { workshop: 'C:/g/k0.png' }, clips: { making: 'C:/g/c.mp4' } }, filmsRef.current[1]!];
    const { result } = renderHook(() => useFilm(studio, costs));
    let copy: Film | null = null;
    await act(async () => { copy = await result.current.duplicateFilm('film', 'Film 1 (copie)'); });
    expect(copy!.id.startsWith('film-')).toBe(true);
    expect(copy!.name).toBe('Film 1 (copie)');
    expect(copy!.keyframes).toEqual({ workshop: 'C:/g/k0.png' });
    expect(copy!.clips).toEqual({ making: 'C:/g/c.mp4' });
    expect(copy!.validated).toBe(false);
    expect(copy!.clipJobs).toEqual({});
    expect(filmsRef.current[0]!.validated).toBe(true);
    expect(written).toEqual([{ where: 'studio/films', id: copy!.id }]);
    expect(studio.setFilmId).toHaveBeenCalledWith(copy!.id);
  });

  it('make a new film in its own file and open it', async () => {
    const { studio, costs, filmsRef } = fakeStudio();
    const { result } = renderHook(() => useFilm(studio, costs));
    let made: Film | null = null;
    await act(async () => { made = await result.current.createFilm({ name: 'Été', aspectRatio: '9:16', animation: 'plant', workshopDescription: '', pieceId: 'p1' }); });
    expect(made!.id.startsWith('film-')).toBe(true);
    expect(made!.aspectRatio).toBe('9:16');
    expect(filmsRef.current).toHaveLength(3);
    expect(written).toEqual([{ where: 'studio/films', id: made!.id }]);
    expect(studio.setFilmId).toHaveBeenCalledWith(made!.id);
  });
});
