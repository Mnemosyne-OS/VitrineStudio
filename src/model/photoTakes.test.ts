import { backToPhoto, PHOTO_TAKES_MAX, withNewPhoto, withoutPhotoTake } from './photoTakes';
import { normalizePiece } from './records';
import type { Piece } from './types';

const piece = (over: Partial<Piece> = {}): Piece => ({ schema: 1, id: 'p', name: 'P', kind: 'unique', tags: [], photoPath: 'a.jpg', ...over });

describe('a photo and its versions', () => {
  it('shows the new photo and keeps the one before first in the versions', () => {
    expect(withNewPhoto(piece({ photoTakes: ['old.jpg'] }), 'b.png', 'now')).toMatchObject({ photoPath: 'b.png', photoTakes: ['a.jpg', 'old.jpg'] });
  });

  it('brings a version back and never lists the shown photo twice', () => {
    const p = withNewPhoto(piece(), 'b.png', 'now');
    expect(backToPhoto(p, 'a.jpg', 'now')).toMatchObject({ photoPath: 'a.jpg', photoTakes: ['b.png'] });
    expect(backToPhoto(p, 'nope.jpg', 'now')).toBe(p);
  });

  it('keeps at most a dozen versions, and takes one off without touching the photo shown', () => {
    const many = Array.from({ length: 20 }, (_, i) => `${i}.jpg`);
    expect(withNewPhoto(piece({ photoTakes: many }), 'new.png', 'now').photoTakes).toHaveLength(PHOTO_TAKES_MAX);
    const off = withoutPhotoTake(piece({ photoTakes: ['x.jpg'] }), 'x.jpg', 'now');
    expect(off.photoPath).toBe('a.jpg');
    expect(off.photoTakes).toBeUndefined();
  });

  it('reads the versions and the cut-out back', () => {
    expect(normalizePiece({ id: 'p', name: 'P', photoTakes: ['a', 3, ''], cutout: { from: 'a', path: 'b' } })).toMatchObject({ photoTakes: ['a'], cutout: { from: 'a', path: 'b' } });
  });
});
describe('taking one version off among several', () => {
  it('keeps the photo shown and the other versions in their order', () => {
    const off = withoutPhotoTake(piece({ photoTakes: ['x.jpg', 'y.jpg', 'z.jpg'] }), 'y.jpg', 'now');
    expect(off.photoPath).toBe('a.jpg');
    expect(off.photoTakes).toEqual(['x.jpg', 'z.jpg']);
  });
  it('drops a cut-out that does not say which photo it came from', () => {
    expect(normalizePiece({ id: 'p', name: 'P', cutout: { path: 'b' } })?.cutout).toBeUndefined();
  });
});
