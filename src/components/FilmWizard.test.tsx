import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FilmWizard } from './FilmWizard';
import { profileById } from '../model/profiles';
import type { Piece } from '../model/types';

vi.mock('../data/host', () => ({ pickImage: vi.fn(), readImage: vi.fn(() => new Promise(() => {})) }));

const pieces = [
  { id: 'p1', name: 'Vase blanc', photoPath: 'C:/p/vase.jpg' },
  { id: 'p2', name: 'Sans photo' },
] as unknown as Piece[];

function open(onCreate = vi.fn(async () => {})) {
  render(<FilmWizard pieces={pieces} profile={profileById('ceramics-plants')} aspectRatio="16:9" imageCount={5} imageCost="$0.90" onClose={vi.fn()} onCreate={onCreate} />);
  return onCreate;
}

describe('a new film, step by step', () => {
  it('offers only the creations with a photo, and goes nowhere before one is chosen', () => {
    open();
    expect(screen.queryByText('Sans photo')).toBeNull();
    const next = screen.getAllByRole('button').find((b) => b.className.includes('primary'))!;
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByText('Vase blanc'));
    expect(next).not.toBeDisabled();
  });

  it('creates the film with what was chosen, in the shape chosen', async () => {
    const onCreate = open();
    fireEvent.click(screen.getByText('Vase blanc'));
    const next = () => fireEvent.click(screen.getAllByRole('button').find((b) => b.className.includes('primary'))!);
    next(); next(); next();
    const tall = screen.getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'false' && b.className.includes('chip-tile'))!;
    fireEvent.click(tall);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Été  ' } });
    // « Create only »: the first footer button that is not the paid one.
    const footer = document.querySelector('.wizard-foot')!;
    fireEvent.click(footer.querySelectorAll('button')[1]!);
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const [start, makeNow] = onCreate.mock.calls[0]! as unknown as [Record<string, unknown>, boolean];
    expect(makeNow).toBe(false);
    expect(start).toMatchObject({ pieceId: 'p1', aspectRatio: '9:16', name: 'Été' });
    expect(start.animation).toBeTruthy();
  });

  it('takes her own words for how it comes alive', async () => {
    const onCreate = open();
    fireEvent.click(screen.getByText('Vase blanc'));
    const next = () => fireEvent.click(screen.getAllByRole('button').find((b) => b.className.includes('primary'))!);
    next(); next();
    fireEvent.click(screen.getAllByRole('button').filter((b) => b.className.includes('chip-tile')).at(-1)!);
    const primary = () => screen.getAllByRole('button').find((b) => b.className.includes('primary'))!;
    // Chosen but not written yet: no next step.
    expect(primary()).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' un bouquet de mimosa ' } });
    next();
    fireEvent.click(document.querySelector('.wizard-foot')!.querySelectorAll('button')[1]!);
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect((onCreate.mock.calls[0]! as unknown as [Record<string, unknown>])[0].animation).toBe('un bouquet de mimosa');
  });

  it('asks a second press before making the pictures, and says how many and what they cost', async () => {
    const onCreate = open();
    fireEvent.click(screen.getByText('Vase blanc'));
    const next = () => fireEvent.click(screen.getAllByRole('button').find((b) => b.className.includes('primary'))!);
    next(); next(); next();
    const paid = document.querySelector('.wizard-foot .primary') as HTMLButtonElement;
    expect(paid.textContent).toContain('5');
    expect(paid.textContent).toContain('$0.90');
    fireEvent.click(paid);
    expect(onCreate).not.toHaveBeenCalled();
  });
});
