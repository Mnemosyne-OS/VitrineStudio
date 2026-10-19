import { act, fireEvent, render, screen } from '@testing-library/react';
import { Tooltips } from './Tooltips';

describe('the hint bubble', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows a title in its own bubble after a short rest, and the system box never', () => {
    render(<><button title="Prix">€</button><Tooltips /></>);
    const button = screen.getByRole('button');
    fireEvent.pointerOver(button);
    expect(button.hasAttribute('title')).toBe(false);
    expect(button.getAttribute('data-tip')).toBe('Prix');
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.getByRole('tooltip').textContent).toBe('Prix');
  });

  it('shows nothing for a pointer that only passes, and leaves with the pointer', () => {
    render(<><button data-tip="Nom">N</button><span>away</span><Tooltips /></>);
    fireEvent.pointerOver(screen.getByRole('button'));
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.pointerOut(screen.getByRole('button'), { relatedTarget: screen.getByText('away') });
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('never takes a frame\'s title, which names it for screen readers', () => {
    render(<><iframe title="Aperçu" /><Tooltips /></>);
    const frame = document.querySelector('iframe')!;
    fireEvent.pointerOver(frame);
    expect(frame.getAttribute('title')).toBe('Aperçu');
  });
});
