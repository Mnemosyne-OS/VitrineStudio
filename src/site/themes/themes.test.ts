import { paletteOf, THEME_FOLDERS, themeClasses, themeOf, THEMES } from './index';
import { MENU_SHAPES, TITLE_SHAPES, TOKEN_KEYS, tokensCss } from './contract';
import template from '../template.html?raw';
import { buildSiteData, EMPTY_BRAND, fillShell } from '../buildSite';
import { JOST_WOFF2_BASE64 } from '../fonts/jost';
import { notFoundHtml, seoFiles, withSeo } from '../seo';
import { designOf, tryDesign, withDesign } from '../../model/design';
import { sitePrint } from '../../model/publish';
import { normalizeSiteSettings } from '../../model/records';
import { defaultShow } from '../../model/showcase';
import { normalizeTheme, STARTING_THEME } from '../../model/theme';
import type { Piece, Scene } from '../../model/types';

const brand = { ...EMPTY_BRAND, name: 'Atelier Rosalie', ink: '#112233', paper: '#fafafa', accent: '#b5532f' };
const piece: Piece = { schema: 1, id: 'p1', name: 'Vase cône', kind: 'unique', tags: [], photoPath: 'C:/p/p1.jpg' };
const scene: Scene = {
  schema: 1, id: '1', pieceId: 'p1', universe: 'Salon', variant: 'Console', placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9',
  images: { place: 'C:/g/1a.png', piece: 'C:/g/1b.png', alive: 'C:/g/1c.png' }, validated: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '',
};
const input = (over: Partial<Parameters<typeof buildSiteData>[0]> = {}) => ({ brand, lang: 'fr' as const, today: '2026-11-10', untitled: 'x', scenes: [scene], pieces: [piece], showcase: { p1: { ...defaultShow(), show: { ...defaultShow().show, name: true } } }, ...over });
const page = (over: Partial<Parameters<typeof buildSiteData>[0]> = {}) => { const data = buildSiteData(input(over)); return { data, html: fillShell(template, brand, 'fr', data) }; };
const root = (html: string) => /:root \{([^}]*)\}/.exec(html)![1]!;
const style = (html: string) => html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

describe('the template is the structure, a theme is its tokens', () => {
  it('reads the themes from the folders, each under its own name, the starting one first', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(4);
    expect(THEMES[0]!.id).toBe(STARTING_THEME);
    for (const t of THEMES) expect(THEME_FOLDERS[t.id]).toBe(t.id);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });

  it.each(THEMES.map((t) => [t.id, t] as const))('%s is whole: every token, three languages, a palette, known shapes', (_id, t) => {
    for (const k of TOKEN_KEYS) expect(t.tokens[k].trim().length).toBeGreaterThan(0);
    for (const words of [t.name, t.about]) for (const lang of ['en', 'fr', 'es'] as const) expect(words[lang].trim().length).toBeGreaterThan(1);
    for (const c of [t.colours.ink, t.colours.paper, t.colours.accent]) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(MENU_SHAPES).toContain(t.menu);
    expect(TITLE_SHAPES).toContain(t.titles);
    expect(() => tokensCss(t.tokens)).not.toThrow();
  });

  it('the page holds no value a theme sets: its letters, its labels, its corners are read from the tokens', () => {
    const css = style(template);
    expect(css).not.toContain('text-transform: uppercase');
    expect(css).not.toMatch(/font:[^;]*Jost/);
    expect(css).not.toMatch(/letter-spacing: \.\d+em/);
    expect(css).toContain('__TOKENS__');
    expect(template).toContain('<html lang="__LANG__"__THEME_CLASS__>');
  });

  it('a token can never write a rule', () => {
    expect(() => tokensCss({ ...THEMES[0]!.tokens, radius: '0; } body { display: none' })).toThrow(/^BAD_THEME_TOKEN: radius/);
  });
});

describe('the starting theme IS the page of before', () => {
  it('its tokens are the values the template carried in place, one for one', () => {
    // Read from the template as it was on 2026-11-09 (the 0.4.0), rule by rule.
    expect(themeOf(undefined).tokens).toEqual({
      font: 'Jost, Futura, "Century Gothic", sans-serif', bodyWeight: '300',
      fontTitle: 'inherit', titleSize: 'clamp(48px, 9vw, 140px)', titleWeight: '400', titleStyle: 'normal', titleTracking: '-.035em', titleLh: '.9', titleCase: 'none', titleGap: '48px',
      fontLabel: 'inherit', labelCase: 'uppercase', track: '1',
      radius: '0px', radiusUi: '16px', radiusPill: '99px', radiusBtn: '0px',
      pad: 'clamp(16px, 3vw, 40px)', gap: '16px', tile: '220px',
    });
    expect(themeOf(undefined)).toMatchObject({ menu: 'plain', titles: 'plain', font: 'jost' });
  });

  it('a site that chose nothing: no class on its root, its font inside the page, her colours, and nothing about a theme in its data', () => {
    const { data, html } = page();
    expect('theme' in data).toBe(false);
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('@font-face { font-family: Jost;');
    expect(html).toContain(JOST_WOFF2_BASE64.slice(0, 80));
    expect(root(html)).toContain('--paper: #fafafa; --ink: #112233;');
    expect(root(html)).toContain('--accent: #b5532f;');
    expect(root(html)).toContain('--pad: clamp(16px, 3vw, 40px);');
    expect(html).not.toMatch(/__[A-Z_]+__/);
  });

  it('its settings are absent, and its print is the same with them and without', () => {
    const site = normalizeSiteSettings({ brand: { name: 'Atelier Rosalie' } }, '');
    expect(site.theme).toEqual({});
    expect(normalizeTheme({ id: STARTING_THEME, colours: 'mine' })).toEqual({});
    const base = { ...input(), film: null };
    const before = sitePrint(base, site, { scenes: [scene], pieces: [piece] });
    expect(sitePrint({ ...base, theme: {} }, site, { scenes: [scene], pieces: [piece] })).toBe(before);
    expect(sitePrint({ ...base, theme: { id: STARTING_THEME } }, site, { scenes: [scene], pieces: [piece] })).toBe(before);
    // A theme chosen, or its colours asked for, is a change of the site: the bar says so.
    expect(sitePrint({ ...base, theme: { id: 'galerie' } }, site, { scenes: [scene], pieces: [piece] })).not.toBe(before);
    expect(sitePrint({ ...base, theme: { colours: 'theme' } }, site, { scenes: [scene], pieces: [piece] })).not.toBe(before);
  });
});

describe('a theme she chose', () => {
  it('lays its tokens and its shapes on the same page, and keeps HER colours', () => {
    const { data, html } = page({ theme: { id: 'douceur' } });
    expect(data.theme).toEqual({ id: 'douceur' });
    expect(html).toContain('<html lang="fr" class="menu-pill">');
    expect(root(html)).toContain('--radius: 20px;');
    expect(root(html)).toContain('--label-case: none;');
    // Her colours, whatever the theme.
    expect(root(html)).toContain('--paper: #fafafa; --ink: #112233;');
    expect(root(html)).toContain('--accent: #b5532f;');
  });

  it('a theme that reads the visitor\'s own fonts sends no font file: the page is lighter by it', () => {
    const start = page().html, soft = page({ theme: { id: 'douceur' } }).html;
    expect(soft).not.toContain('@font-face');
    expect(soft).not.toContain(JOST_WOFF2_BASE64.slice(0, 80));
    expect(start.length - soft.length).toBeGreaterThan(JOST_WOFF2_BASE64.length - 2000);
  });

  it('the theme\'s own colours only when she asks for them, on the pages of words in the dark too', () => {
    const { html } = page({ theme: { id: 'brut', colours: 'theme' } });
    const t = themeOf('brut');
    expect(root(html)).toContain(`--paper: ${t.colours.paper}; --ink: ${t.colours.ink};`);
    expect(root(html)).toContain(`--accent: ${t.colours.accent};`);
    expect(html).toContain(`body.dark-auto.paged { --paper: ${t.colours.ink}; --ink: ${t.colours.paper};`);
    expect(html).not.toContain('#b5532f;');
    expect(paletteOf({ id: 'brut' }, brand)).toEqual({ ink: '#112233', paper: '#fafafa', accent: '#b5532f' });
    // The starting theme's own colours can be asked for too.
    expect(page({ theme: { colours: 'theme' } }).data.theme).toEqual({ colours: 'theme' });
  });

  it('a theme nobody knows any more is the starting theme, never a broken page', () => {
    const { html } = page({ theme: { id: 'gone' } });
    expect(themeOf('gone').id).toBe(STARTING_THEME);
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('--title-size: clamp(48px, 9vw, 140px);');
  });

  it('every address of the site wears it: the light documents keep the root\'s classes and read the tokens from the shared stylesheet', () => {
    const seo = { origin: 'https://atelier-rosalie.example' };
    const data = withSeo(buildSiteData(input({ theme: { id: 'galerie' }, seo })), 'fr', seo);
    const files = seoFiles(fillShell(template, brand, 'fr', data), data, 'fr');
    const doc = files.find((f) => f.rel === 'creations/index.html')!;
    expect(doc.text).toMatch(/<html lang="fr" class="menu-under titles-rule"[^>]*>/);
    const css = files.find((f) => f.rel === 'assets/site.css')!;
    expect(css.text).toContain('--title-style: italic;');
    expect(css.text).toContain('.menu-under nav a');
    // The page of an unknown address is painted with the same colours and letters.
    const lost = notFoundHtml({ ...data, theme: { id: 'galerie', colours: 'theme' } }, 'fr');
    expect(lost).toContain(`background:${themeOf('galerie').colours.paper}`);
    expect(lost).toContain('Palatino');
  });

  it('is tried like every setting of the Design screen, and stored sparse once kept', () => {
    const site = normalizeSiteSettings({ brand: { name: 'Atelier Rosalie' } }, '');
    const d = designOf(site);
    expect(d.theme).toEqual({ id: STARTING_THEME, colours: 'own' });
    const draft = tryDesign(site, {}, { theme: { id: 'galerie', colours: 'theme' } });
    expect(withDesign(site, draft).theme).toEqual({ id: 'galerie', colours: 'theme' });
    // Back to the starting theme and her colours: nothing is tried, nothing would be stored.
    expect(tryDesign(site, draft, { theme: { id: STARTING_THEME, colours: 'own' } })).toEqual({});
    expect(withDesign({ ...site, theme: { id: 'galerie' } }, { theme: { id: STARTING_THEME, colours: 'own' } }).theme).toEqual({});
  });

  it('the shapes are classes of the root, none for the plain ones', () => {
    expect(themeClasses(themeOf(STARTING_THEME))).toBe('');
    expect(themeClasses(themeOf('galerie'))).toBe('menu-under titles-rule');
  });
});
