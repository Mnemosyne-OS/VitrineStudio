import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { designOf, draftCount, keepDesign, tryDesign, withDesign } from './design';
import { normalizeSiteSettings } from './records';
import { buildSiteData } from '../site/buildSite';

describe('her networks in the site menu', () => {
  const site = normalizeSiteSettings({ brand: { name: 'Atelier', socials: { instagram: 'atelier' } } }, '');
  const base = { lang: 'fr' as const, today: '2026-11-10', untitled: 'x', scenes: [], pieces: [] };

  it('is off by default and read back only as true', () => {
    expect(designOf(site).look.menuSocials).toBe(false);
    expect(normalizeSiteSettings({ brand: { menuSocials: 'yes' } }, '').brand.menuSocials).toBeUndefined();
    expect(normalizeSiteSettings({ brand: { menuSocials: true } }, '').brand.menuSocials).toBe(true);
  });

  it('is a trial like any look: counted, laid on the site, kept, and false stored as absent', () => {
    const draft = tryDesign(site, {}, { look: { ...designOf(site).look, menuSocials: true } });
    expect(draftCount(site, draft)).toBe(1);
    expect(withDesign(site, draft).brand.menuSocials).toBe(true);
    const kept = keepDesign(site, site, draft);
    expect(kept.brand.menuSocials).toBe(true);
    const off = withDesign(kept, tryDesign(kept, {}, { look: { ...designOf(kept).look, menuSocials: false } }));
    expect(off.brand).not.toHaveProperty('menuSocials');
  });

  it('reaches the page only with a network to show', () => {
    const brand = { ...site.brand, menuSocials: true as const };
    expect(buildSiteData({ ...base, brand }).menuSocials).toBe(true);
    expect(buildSiteData({ ...base, brand: { ...brand, socials: {}, instagram: '' } }).menuSocials).toBeUndefined();
    expect(buildSiteData({ ...base, brand: site.brand }).menuSocials).toBeUndefined();
    const tpl = readFileSync(join(__dirname, '..', 'site', 'template.html'), 'utf8');
    // One group: one row in the phone's menu, not a line per icon.
    expect(tpl).toContain("+ (D.menuSocials ? `<span class=\"nav-socials\">${(D.socials || []).map((s) => `<a class=\"nav-social\"");
    // The phone's pill padding never reaches her icons, and keeps the weight of the rule it overrides.
    expect(tpl).toContain('.menu-pill nav a:not(.lang-switch):not(.nav-social) { padding: 8px 22px; }');
    expect(tpl).toContain('.menu-pill nav a:not(.lang-switch):not(.nav-social) { padding: 6px 14px;');
  });
});
