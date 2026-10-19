// What can be done with a version: delete on a second press, nothing while the scene is made, the pick follows a put-back.
import { fireEvent, render, screen } from '@testing-library/react';
import { EvolutionView } from './EvolutionView';
import { profileById } from '../model/profiles';
import { putTakeBack } from '../model/takes';
import { DOUBLE_CLICK_MS } from '../hooks/useArmed';
import type { Piece, Scene } from '../model/types';

vi.mock('../data/host', () => ({ readImage: vi.fn(() => new Promise(() => {})) }));

const piece: Piece = { schema: 1, id: 'p1', name: 'Vase', kind: 'unique', tags: [], photoPath: 'C:/ph/v.jpg' };
const KEPT = 'C:/g/gen-1791691931441-d.png';
const scene: Scene = {
  schema: 1, id: 's1', pieceId: 'p1', universe: 'Jardin', variant: 'Bohème', placeDescription: '', animation: '', aspectRatio: '16:9',
  images: { place: 'C:/g/gen-1791691894813-a.png', alive: 'C:/g/gen-1791780831854-c.png' }, takes: { alive: [KEPT] },
  validated: false, createdAt: '', updatedAt: '',
};
const kept = () => screen.getAllByRole('button').find((b) => /gardée|Kept/.test(b.getAttribute('aria-label') ?? ''))!;
const useBtn = () => screen.queryByRole('button', { name: /Reprendre|Use this/ });
const delBtn = () => screen.getByRole('button', { name: /Supprimer cette|Delete this|Cliquez|Click again/ });

describe('a piece over time, on screen', () => {
  it('deletes on the SECOND press, past the double-click window', () => {
    vi.useFakeTimers();
    const actions = { onOpenScene: vi.fn(), onChooseTake: vi.fn(), onDeleteTake: vi.fn() };
    render(<EvolutionView piece={piece} scenes={[scene]} profileOf={() => profileById('ceramics-plants')} busy={() => false} onClose={vi.fn()} actions={actions} />);
    fireEvent.click(kept());
    fireEvent.click(delBtn());
    vi.advanceTimersByTime(DOUBLE_CLICK_MS + 50);
    fireEvent.click(delBtn());
    expect(actions.onDeleteTake).toHaveBeenCalledWith(scene, 'alive', KEPT);
    vi.useRealTimers();
  });

  it('while the scene is being made, delete is disabled too', () => {
    const actions = { onOpenScene: vi.fn(), onChooseTake: vi.fn(), onDeleteTake: vi.fn() };
    render(<EvolutionView piece={piece} scenes={[scene]} profileOf={() => profileById('ceramics-plants')} busy={() => true} onClose={vi.fn()} actions={actions} />);
    fireEvent.click(kept());
    expect(screen.getByRole('button', { name: /Supprimer cette|Delete this/ })).toBeDisabled();
  });

  it('after a put-back, the picked version is the one in use: put back / delete are no longer offered on it', () => {
    const actions = { onOpenScene: vi.fn(), onChooseTake: vi.fn(), onDeleteTake: vi.fn() };
    const props = { piece, profileOf: () => profileById('ceramics-plants'), busy: () => false, onClose: vi.fn(), actions };
    const { rerender } = render(<EvolutionView {...props} scenes={[scene]} />);
    fireEvent.click(kept());
    expect(useBtn()).not.toBeNull();
    // The store answers: the kept one is now in use, the old one kept.
    rerender(<EvolutionView {...props} scenes={[putTakeBack(scene, 'alive', KEPT)]} />);
    expect(useBtn()).toBeNull();
    // The pick is still shown (its label and the open button in the side panel), only the two actions are gone.
    expect(screen.getAllByRole('button', { name: /Ouvrir|Open/ }).length).toBe(2);
    expect(screen.queryByRole('button', { name: /Supprimer cette|Delete this/ })).toBeNull();
  });
});
