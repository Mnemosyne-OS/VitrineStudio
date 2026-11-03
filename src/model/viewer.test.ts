import { normalizeViewer } from './viewer';

describe('the large view read back', () => {
  it('keeps a known loupe and frame, and anything else is none: never a loupe she did not choose', () => {
    expect(normalizeViewer({ loupe: 'square', frame: 'round' })).toEqual({ loupe: 'square', frame: 'round' });
    expect(normalizeViewer({ loupe: 'big', frame: 3 })).toEqual({ loupe: 'none', frame: 'none' });
    expect(normalizeViewer(undefined)).toEqual({ loupe: 'none', frame: 'none' });
  });
  it('keeps the mosaic, the strip and the parallax she chose, and the grid as their absence', () => {
    expect(normalizeViewer({ layout: 'mosaic', parallax: true })).toEqual({ loupe: 'none', frame: 'none', layout: 'mosaic', parallax: true });
    expect(normalizeViewer({ layout: 'strip' }).layout).toBe('strip');
    expect(normalizeViewer({ layout: 'grid', parallax: 'yes' })).toEqual({ loupe: 'none', frame: 'none' });
  });
});
