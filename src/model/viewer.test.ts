import { normalizeViewer } from './viewer';

describe('the large view read back', () => {
  it('keeps a known loupe and frame, and anything else is none: never a loupe she did not choose', () => {
    expect(normalizeViewer({ loupe: 'square', frame: 'round' })).toEqual({ loupe: 'square', frame: 'round' });
    expect(normalizeViewer({ loupe: 'big', frame: 3 })).toEqual({ loupe: 'none', frame: 'none' });
    expect(normalizeViewer(undefined)).toEqual({ loupe: 'none', frame: 'none' });
  });
});
