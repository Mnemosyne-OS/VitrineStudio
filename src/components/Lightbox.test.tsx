// The scene full screen: one key listener for its whole life, reading today's state.
import { act, fireEvent, render } from '@testing-library/react';
import { Lightbox, type SceneTools } from './Lightbox';
import { profileById } from '../model/profiles';
import { DEFAULT_CURRENCY } from '../model/currency';
import type { Scene } from '../model/types';
import { LAYERS_MADE } from '../model/sceneLayers';

vi.mock('../data/host', () => ({
  readImage: vi.fn((p: string) => Promise.resolve(`data:image/png;base64,${Buffer.from(p).toString('base64')}`)),
  readMedia: vi.fn(() => new Promise(() => {})),
  sdk: {},
}));

const scene: Scene = {
  schema: 1, id: 's1', pieceId: 'p1', universe: 'Jardin', variant: 'B', placeDescription: '', animation: '', aspectRatio: '16:9',
  images: { place: 'C:/a.png', piece: 'C:/b.png', alive: 'C:/c.png' }, validated: false, createdAt: '', updatedAt: '',
};
const tools = (): SceneTools => ({
  piece: undefined, show: undefined, currency: DEFAULT_CURRENCY, work: {}, advanced: false, costs: null, imageModel: 'x',
  onMakeAll: vi.fn(), onRemake: vi.fn(), onValidate: vi.fn(), onMakeClip: vi.fn(), onCut: vi.fn(), onPrompt: vi.fn(), onRemove: vi.fn(),
  onCaption: vi.fn(), onChooseTake: vi.fn(), onDeleteTake: vi.fn(), onMotion: vi.fn(), onEvolution: vi.fn(),
});

describe('the scene full screen', () => {
  it('adds the keydown listener once, and the keys read today s onClose and move', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const onClose1 = vi.fn(), onClose2 = vi.fn();
    const { rerender, container } = render(<Lightbox scene={scene} profile={profileById('ceramics-plants')} start="place" onClose={onClose1} tools={tools()} />);
    await act(async () => { await Promise.resolve(); });
    rerender(<Lightbox scene={scene} profile={profileById('ceramics-plants')} start="place" onClose={onClose2} tools={tools()} />);
    rerender(<Lightbox scene={{ ...scene, updatedAt: '2' }} profile={profileById('ceramics-plants')} start="place" onClose={onClose2} tools={tools()} />);
    const keydowns = add.mock.calls.filter((c) => c[0] === 'keydown');
    expect(keydowns).toHaveLength(1);
    // The arrow moves to the next picture; Escape calls the LATEST onClose, not the first.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(container.querySelector('[role="tab"][aria-selected="true"] .strip-label')?.textContent).toMatch(/creation|création|creación|pièce|piece/i);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose1).not.toHaveBeenCalled();
    expect(onClose2).toHaveBeenCalledTimes(1);
    add.mockRestore();
  });
});

describe('a living scene full screen (Tony, 2026-10-12: the cut showed between the beats)', () => {
  const box = (path: string) => ({ path, x: 40, y: 40, w: 20, h: 30 });
  const layers = {
    from: { place: 'C:/a.png', piece: 'C:/b.png', alive: 'C:/c.png' },
    pot: box('C:/l/pot.png'), potAlive: box('C:/l/pa.png'), room: 'C:/l/room.webp', pivot: { x: 50, y: 40 }, made: LAYERS_MADE, madeAt: '2026-10-12T00:00:00Z',
  } as unknown as NonNullable<Scene['layers']>;

  it('opens on its life, not on its first picture', () => {
    const { container } = render(<Lightbox scene={{ ...scene, motion: 'living', layers }} profile={profileById('ceramics-plants')} start="place" onClose={vi.fn()} tools={tools()} />);
    expect(container.querySelector('.living-stage.on')).not.toBeNull();
  });

  it('a scene shown as pictures still steps through them', () => {
    const { container } = render(<Lightbox scene={{ ...scene, motion: 'images', layers }} profile={profileById('ceramics-plants')} start="place" onClose={vi.fn()} tools={tools()} />);
    expect(container.querySelector('.living-stage.on')).toBeNull();
  });
});
