import { designOf, draftCount, draftKeys, keepDesign, rebaseDesign, tryDesign, withDesign } from './design';
import { siteFields } from './publish';
import { normalizeSiteSettings } from './records';

const site = () => normalizeSiteSettings({ brand: { name: 'Atelier Rosalie', about: 'Je tourne le grès.', email: 'claire@example.org' } }, '');

describe('a trial of the Design screen', () => {
  it('holds only what she changed, and a field put back leaves it', () => {
    const s = site();
    const look = designOf(s).look;
    let draft = tryDesign(s, {}, { look: { ...look, accent: '#b5532f' } });
    draft = tryDesign(s, draft, { quality: 'max' });
    expect(draftKeys(draft).sort()).toEqual(['look', 'quality']);
    // The accent back to what the site has: one change left, not two.
    draft = tryDesign(s, draft, { look });
    expect(draftKeys(draft)).toEqual(['quality']);
    expect(tryDesign(s, draft, { quality: s.quality })).toEqual({});
  });

  it('a value equal to the site\'s own is no change, whatever the order of its keys', () => {
    const s = site();
    const v = designOf(s).viewer;
    expect(tryDesign(s, {}, { viewer: { frame: v.frame, loupe: v.loupe } })).toEqual({});
    expect(tryDesign(s, {}, { imageKb: s.imageKb, videoLevel: 'light', creationsHover: s.creationsHover })).toEqual({});
  });

  it('laid on the site, it writes sparse: a starting value is absent, never stored', () => {
    const s = site();
    const look = designOf(s).look;
    const on = withDesign(s, { look: { ...look, dark: 'auto', loader: { style: 'ring' } }, videoLevel: 'sharp', imageKb: null });
    expect(on.brand.dark).toBe('auto');
    expect(on.brand.loader).toEqual({ style: 'ring' });
    expect(on.videoLevel).toBe('sharp');
    expect(on.imageKb).toBeNull();
    const off = withDesign(on, { look: { ...designOf(on).look, dark: 'never', loader: null }, videoLevel: 'light' });
    expect('dark' in off.brand).toBe(false);
    expect('loader' in off.brand).toBe(false);
    expect('videoLevel' in off).toBe(false);
  });

  it('never carries her words of the About and Contact pages: keeping a trial cannot write an old text over a new one', () => {
    const before = site();
    const draft = tryDesign(before, {}, { look: { ...designOf(before).look, name: 'Atelier Claire' } });
    // She rewrites her About page while the trial waits.
    const now = { ...before, brand: { ...before.brand, about: 'Dix ans de grès.', email: 'atelier@example.org' } };
    const kept = withDesign(now, draft);
    expect(kept.brand.name).toBe('Atelier Claire');
    expect(kept.brand.about).toBe('Dix ans de grès.');
    expect(kept.brand.email).toBe('atelier@example.org');
  });

  it('counts the settings she changed, not the fields that hold them', () => {
    const s = site();
    const d = designOf(s);
    expect(draftCount(s, {})).toBe(0);
    // Two colours and the dark pages: three settings, one field.
    expect(draftCount(s, { look: { ...d.look, accent: '#b5532f', ink: '#112233', dark: 'auto' } })).toBe(3);
    // The mosaic, the parallax and the loupe turned on: three switches.
    expect(draftCount(s, { viewer: { loupe: 'lens', frame: 'none', layout: 'mosaic', parallax: true } })).toBe(3);
    expect(draftCount(s, { effects: { state: { living: 'off', reveal: 'on' } }, quality: 'max' })).toBe(3);
    // A loading screen chosen is one setting, whatever it holds.
    expect(draftCount(s, { look: { ...d.look, loader: { style: 'ring', speed: 'slow' } } })).toBe(1);
  });

  describe('kept, it lays only what she changed on the site as it is now', () => {
    it('a loupe put on one creation from its card while an effect was being tried is still there', () => {
      const before = site();
      const draft = tryDesign(before, {}, { effects: { state: { reveal: 'on' } } });
      const now = { ...before, effects: { only: { loupe: ['p1'] } } };
      expect(keepDesign(now, before, draft).effects).toEqual({ state: { reveal: 'on' }, only: { loupe: ['p1'] } });
    });

    it('a tagline an agent rewrote while a colour was being tried is not put back', () => {
      const before = site();
      const draft = tryDesign(before, {}, { look: { ...designOf(before).look, accent: '#b5532f' } });
      const now = { ...before, brand: { ...before.brand, tagline: 'Grès tourné à la main', paper: '#ffffff' } };
      const kept = keepDesign(now, before, draft);
      expect(kept.brand.accent).toBe('#b5532f');
      expect(kept.brand.tagline).toBe('Grès tourné à la main');
      // A colour set meanwhile from the preview's palette stays too.
      expect(kept.brand.paper).toBe('#ffffff');
    });

    it('a setting she turned off is turned off, and nothing empty is left behind', () => {
      const before = { ...site(), effects: { state: { reveal: 'on' as const, living: 'off' as const } }, viewer: { loupe: 'lens' as const, frame: 'none' as const, layout: 'mosaic' as const } };
      const d = designOf(before);
      const draft = tryDesign(before, {}, { effects: { state: { living: 'off' } }, viewer: { loupe: 'lens', frame: 'none' } });
      const kept = keepDesign({ ...before, viewer: { ...before.viewer, parallax: true } }, before, draft);
      expect(kept.effects).toEqual({ state: { living: 'off' } });
      // The mosaic she turned off is off; the parallax turned on elsewhere meanwhile stays.
      expect(kept.viewer).toEqual({ loupe: 'lens', frame: 'none', parallax: true });
      expect(keepDesign(before, before, tryDesign(before, {}, { effects: {} })).effects).toEqual({});
      expect(d.viewer.layout).toBe('mosaic');
    });

    it('the logo keeps a gesture made meanwhile, field by field', () => {
      const before = site();
      const draft = tryDesign(before, {}, { identity: { ...before.identity, height: 80 } });
      const kept = keepDesign({ ...before, identity: { ...before.identity, ratio: 2.5 } }, before, draft);
      expect(kept.identity).toMatchObject({ height: 80, ratio: 2.5 });
    });
  });

  it('follows the site when another door changes it: one setting tried stays one, and keeping it undoes nothing', () => {
    const before = site();
    const draft = tryDesign(before, {}, { effects: { state: { reveal: 'on' } } });
    // From a creation's card, the loupe is put on it: written at once.
    const now = { ...before, effects: { only: { loupe: ['p1'] } } };
    const carried = rebaseDesign(before, now, draft);
    expect(draftCount(now, carried)).toBe(1);
    expect(keepDesign(now, now, carried).effects).toEqual({ state: { reveal: 'on' }, only: { loupe: ['p1'] } });
    // Without it, the trial read against the new site would take the loupe off again.
    expect(keepDesign(now, now, draft).effects).toEqual({ state: { reveal: 'on' } });
    // The site caught up with the trial: nothing is left to keep.
    expect(rebaseDesign(before, { ...before, effects: { state: { reveal: 'on' } } }, draft)).toEqual({});
  });

  it('a trial the site has caught up with counts nothing: no dot is left lit for it', () => {
    const before = site();
    const draft = tryDesign(before, {}, { look: { ...designOf(before).look, accent: '#b5532f' } });
    const caught = { ...before, brand: { ...before.brand, accent: '#b5532f' } };
    expect(draftCount(caught, draft)).toBe(0);
  });

  it('her settings of the effects and of the theme survive a reading of site.json, and reach every build of the site', () => {
    const read = normalizeSiteSettings({ brand: { name: 'Atelier Rosalie' }, effects: { state: { reveal: 'on', living: 'off' }, only: { loupe: ['p1'] } }, theme: { id: 'galerie', colours: 'theme' } }, '');
    expect(read.effects).toEqual({ state: { reveal: 'on', living: 'off' }, only: { loupe: ['p1'] } });
    expect(read.theme).toEqual({ id: 'galerie', colours: 'theme' });
    // What useSite hands every build (the page, the preview, the print).
    expect(siteFields(read).effects).toBe(read.effects);
    expect(siteFields(read).theme).toBe(read.theme);
  });

  it('an empty trial is the site itself', () => {
    const s = site();
    expect(withDesign(s, {})).toBe(s);
  });
});
