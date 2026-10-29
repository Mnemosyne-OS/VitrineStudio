/**
 * useSite mounted on a small studio held in React state, the host door mocked
 * (doc 145 §10.20): what the bar is told while the token's state is read or
 * cannot be, and what a publish keeps: the print and the visit counter of the
 * site as the send STARTED, and a refusal kept apart from the site still online.
 * The harness comes from the verification pass of session 1b77399b.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { normalizeSiteSettings } from '../model/records';
import type { SiteSettings } from '../site/buildSite';
import type { Studio } from './useStudio';

const host = vi.hoisted(() => ({
  siteTokenState: vi.fn(),
  deploySite: vi.fn(),
  saveSiteAsset: vi.fn(),
  videoToolsStatus: vi.fn(),
  readMedia: vi.fn(),
}));
vi.mock('../data/webp', async (orig) => ({ ...(await orig<object>()), toWebp: vi.fn().mockResolvedValue('AAAA') }));
vi.mock('../data/host', async (orig) => ({ ...(await orig<object>()), ...host }));

import { useSite } from './useSite';

const NOW = '2026-10-29T10:00:00.000Z';
const PIECES = [{ schema: 1, id: 'p1', name: 'Totem', kind: 'unique', status: 'available', tags: [], photoPath: 'C:/p1.webp', createdAt: NOW, updatedAt: NOW }];
const SCENES = [{ schema: 1, id: 's1', pieceId: 'p1', universe: 'Salon', variant: 'Console', placeDescription: '', animation: 'pothos', aspectRatio: '16:9', images: { place: 'C:/s1a.webp' }, validated: true, createdAt: NOW, updatedAt: NOW }];
const base: SiteSettings = normalizeSiteSettings({ siteId: 'site-1', projectName: 'atelier', brand: { name: 'Atelier' } }, '');
const TOKEN = { present: true, savedAt: 1, seal: 'sealed' };
const READY = { id: 'd1', url: 'https://atelier-k2j4.vercel.app', aliases: ['https://atelier.vercel.app'], readyState: 'READY' };

/** The studio's site in state, patched the way useStudio patches it. */
function useFakeStudio(initial: SiteSettings) {
  const [site, setSite] = useState(initial);
  const alive = useRef(true);
  const siteRef = useRef(site);
  siteRef.current = site;
  const patchSite = async (change: (cur: SiteSettings) => SiteSettings) => { const next = change(siteRef.current); siteRef.current = next; setSite(next); return true; };
  return { folder: 'MOCK', alive, loaded: true, site, siteRef, setSite, patchSite, scenes: SCENES, pieces: PIECES, films: [], fail: vi.fn(), settings: { profileId: 'ceramics-plants' } } as unknown as Studio;
}

function mount(initial = base) {
  return renderHook(() => {
    const studio = useFakeStudio(initial);
    const site = useSite(studio, false);
    return { studio, site };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  host.saveSiteAsset.mockResolvedValue(undefined);
  host.readMedia.mockResolvedValue('data:image/webp;base64,AAAA');
  host.videoToolsStatus.mockResolvedValue({ supported: true, installed: false, downloadBytes: 0 });
});

describe('useSite: the connection while the token is read', () => {
  it('is « checking » until the token state answers, never « to connect »', async () => {
    let answer!: (t: unknown) => void;
    host.siteTokenState.mockReturnValue(new Promise((r) => { answer = r; }));
    const { result } = mount();
    expect(result.current.site.stage).toBe('checking');
    expect(result.current.site.connected).toBeNull();
    await act(async () => { answer(TOKEN); });
    expect(result.current.site.stage).toBe('never');
  });

  it('an unreadable token state stays « checking », says so, and is read again on demand', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    host.siteTokenState.mockRejectedValueOnce(new Error('TIMEOUT')).mockResolvedValue(TOKEN);
    const { result } = mount();
    await waitFor(() => expect(result.current.site.tokenUnread).toBe(true));
    expect(result.current.site.stage).toBe('checking');
    await act(async () => { result.current.site.rereadToken(); });
    await waitFor(() => expect(result.current.site.stage).toBe('never'));
    expect(result.current.site.tokenUnread).toBe(false);
    warn.mockRestore();
  });
});

describe('useSite: what a publish keeps', () => {
  it('the print of the site as the send STARTED: a change made while Vercel works reads « behind »', async () => {
    host.siteTokenState.mockResolvedValue(TOKEN);
    let release!: (d: unknown) => void;
    host.deploySite.mockReturnValue(new Promise((r) => { release = r; }));
    const { result } = mount();
    await waitFor(() => expect(result.current.site.stage).toBe('never'));
    let sent!: Promise<void>;
    act(() => { sent = result.current.site.publishNow(); });
    await waitFor(() => expect(host.deploySite).toHaveBeenCalled());
    // The tagline changed, and the visit counter turned on, while Vercel works.
    await act(async () => { await result.current.studio.patchSite((cur) => ({ ...cur, analytics: true, brand: { ...cur.brand, tagline: 'Grès tourné' } })); });
    await act(async () => { release(READY); await sent; });
    expect(result.current.studio.site.lastPublish?.print).toBeTruthy();
    expect(result.current.site.stage).toBe('behind');
    // The page sent did not carry the counter: Online must still ask for an update.
    expect(result.current.studio.site.lastPublish?.analytics).toBeUndefined();
  });

  it('with no change while it is sent: « current », and « It’s online »', async () => {
    host.siteTokenState.mockResolvedValue(TOKEN);
    host.deploySite.mockResolvedValue(READY);
    const { result } = mount();
    await waitFor(() => expect(result.current.site.stage).toBe('never'));
    await act(async () => { await result.current.site.publishNow(); });
    expect(result.current.site.stage).toBe('current');
    expect(result.current.site.work.kind).toBe('published');
  });

  it('a send Vercel refuses is kept apart: the site still online keeps its address and its print', async () => {
    host.siteTokenState.mockResolvedValue(TOKEN);
    host.deploySite.mockResolvedValueOnce(READY).mockResolvedValueOnce({ id: 'd2', url: 'https://atelier-zz99.vercel.app', aliases: ['https://atelier-zz99.vercel.app'], readyState: 'ERROR' }).mockResolvedValueOnce(READY);
    const { result } = mount();
    await waitFor(() => expect(result.current.site.stage).toBe('never'));
    await act(async () => { await result.current.site.publishNow(); });
    const online = result.current.studio.site.lastPublish;
    await act(async () => { await result.current.site.publishNow(); });
    expect(result.current.site.stage).toBe('failed');
    expect(result.current.studio.site.lastPublish).toEqual(online);
    expect(result.current.studio.site.lastRefusal?.readyState).toBe('ERROR');
    // The next send Vercel takes clears the refusal.
    await act(async () => { await result.current.site.publishNow(); });
    expect(result.current.studio.site.lastRefusal).toBeUndefined();
    expect(result.current.site.stage).toBe('current');
  });

  it('a send Vercel had not confirmed stays « pending », never « It’s online »', async () => {
    host.siteTokenState.mockResolvedValue(TOKEN);
    host.deploySite.mockResolvedValue({ id: 'd1', url: 'https://atelier-k2j4.vercel.app', aliases: [], readyState: 'BUILDING' });
    const { result } = mount();
    await waitFor(() => expect(result.current.site.stage).toBe('never'));
    await act(async () => { await result.current.site.publishNow(); });
    expect(result.current.site.stage).toBe('pending');
    expect(result.current.site.work.kind).not.toBe('published');
  });
});
