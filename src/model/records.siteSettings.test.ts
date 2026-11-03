import { normalizeSiteSettings } from './records';

describe('site.json read back, the fields of doc 145 §10.21', () => {
  const read = (over: Record<string, unknown>, brand: Record<string, unknown> = {}) => normalizeSiteSettings({ brand: { name: 'A', ...brand }, ...over }, 'A');

  it('keeps the dark pages, the loading screen, the video level and the About photos she chose, nothing else', () => {
    const s = read({ videoLevel: 'sharp' }, { dark: 'auto', loader: { style: 'dots', speed: 'fast' }, aboutPhotos: ['C:/a.jpg', '', 'C:/b.jpg', 'C:/c.jpg', 4] });
    expect(s.brand.dark).toBe('auto');
    expect(s.brand.loader).toEqual({ style: 'dots', speed: 'fast' });
    expect(s.videoLevel).toBe('sharp');
    // Three at most, an empty frame kept as a frame, a number never a path.
    expect(s.brand.aboutPhotos).toEqual(['C:/a.jpg', '', 'C:/b.jpg']);
  });
  it('drops what it does not know: light video, always-light pages, no loading screen', () => {
    const s = read({ videoLevel: 'light' }, { dark: 'yes', loader: { style: 'spinner' }, aboutPhotos: 'C:/a.jpg' });
    expect(s.videoLevel).toBeUndefined();
    expect(s.brand.dark).toBeUndefined();
    expect(s.brand.loader).toBeUndefined();
    expect(s.brand.aboutPhotos).toBeUndefined();
  });
  it('keeps the count of clips made light although a heavier level was chosen', () => {
    const s = read({ lastExport: { at: '2026-11-02T20:00:00Z', files: 3, bytes: 10, imageBytes: 4, clipBytes: 6, lightOnly: 2 } });
    expect(s.lastExport?.lightOnly).toBe(2);
  });
});
