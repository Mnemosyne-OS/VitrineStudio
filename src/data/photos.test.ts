import { isUsablePhoto, nameFromFile } from './photos';

describe('dropped photos', () => {
  it('turns a file name into a first piece name', () => {
    expect(nameFromFile('vase-totem_02.jpg')).toBe('Vase totem 02');
    expect(nameFromFile('.jpg')).toBe('');
  });
  it('takes only the picture types the host accepts as a reference', () => {
    expect(isUsablePhoto({ type: 'image/webp' })).toBe(true);
    expect(isUsablePhoto({ type: 'image/heic' })).toBe(false);
    expect(isUsablePhoto({ type: 'application/pdf' })).toBe(false);
  });
});
