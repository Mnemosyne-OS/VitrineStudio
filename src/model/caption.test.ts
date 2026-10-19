import { captionLines, captionToSave, normalizeCaption, posFor, sizeLine } from './caption';
import { DEFAULT_CURRENCY } from './currency';
import { newPiece } from './records';
import type { PieceShow } from './showcase';

const piece = { ...newPiece('Vase cône', undefined, 'Grès brut, émail mat.'), price: 85 };
const show = { size: { l: 30, h: 42, w: 18 }, photos: [], show: { name: true, description: true, dimensions: true, weight: true, price: true, photos: true } } as PieceShow;

describe('caption', () => {
  it("writes the piece's own record, field by field, its name as the title", () => {
    const c = captionLines({ fields: ['name', 'size', 'price'], text: 'Pièce unique' }, piece, show, 'fr', DEFAULT_CURRENCY)!;
    expect(c.title).toBe('Vase cône');
    expect(c.lines[0]).toBe('30 × 42 × 18 cm');
    expect(c.lines[1]).toMatch(/85/);
    expect(c.lines[2]).toBe('Pièce unique');
    expect(c.place).toBe('br');
  });

  it('writes nothing when no chosen field has anything to say', () => {
    expect(captionLines({ fields: ['size', 'price'] }, newPiece('X', undefined, undefined), undefined, 'fr', DEFAULT_CURRENCY)).toBeNull();
    expect(captionLines(undefined, piece, show, 'fr', DEFAULT_CURRENCY)).toBeNull();
  });

  it('falls back on the free wording of the size, and keeps a long description short', () => {
    expect(sizeLine({ ...show, size: undefined, dimensions: 'environ 30 cm' }, 'fr')).toBe('environ 30 cm');
    const long = { ...piece, description: 'a'.repeat(400) };
    expect(captionLines({ fields: ['description'] }, long, show, 'fr', DEFAULT_CURRENCY)!.lines[0]!.length).toBeLessThanOrEqual(180);
  });

  it('places the words by hand per screen, a screen never set taking the larger one', () => {
    const pos = { desktop: { x: 70, y: 80 }, mobile: { x: 50, y: 85 } };
    expect(posFor(pos, 'tablet')).toEqual({ x: 70, y: 80 });
    expect(posFor(pos, 'mobile')).toEqual({ x: 50, y: 85 });
    expect(posFor(undefined, 'desktop')).toBeUndefined();
    expect(normalizeCaption({ fields: ['name'], pos: { desktop: { x: 70, y: 80 }, tablet: { x: 200, y: 1 } } })?.pos).toEqual({ desktop: { x: 70, y: 80 } });
  });

  it('reads back only what it knows', () => {
    expect(normalizeCaption({ fields: ['name', 'bogus', 'name'], place: 'xx', text: '  hi ' })).toEqual({ fields: ['name'], text: 'hi' });
    expect(normalizeCaption({ fields: [] })).toBeUndefined();
  });
});

describe('the words a scene keeps', () => {
  it('leaves the defaults out, trims her line, and keeps nothing when they say nothing', () => {
    expect(captionToSave({ fields: ['name'], text: '  Fait main  ', place: 'br', anim: 'rise', pos: {} })).toEqual({ fields: ['name'], text: 'Fait main' });
    expect(captionToSave({ fields: [], place: 'tr', anim: 'fade', pos: { desktop: { x: 10, y: 20 } } })).toBeNull();
    expect(captionToSave({ fields: ['size'], place: 'tr', anim: 'fade' })).toEqual({ fields: ['size'], place: 'tr', anim: 'fade' });
  });
});
