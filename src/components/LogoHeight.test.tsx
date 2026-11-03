import { fireEvent, render, screen } from '@testing-library/react';
import { LogoPanel } from './LogoPanel';
import { LogoOnPage } from './LogoOnPage';
import { DEFAULT_IDENTITY, type Identity } from '../site/logo';
import { EMPTY_BRAND } from '../site/buildSite';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
// The site of the field report: a 96 px logo, saved while "Large" was still a preset.
const site: Identity = { ...DEFAULT_IDENTITY, svg, mode: 'logo', size: 'l', height: 96 };

describe('the logo\'s height, typed in px', () => {
  // jsdom has no ResizeObserver: the page preview only uses it to fit the card.
  beforeAll(() => { (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} disconnect() {} }; });

  it('has no Small / Medium / Large preset left to wipe a chosen height', () => {
    render(<LogoPanel identity={site} brand={EMPTY_BRAND} onChange={() => {}} />);
    for (const name of [/^large$/i, /^grand$/i, /^medium$/i, /^moyen$/i, /^small$/i, /^petit$/i]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('keeps the number typed in the Display card, brought inside 16-200 px', () => {
    const onChange = vi.fn();
    render(<LogoPanel identity={site} brand={EMPTY_BRAND} onChange={onChange} />);
    // The Display card's field and the one beside the slider show the same height.
    const fields = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    expect(fields.length).toBe(2);
    expect(fields.map((f) => f.value)).toEqual(['96', '96']);
    const card = fields[fields.length - 1]!;
    fireEvent.change(card, { target: { value: '150' } });
    fireEvent.blur(card);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ height: 150 }));
    fireEvent.change(card, { target: { value: '999' } });
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ height: 200 }));
  });

  it('moves the slider while typing beside it, and saves on Enter', () => {
    const onChange = vi.fn();
    render(<LogoOnPage identity={site} name="A" src={null} brand={EMPTY_BRAND} replay={0} onChange={onChange} />);
    const field = screen.getByRole('spinbutton') as HTMLInputElement;
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.value).toBe('96');
    fireEvent.change(field, { target: { value: '120' } });
    expect(slider.value).toBe('120');
    // The page's own markup follows the draft at once.
    expect(document.querySelector('.lop-brand .brand-in')?.getAttribute('style')).toBe('--logo-h:120px');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ height: 120 }));
  });

  it('gives an old site without a height its preset in px', () => {
    const old = { ...site } as Identity;
    delete old.height;
    render(<LogoOnPage identity={old} name="A" src={null} brand={EMPTY_BRAND} replay={0} onChange={() => {}} />);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('64');
  });
});
