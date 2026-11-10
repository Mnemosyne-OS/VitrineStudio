import { fireEvent, render, screen } from '@testing-library/react';
import { PageLookBar } from './PageLookBar';
import { MenuSocials } from './MenuSocials';
import { BALANCED_LOOK } from '../model/pageLook';

describe('the layout bar of a page of words and one picture', () => {
  it('lights no tile on a page of before; the first tile gives it the balanced look with its arrangement', () => {
    const onChange = vi.fn();
    render(<PageLookBar layout="right" look={undefined} onChange={onChange} />);
    expect(document.querySelectorAll('.look-tile.on')).toHaveLength(0);
    expect(screen.queryByText('Margins (computer)')).toBeNull();
    fireEvent.click(screen.getByText('Large picture').closest('button')!);
    expect(onChange).toHaveBeenCalledWith('right', { ...BALANCED_LOOK, split: 'twothirds' });
  });

  it('keeps her margins when another tile is clicked, and goes back to the layout of before', () => {
    const onChange = vi.fn();
    const look = { ...BALANCED_LOOK, margin: 'l' as const };
    render(<PageLookBar layout="right" look={look} onChange={onChange} />);
    fireEvent.click(screen.getByText('Picture, then text').closest('button')!);
    expect(onChange).toHaveBeenLastCalledWith('left', { ...look, split: 'half' });
    fireEvent.click(screen.getByText('Back to the layout of before'));
    expect(onChange).toHaveBeenLastCalledWith('right', undefined);
  });

  it('offers no shape and no height for a picture above or below the words', () => {
    render(<PageLookBar layout="top" look={BALANCED_LOOK} onChange={vi.fn()} />);
    expect(screen.queryByText('Picture shape')).toBeNull();
    expect(screen.queryByText('Height')).toBeNull();
    expect(screen.getByText('Margins (computer)')).toBeTruthy();
  });
});

describe('the card of her networks in the menu', () => {
  const look = { name: 'A', tagline: '', introLine: '', ink: '#000000', paper: '#ffffff', accent: '#888888', dark: 'never' as const, loader: null, menuSocials: false };
  const brand = { name: 'A', tagline: '', about: '', email: '', instagram: '', introLine: '', portraitCaption: '', contactNote: '', formspree: '', accent: '#888888', ink: '#000000', paper: '#ffffff' };

  it('says where networks are set when she has none, and offers nothing to place', () => {
    render(<MenuSocials look={look} brand={brand} onTry={vi.fn()} />);
    expect(screen.getByText('No network yet: add them in Contact.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('tries the icons in the menu with her own icons drawn', () => {
    const onTry = vi.fn();
    render(<MenuSocials look={look} brand={{ ...brand, socials: { instagram: 'atelier' } }} onTry={onTry} />);
    const on = screen.getByRole('button', { name: 'In the menu and on Contact' });
    expect(on.querySelectorAll('.social-ico')).toHaveLength(1);
    fireEvent.click(on);
    expect(onTry).toHaveBeenCalledWith({ ...look, menuSocials: true });
  });
});
