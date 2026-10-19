import { render, screen } from '@testing-library/react';
import { PROFILES } from '../model/profiles';
import type { Piece } from '../model/types';
import { SceneWizard } from './SceneWizard';

const PIECES = [
  { id: 'p1', name: 'Vase bleu', kind: 'unique', tags: [], photoPath: 'vase.png' },
  { id: 'p2', name: 'Grand vase bleu', kind: 'unique', tags: [] },
] as unknown as Piece[];
const PROFILE = PROFILES.find((p) => p.placeIdeas.some((i) => i.id === 'garden'))!;
const GARDEN = PROFILE.placeIdeas.find((i) => i.id === 'garden')!;

function open(initial?: { pieceId?: string; universe?: string }) {
  return render(<SceneWizard pieces={PIECES} profile={PROFILE} aspectRatio="16:9" initial={initial}
    onClose={vi.fn()} onCreate={vi.fn()} onAddPieces={vi.fn()} onPickPiece={vi.fn()} uploads={[]} busyUpload={false}
    onSavePhoto={vi.fn()} onPickPhoto={vi.fn()} />);
}

/** The piece step shows the pieces to choose; the place step shows the room's name field. */
const onPlaceStep = () => !!document.querySelector('.row.names input');

describe('the new-scene wizard opened by an agent', () => {
  it('a room said (« Jardin ») is the scene\'s room and, being one the profile knows, fills the place; the piece is chosen first', () => {
    const { unmount } = open({ universe: 'jardin' });
    expect(onPlaceStep()).toBe(false);
    expect(screen.getByText('Vase bleu')).toBeTruthy();
    unmount();
    // On the place step, what was said is there.
    open({ universe: 'jardin', pieceId: 'p1' });
    expect(onPlaceStep()).toBe(true);
    expect((document.querySelector('.row.names input') as HTMLInputElement).value).toBe('jardin');
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe(GARDEN.prompt);
  });

  it('« dans le jardin »: the article does not hide the room (the fourth try of 2026-10-13)', () => {
    open({ universe: 'le jardin', pieceId: 'p1' });
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe(GARDEN.prompt);
  });

  it('a room nobody listed is kept as said, its place left to describe; a piece without a photo is not taken', () => {
    open({ universe: 'Véranda', pieceId: 'p2' });
    expect(onPlaceStep()).toBe(false);
  });

  it('a piece with its photo opens on the place; a room nobody listed leaves the description empty', () => {
    open({ universe: 'Véranda', pieceId: 'p1' });
    expect(onPlaceStep()).toBe(true);
    expect((document.querySelector('.row.names input') as HTMLInputElement).value).toBe('Véranda');
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe('');
  });

  it('opened by the button, nothing is filled', () => {
    open();
    expect(onPlaceStep()).toBe(false);
  });
});
