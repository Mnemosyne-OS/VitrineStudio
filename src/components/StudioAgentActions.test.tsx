import { render } from '@testing-library/react';
import { normalizeSiteSettings } from '../model/records';

type Handlers = Record<string, (args: Record<string, unknown>) => unknown>;
const door = vi.hoisted(() => ({ handlers: null as Handlers | null, has: true }));

vi.mock('../data/host', () => ({
  sdk: {
    get onAgentActions() {
      if (!door.has) return undefined;
      return (h: Handlers) => { door.handlers = h; return { ready: Promise.resolve(), off: () => {} }; };
    },
  },
}));

import { StudioAgentActions } from './StudioAgentActions';

const PIECES = [
  { id: 'p1', name: 'Vase bleu', kind: 'unique', tags: [], photoPath: 'vase.png' },
  { id: 'p2', name: 'Grand vase bleu', kind: 'unique', tags: [] },
];
const SCENES = [
  { id: 's1', pieceId: 'p1', universe: 'Salon', variant: 'Console', images: { place: 'a.png', piece: 'b.png' }, validated: false },
  { id: 's2', pieceId: 'p2', universe: 'Jardin', variant: '', images: {}, validated: false },
];

function mount(patchSite: (change?: unknown) => Promise<boolean>, opts: { editPiece?: () => Promise<boolean>; siteActions?: Record<string, unknown>; siteId?: string } = {}) {
  const openTab = vi.fn();
  const view = { showScene: vi.fn(), showPiece: vi.fn(), closeAll: vi.fn(), newScene: vi.fn() };
  const editPiece = vi.fn(opts.editPiece ?? (async () => true));
  const site = normalizeSiteSettings({}, '');
  site.pages = [{ id: 'atelier', type: 'text', name: 'Mon atelier' }];
  if (opts.siteId) site.siteId = opts.siteId;
  const studio = {
    siteRef: { current: site }, piecesRef: { current: PIECES }, scenesRef: { current: SCENES },
    settings: { aspectRatio: '16:9' }, patchSite: vi.fn(patchSite),
  };
  render(<StudioAgentActions studio={studio as never} sceneActions={{ work: {} } as never} siteActions={(opts.siteActions ?? { work: { kind: 'idle' } }) as never}
    pieceActions={{ editPiece } as never} openTab={openTab} view={view} />);
  return { openTab, view, editPiece, studio };
}

describe('the studio\'s agent door', () => {
  beforeEach(() => { door.handlers = null; door.has = true; });

  it('publishSite refuses what the bar refuses: a site with nothing to show would replace the one online', () => {
    const publishNow = vi.fn();
    const refusedBy = (stage: string, code: RegExp) => {
      document.body.innerHTML = '';
      mount(async () => true, { siteId: 'site-1', siteActions: { work: { kind: 'idle' }, stage, missing: ['scene'], publishNow } });
      expect(() => door.handlers!.publishSite!({})).toThrow(code);
    };
    refusedBy('incomplete', /^INCOMPLETE: the site lacks scene/);
    refusedBy('unconnected', /^NO_SITE/);
    refusedBy('checking', /^NOT_READY/);
    expect(publishNow).not.toHaveBeenCalled();
    document.body.innerHTML = '';
    mount(async () => true, { siteId: 'site-1', siteActions: { work: { kind: 'idle' }, stage: 'behind', missing: [], publishNow } });
    expect(door.handlers!.publishSite!({})).toEqual({ started: true, follow: 'call siteStatus' });
    expect(publishNow).toHaveBeenCalledTimes(1);
  });

  it('addPage answers once the page is written, and shows it', async () => {
    const { openTab } = mount(async () => true);
    const out = await door.handlers!.addPage!({ type: 'text', name: 'Atelier' });
    expect(out).toEqual({ pageId: expect.any(String) });
    expect(openTab).toHaveBeenCalledWith(`page:${(out as { pageId: string }).pageId}`);
  });

  it('addPage says a refused write, never « done », and shows nothing', async () => {
    const { openTab } = mount(async () => false);
    await expect(door.handlers!.addPage!({ type: 'text', name: 'Atelier' })).rejects.toThrow(/^WRITE_FAILED/);
    expect(openTab).not.toHaveBeenCalled();
  });

  it('a scene named by its piece opens full screen on its last picture; a name that fits two is refused with both', () => {
    const { view } = mount(async () => true);
    expect(door.handlers!.showScene!({ scene: 'le vase bleu du salon' })).toEqual({ sceneId: 's1', beat: 'piece' });
    expect(view.showScene).toHaveBeenCalledWith('s1', 'piece');
    expect(() => door.handlers!.showScene!({ scene: 'bleu' })).toThrow('AMBIGUOUS: "bleu" names several scenes: Vase bleu · Salon · Console, Grand vase bleu · Jardin');
    expect(() => door.handlers!.showScene!({ scene: 'grand vase' })).toThrow(/^NOT_MADE/);
    expect(() => door.handlers!.showScene!({ scene: 'vase bleu', beat: 'alive' })).toThrow(/^NOT_MADE: this scene has no alive picture yet; it has place, piece/);
    expect(view.showScene).toHaveBeenCalledTimes(1);
  });

  it('a piece sold by voice is saved before it is answered, and a refused write is said', async () => {
    const { editPiece } = mount(async () => true);
    await expect(door.handlers!.editPiece!({ piece: 'vase bleu', status: 'sold', price: 40.004 })).resolves.toEqual({ pieceId: 'p1', status: 'sold', price: 40 });
    expect(editPiece).toHaveBeenCalledWith(PIECES[0], { status: 'sold', price: 40 });
    await expect(door.handlers!.editPiece!({ piece: 'vase bleu' })).rejects.toThrow(/^BAD_ARG: say what changes/);
    mount(async () => true, { editPiece: async () => false });
    await expect(door.handlers!.editPiece!({ piece: 'grand vase', name: 'Amphore' })).rejects.toThrow(/^WRITE_FAILED/);
  });

  it('a screen by its id or a page she added by its name; what was open over it closes', () => {
    const { openTab, view } = mount(async () => true);
    expect(door.handlers!.showTab!({ tab: 'settings' })).toEqual({ tab: 'settings' });
    expect(door.handlers!.showTab!({ tab: 'mon atelier' })).toEqual({ tab: 'page:atelier' });
    expect(openTab.mock.calls.map((c) => c[0])).toEqual(['settings', 'page:atelier']);
    expect(view.closeAll).toHaveBeenCalledTimes(2);
    expect(() => door.handlers!.showTab!({ tab: 'boutique' })).toThrow(/^NO_TAB: no page named "boutique"; pages: Mon atelier/);
  });

  it('her texts change only where given, and the answer waits for the write', async () => {
    const { studio } = mount(async () => true);
    await expect(door.handlers!.setBrand!({ tagline: 'Céramiste à Montpellier' })).resolves.toEqual({ changed: ['tagline'] });
    const change = studio.patchSite.mock.calls[0]![0] as (cur: { brand: Record<string, string> }) => { brand: Record<string, string> };
    expect(change({ brand: { name: 'Claire', tagline: 'x' } }).brand).toEqual({ name: 'Claire', tagline: 'Céramiste à Montpellier' });
    await expect(door.handlers!.setBrand!({})).rejects.toThrow(/^BAD_ARG/);
    mount(async () => false);
    await expect(door.handlers!.setBrand!({ email: 'a@b.c' })).rejects.toThrow(/^WRITE_FAILED/);
  });

  it('« crée une nouvelle scène dans le jardin »: the form opens with the room, the piece is hers to choose, and the orb says so', () => {
    const { view } = mount(async () => true);
    const out = door.handlers!.newScene!({ universe: 'Jardin' }) as { opened: boolean; pieceId: string | null; universe: string | null; say: string };
    expect(view.newScene).toHaveBeenCalledWith({ universe: 'Jardin' });
    expect(out).toMatchObject({ opened: true, pieceId: null, universe: 'Jardin' });
    expect(out.say).toBeTruthy();
    expect(out.say).not.toMatch(/^agent\./);
  });

  it('a piece named with its photo is chosen; one without a photo, or one she does not have, is left to her and said', () => {
    const { view } = mount(async () => true);
    const chosen = door.handlers!.newScene!({ piece: 'le vase bleu', universe: 'Jardin' }) as { pieceId: string | null; say: string };
    expect(view.newScene).toHaveBeenLastCalledWith({ pieceId: 'p1', universe: 'Jardin' });
    expect(chosen.say).toContain('Vase bleu');
    // « grand vase » has no photo: it cannot be staged, the form opens on the choice.
    expect(door.handlers!.newScene!({ piece: 'grand vase' })).toMatchObject({ pieceId: null });
    expect(view.newScene).toHaveBeenLastCalledWith({});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const missing = door.handlers!.newScene!({ piece: 'théière' }) as { pieceId: string | null; say: string };
    expect(missing.pieceId).toBeNull();
    expect(missing.say).toContain('théière');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('théière'), expect.stringMatching(/^NO_PIECE/));
    warn.mockRestore();
  });

  it('createScene for a piece she does not have is said to her (TO_PERSON), never left for a repair call to pick one', async () => {
    mount(async () => true);
    await expect(door.handlers!.createScene!({ pieceId: 'théière', universe: 'Jardin', placeDescription: 'un jardin' }))
      .rejects.toThrow(/^TO_PERSON: .*théière.*Vase bleu, Grand vase bleu/);
    // Two pieces fit: the names go back to the planner as before (it picks among what was said).
    await expect(door.handlers!.createScene!({ pieceId: 'bleu', universe: 'Jardin', placeDescription: 'un jardin' })).rejects.toThrow(/^AMBIGUOUS/);
  });

  it('an SDK build without onAgentActions is warned about, never a crash', () => {
    door.has = false;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => mount(async () => true)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no onAgentActions'));
    expect(door.handlers).toBeNull();
    warn.mockRestore();
  });
});
