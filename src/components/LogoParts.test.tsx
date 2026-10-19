import { act, fireEvent, render, screen } from '@testing-library/react';
import { LogoParts } from './LogoParts';
import { LogoPanel } from './LogoPanel';
import { DEFAULT_IDENTITY } from '../site/logo';
import { EMPTY_BRAND } from '../site/buildSite';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10"><circle cx="5" cy="5" r="4"/><circle cx="15" cy="5" r="4"/><circle cx="25" cy="5" r="4"/></svg>';

/** The preview's stage as the panel renders it: one `.lp` group per element. */
function stage(): HTMLDivElement {
  const el = document.createElement('div');
  el.innerHTML = '<svg><g class="lp"><circle/></g><g class="lp"><circle/></g><g class="lp"><circle/></g></svg>';
  document.body.appendChild(el);
  return el;
}
const sel = (el: HTMLElement) => Array.from(el.querySelectorAll('.lp')).map((g) => g.classList.contains('sel'));

describe('choosing the elements of the logo on the preview', () => {
  it('a touch takes one element alone; Shift adds one; a plain touch takes one alone again', () => {
    const el = stage();
    render(<LogoParts svg={svg} parts={undefined} stage={el} onPick={() => {}} onChange={() => {}} />);
    const groups = el.querySelectorAll('.lp');
    act(() => { groups[0]!.firstElementChild!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(sel(el)).toEqual([true, false, false]);
    act(() => { groups[1]!.firstElementChild!.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); });
    expect(sel(el)).toEqual([true, true, false]);
    act(() => { groups[2]!.firstElementChild!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(sel(el)).toEqual([false, false, true]);
  });

  it('writes the start once, when the slider is let go, not at every step', () => {
    const el = stage();
    const onChange = vi.fn();
    render(<LogoParts svg={svg} parts={undefined} stage={el} onPick={() => {}} onChange={onChange} />);
    act(() => { el.querySelectorAll('.lp')[1]!.firstElementChild!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const range = screen.getByRole('slider');
    fireEvent.change(range, { target: { value: '1.5' } });
    fireEvent.change(range, { target: { value: '2.5' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(range);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0][1]).toEqual({ anim: 'fade', delay: 2.5 });
  });
});

describe('replaying the logo', () => {
  beforeAll(() => {
    // jsdom has no layout: the stage is never measured.
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} disconnect() {} };
  });

  it('shows the whole logo, the choice stepping aside until the next touch', () => {
    const identity = { ...DEFAULT_IDENTITY, svg, anim: 'parts' as const, mode: 'logo' as const };
    const { container } = render(<LogoPanel identity={identity} brand={{ ...EMPTY_BRAND, name: 'Atelier' }} onChange={() => {}} />);
    const stageEl = () => container.querySelector('.logo-stage')!;
    act(() => { stageEl().querySelector('.lp')!.firstElementChild!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(stageEl().classList.contains('whole')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /^(rejouer|replay|repetir)$/i }));
    expect(stageEl().classList.contains('whole')).toBe(true);
    act(() => { stageEl().querySelector('.lp')!.firstElementChild!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(stageEl().classList.contains('whole')).toBe(false);
  });
});
