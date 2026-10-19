// The workbench forms open filled from the scene and send back only what she chose.
import { fireEvent, render, screen } from '@testing-library/react';
import { ClipForm, RedoForm } from './LightboxForms';
import { profileById } from '../model/profiles';
import type { Scene } from '../model/types';

vi.mock('../data/host', () => ({ readImage: vi.fn(() => new Promise(() => {})), readMedia: vi.fn(), sdk: {} }));

const base: Scene = {
  schema: 1, id: 's1', pieceId: 'p1', universe: 'Jardin', variant: 'B', placeDescription: 'Une terrasse au soleil', animation: 'a plant of my own', aspectRatio: '16:9',
  images: { place: 'C:/a.png', piece: 'C:/b.png', alive: 'C:/c.png' }, beatNotes: { alive: 'moins de feuilles' }, clipStyle: { camera: 'pan', light: 'sun', note: 'lent' },
  validated: false, createdAt: '', updatedAt: '',
};
const profile = profileById('ceramics-plants');

describe('the workbench forms', () => {
  it('RedoForm opens filled from the scene: the note, and an animation of her own in its field', () => {
    render(<RedoForm scene={base} beat="alive" profile={profile} busy={false} each={null} onRemake={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByDisplayValue('moins de feuilles')).toBeInTheDocument();
    expect(screen.getByDisplayValue('a plant of my own')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Something else|Autre chose|Otra cosa/ })).toHaveClass('chosen');
  });

  it('RedoForm on the place opens filled with the place description, and sends it back', () => {
    const onRemake = vi.fn();
    render(<RedoForm scene={{ ...base, beatNotes: {} }} beat="place" profile={profile} busy={false} each={null} onRemake={onRemake} onCancel={vi.fn()} />);
    expect(screen.getByDisplayValue('Une terrasse au soleil')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Refaire|Redo|Rehacer/ }));
    expect(onRemake).toHaveBeenCalledWith({ note: '', placeDescription: 'Une terrasse au soleil' });
  });

  it('ClipForm opens on the clip style the scene keeps, and sends only what differs from the defaults', () => {
    const onMake = vi.fn();
    render(<ClipForm scene={base} busy={false} onMake={onMake} onCancel={vi.fn()} />);
    expect(screen.getByDisplayValue('lent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gentle pan|Panoramique|Paneo/ })).toHaveClass('chosen');
    fireEvent.click(screen.getByRole('button', { name: /Make the video|Faire la vidéo|Hacer el v/ }));
    expect(onMake).toHaveBeenCalledWith({ camera: 'pan', light: 'sun', note: 'lent' });
  });
});
