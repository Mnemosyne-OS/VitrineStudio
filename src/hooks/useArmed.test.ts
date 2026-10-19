import { act, renderHook } from '@testing-library/react';
import { ARMED_MS, DOUBLE_CLICK_MS, useArmed } from './useArmed';

describe('a paid action asks a second press', () => {
  afterEach(() => vi.useRealTimers());

  it('runs on the second press only, and a first press elsewhere arms that one instead', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const { result } = renderHook(() => useArmed());
    act(() => result.current.confirm('clip', run));
    expect(run).not.toHaveBeenCalled();
    expect(result.current.armed).toBe('clip');
    act(() => result.current.confirm('remake', run));
    expect(result.current.armed).toBe('remake');
    // A double click is one gesture: its second click does not confirm.
    act(() => result.current.confirm('remake', run));
    expect(run).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(DOUBLE_CLICK_MS); });
    act(() => result.current.confirm('remake', run));
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.current.armed).toBeNull();
  });

  it('disarms itself after a few seconds', () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const { result } = renderHook(() => useArmed());
    act(() => result.current.confirm('clip', run));
    act(() => { vi.advanceTimersByTime(ARMED_MS + 1); });
    act(() => result.current.confirm('clip', run));
    expect(run).not.toHaveBeenCalled();
  });
});
