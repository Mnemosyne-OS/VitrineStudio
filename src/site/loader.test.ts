import { loaderMarkup, normalizeLoader } from './loader';
import { EMPTY_BRAND, fillShell } from './buildSite';
import template from './template.html?raw';

describe('the loading screen', () => {
  it('keeps a known style and speed, and nothing else', () => {
    expect(normalizeLoader({ style: 'dots', speed: 'fast' })).toEqual({ style: 'dots', speed: 'fast' });
    expect(normalizeLoader({ style: 'ring', speed: 'normal' })).toEqual({ style: 'ring' });
    expect(normalizeLoader({ style: 'spinner' })).toBeUndefined();
    expect(normalizeLoader(undefined)).toBeUndefined();
  });
  it('writes the name escaped, in the style and speed chosen', () => {
    expect(loaderMarkup({ style: 'name', speed: 'slow' }, 'A <b>')).toBe('<div class="loader l-name l-slow" aria-hidden="true"><b>A &lt;b&gt;</b></div>');
    expect(loaderMarkup({ style: 'dots' }, 'x')).toContain('<i></i><i></i><i></i>');
  });
  it('is in the page HTML right after <body> only when chosen, its CSS always in place', () => {
    const brand = { ...EMPTY_BRAND, name: 'Atelier' };
    const plain = fillShell(template, brand, 'fr');
    expect(plain).not.toContain('class="loader');
    expect(plain).not.toContain('__LOADER_CSS__');
    expect(plain).toContain('@keyframes loader-spin');
    const page = fillShell(template, { ...brand, loader: { style: 'ring' } }, 'fr');
    expect(page).toContain('<body>\n<div class="loader l-ring l-normal" aria-hidden="true"><i></i></div>');
  });
});

describe('the text pages in the dark', () => {
  it('swap her two colours for a dark system only when she chose it', () => {
    const brand = { ...EMPTY_BRAND, name: 'A', ink: '#111111', paper: '#eeeeee' };
    const page = fillShell(template, brand, 'fr');
    expect(page).toContain('body.dark-auto.paged { --paper: #111111; --ink: #eeeeee;');
    expect(page).toContain("if (D.brand.dark === 'auto') document.body.classList.add('dark-auto');");
  });
});

describe('the photos in black and white', () => {
  it('are the About portrait only: a text page photo keeps its colours', () => {
    const page = fillShell(template, { ...EMPTY_BRAND, name: 'A' }, 'fr');
    expect(page).toContain('.portrait:not(.page-photo) img { filter: grayscale(1) contrast(1.02); }');
    expect(page).toContain('body.dark-auto.paged .portrait:not(.page-photo) img { filter: grayscale(1)');
    // No other rule may grey a page photo through the shared .portrait class.
    expect(page).not.toMatch(/\.portrait img \{[^}]*grayscale/);
  });
});

describe('the header over a scrolled page', () => {
  it('gets a frosted veil only while an open page has words under it', () => {
    const page = fillShell(template, { ...EMPTY_BRAND, name: 'A' }, 'fr');
    expect(page).toContain('header.veiled::before { opacity: 1; }');
    expect(page).toContain("head.classList.toggle('veiled', !!open && open.scrollTop > 2)");
  });
});
