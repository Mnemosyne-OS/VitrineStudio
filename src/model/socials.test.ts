import { normalizeSocials, socialHref, socialLinks } from './socials';

describe('her social networks', () => {
  it('makes the link from her name on the network', () => {
    expect(socialHref('instagram', '@atelier.rosalie')).toBe('https://instagram.com/atelier.rosalie');
    expect(socialHref('tiktok', 'atelier')).toBe('https://tiktok.com/@atelier');
    expect(socialHref('whatsapp', '+33 6 12 34 56 78')).toBe('https://wa.me/33612345678');
  });

  it('keeps a pasted address of the network itself, and nothing that points elsewhere', () => {
    expect(socialHref('facebook', 'https://www.facebook.com/atelier')).toBe('https://www.facebook.com/atelier');
    expect(socialHref('facebook', 'https://evil.example/facebook.com')).toBeNull();
    expect(socialHref('instagram', 'javascript:alert(1)')).toBeNull();
    expect(socialHref('website', 'atelier-rosalie.fr')).toBe('https://atelier-rosalie.fr/');
    expect(socialHref('youtube', '')).toBeNull();
  });

  it('reads the old Instagram field when the list has none, and shows only what makes a link', () => {
    expect(normalizeSocials(undefined, '@old')).toEqual({ instagram: '@old' });
    expect(normalizeSocials({ instagram: '@new', wild: 'x' }, '@old')).toEqual({ instagram: '@new' });
    expect(socialLinks({ instagram: 'a', facebook: 'https://bad.example' }).map((s) => s.id)).toEqual(['instagram']);
  });
});
describe('a Pinterest address', () => {
  it('is Pinterest in any country, never a host that only starts with its name', () => {
    expect(socialHref('pinterest', 'https://pinterest.evil.com/atelier')).toBeNull();
    expect(socialHref('pinterest', 'https://fr.pinterest.com/atelier')).toBe('https://fr.pinterest.com/atelier');
    expect(socialHref('pinterest', 'https://www.pinterest.co.uk/atelier')).not.toBeNull();
    expect(socialHref('pinterest', 'https://pinterest.fr/atelier')).not.toBeNull();
  });
});
