import { DEFAULT_IDENTITY, withIdentityChange } from './logo';

describe('a logo gesture laid on the identity as it is now', () => {
  it('keeps a change made in between, and removes what the gesture removed', () => {
    const before = { ...DEFAULT_IDENTITY, height: 80 };
    const now = { ...before, place: 'right' as const };
    // The gesture was a size preset made from `before`: it clears the height.
    const after = { ...before };
    delete (after as { height?: number }).height;
    const next = withIdentityChange(now, before, after);
    expect(next.place).toBe('right');
    expect(next.height).toBeUndefined();
    expect(withIdentityChange(now, before, { ...before, height: 120 })).toMatchObject({ place: 'right', height: 120 });
  });
});
