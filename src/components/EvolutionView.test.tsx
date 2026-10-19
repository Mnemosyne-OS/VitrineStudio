import { fireEvent, render, screen } from '@testing-library/react';
import { EvolutionView } from './EvolutionView';
import { profileById } from '../model/profiles';
import type { Piece, Scene } from '../model/types';

vi.mock('../data/host', () => ({ readImage: vi.fn(() => new Promise(() => {})) }));

const piece: Piece = { schema: 1, id: 'p1', name: 'Vase', kind: 'unique', tags: [], photoPath: 'C:/ph/v.jpg' };
const scene: Scene = {
  schema: 1, id: 's1', pieceId: 'p1', universe: 'Jardin', variant: 'Bohème', placeDescription: '', animation: '', aspectRatio: '16:9',
  images: { place: 'C:/g/gen-1791691894813-a.png', alive: 'C:/g/gen-1791780831854-c.png' }, takes: { alive: ['C:/g/gen-1791691931441-d.png'] },
  validated: false, createdAt: '', updatedAt: '',
};

function view(busy = false) {
  const actions = { onOpenScene: vi.fn(), onChooseTake: vi.fn(), onDeleteTake: vi.fn() };
  render(<EvolutionView piece={piece} scenes={[scene, { ...scene, id: 's2', pieceId: 'other', variant: 'Autre' }]} profileOf={() => profileById('ceramics-plants')} busy={() => busy} onClose={vi.fn()} actions={actions} />);
  return actions;
}
const kept = () => screen.getAllByRole('button').find((b) => /gardée|Kept/.test(b.getAttribute('aria-label') ?? ''))!;

describe('a piece over time, on screen', () => {
  it('shows only this piece’s scenes', () => {
    view();
    expect(screen.getByText('Jardin · Bohème')).toBeInTheDocument();
    expect(screen.queryByText('Jardin · Autre')).toBeNull();
  });

  it('puts a kept version back, and deletes one only on a second press', () => {
    const a = view();
    fireEvent.click(kept());
    fireEvent.click(screen.getByRole('button', { name: /Reprendre|Use this/ }));
    expect(a.onChooseTake).toHaveBeenCalledWith(scene, 'alive', 'C:/g/gen-1791691931441-d.png');
    const del = screen.getByRole('button', { name: /Supprimer cette|Delete this/ });
    fireEvent.click(del);
    expect(a.onDeleteTake).not.toHaveBeenCalled();
  });

  it('offers neither to put back nor to delete the version in use, and nothing while the scene is being made', () => {
    view(true);
    const current = screen.getAllByRole('button').find((b) => b.classList.contains('current') && /vivant|living|vivo/i.test(b.getAttribute('aria-label') ?? ''))!;
    fireEvent.click(current);
    expect(screen.queryByRole('button', { name: /Reprendre|Use this/ })).toBeNull();
    fireEvent.click(kept());
    expect(screen.getByRole('button', { name: /Reprendre|Use this/ })).toBeDisabled();
  });
});
