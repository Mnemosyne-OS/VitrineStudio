import { buildSiteData, exportSite, fillShell, seoPictures, ICON_ASSET, SHARE_ASSET, type Brand, type SiteData } from './buildSite';
import { excerpt, headTags, plainText, robotsTxt, seoFiles, seoPaths, sitemapXml, staticBody, structuredData, withSeo } from './seo';
import { AI_BOTS, RESERVED_FOLDERS, normalizeSeo, originOf, slugsFor, slugOf, verificationOf, writtenPaths, type SeoSettings } from '../model/seo';
import { normalizeSiteSettings } from '../model/records';
import { siteFields, sitePrint } from '../model/publish';
import { defaultShow } from '../model/showcase';
import { EMPTY_LEGAL } from '../model/legal';
import type { Piece, Scene } from '../model/types';

const piece = (id: string, over: Partial<Piece> = {}): Piece => ({ schema: 1, id, name: `Vase ${id}`, kind: 'unique', tags: [], photoPath: `C:/p/${id}.jpg`, ...over });
const scene = (id: string, over: Partial<Scene> = {}): Scene => ({
  schema: 1, id, pieceId: 'p1', universe: 'Salon', variant: `V ${id}`, placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9',
  images: { place: `C:/g/${id}a.png`, piece: `C:/g/${id}b.png`, alive: `C:/g/${id}c.png` }, validated: true, createdAt: `2026-10-0${id}T00:00:00Z`, updatedAt: '', ...over,
});
const brand: Brand = { accent: '#5F5A53', ink: '#2B2926', paper: '#EEECE7', name: 'Atelier <Test>', tagline: 'Grès tourné', about: 'Je tourne le grès depuis dix ans.', email: 'a@b.ch', instagram: '', introLine: '', portraitCaption: '', contactNote: '', formspree: '' };
const ORIGIN = 'https://atelier.example';

const pieces = [piece('p1', { description: 'Un vase haut.', price: 120 }), piece('p2', { name: 'Vase p1' }), piece('p3', { name: 'Bol' })];
// The print of the site reads a piece's showcase as stored: names shown, as in the fixtures above.
const scenes = [scene('1'), scene('2', { pieceId: 'p2' }), scene('3', { pieceId: 'p3' })];
const showAll = { ...defaultShow(), show: { ...defaultShow().show, name: true, description: true, price: true } };
const input = (seo: SeoSettings = {}, over: Partial<Parameters<typeof buildSiteData>[0]> = {}) => ({
  brand, lang: 'fr' as const, today: '2026-11-09', untitled: 'x', scenes, pieces, showcase: { p1: showAll, p2: showAll, p3: showAll }, seo,
  posts: [{ id: 'a', title: 'Le four à bois', date: '2026-06-12', text: '# T\n\nUne cuisson de trois jours.' }], ...over,
});
const site = (seo: SeoSettings = {}, over: Partial<Parameters<typeof buildSiteData>[0]> = {}): SiteData => withSeo(buildSiteData(input(seo, over)), 'fr', seo, { address: '1 rue du Four\n1200 Genève', phone: '' });
const pathsOf = (d: SiteData) => Object.fromEntries(d.seo!.pages.map((p) => [p.id, p.path]));
const ctx = (d: SiteData, made: { share?: string; icon?: string } = {}) => ({ site: d, d, lang: 'fr', mainLang: 'fr', ...made });
const page = (d: SiteData, id: string) => d.seo!.pages.find((p) => p.id === id)!;

describe('the settings read back', () => {
  it('a site from before them reads as nothing: every starting value, and a print that does not move', () => {
    expect(normalizeSeo(undefined)).toEqual({});
    expect(normalizeSeo({ engines: 'open', sold: 'keep', creationPages: 'all', structured: { business: true }, words: { about: '  ' }, verification: 'no' })).toEqual({});
    expect(normalizeSiteSettings({}, 'x').seo).toEqual({});
  });
  it('keeps only her real choices, each word of an address made safe', () => {
    expect(normalizeSeo({ engines: 'closed', aiBots: 'closed', sold: 'drop', creationPages: 'described', structured: { products: false }, legalInSitemap: true, words: { about: 'Qui suis-je ?' }, slugs: { 'c:p1': 'Vase Cône' }, origin: 'atelier.example/boutique?x=1', originOwn: true }))
      .toEqual({ engines: 'closed', aiBots: 'closed', sold: 'drop', creationPages: 'described', structured: { products: false }, legalInSitemap: true, words: { about: 'qui-suis-je' }, slugs: { 'c:p1': 'vase-cone' }, origin: 'https://atelier.example', originOwn: true });
  });
  it('reads an address and a verification code, and refuses what is neither', () => {
    expect(originOf('http://localhost:5173/x')).toBe('http://localhost:5173');
    expect(originOf('pas une adresse')).toBeNull();
    expect(originOf('ftp://a.ch')).toBeNull();
    expect(verificationOf('<meta name="google-site-verification" content="abcDEF_123-xyz" />')).toBe('abcDEF_123-xyz');
    expect(verificationOf('"><script>')).toBe('');
  });
  it('gives each thing its own slug: a kept one stays, a new name never takes it, a clash is numbered', () => {
    expect(slugOf('  Vase Cône n°2 ! ')).toBe('vase-cone-n-2');
    expect(slugsFor([{ key: 'a', name: 'Bol' }, { key: 'b', name: 'Bol' }, { key: 'c', name: '???' }])).toEqual({ a: 'bol', b: 'bol-2' });
    // `b` was sent as « bol »: `a`, renamed to Bol later, takes the next one.
    expect(slugsFor([{ key: 'a', name: 'Bol' }, { key: 'b', name: 'Saladier' }], { b: 'bol' })).toEqual({ b: 'bol', a: 'bol-2' });
  });
});

describe('the addresses of a site', () => {
  it('gives one address to each page, creation and post, in the words of the language', () => {
    expect(pathsOf(site())).toEqual({
      '': '', creations: 'creations/', 'a-propos': 'a-propos/', blog: 'blog/', contact: 'contact/',
      'mentions-legales': 'mentions-legales/', confidentialite: 'confidentialite/',
      'blog-a': 'blog/le-four-a-bois/', 'c:p1': 'creations/vase-p1/', 'c:p2': 'creations/vase-p1-2/', 'c:p3': 'creations/bol/',
    });
  });
  it('uses her own words, and keeps an address once sent whatever the name becomes', () => {
    const d = site({ words: { creations: 'ceramiques', about: 'atelier' }, slugs: { 'c:p3': 'grand-bol' } });
    expect(pathsOf(d)['creations']).toBe('ceramiques/');
    expect(pathsOf(d)['a-propos']).toBe('atelier/');
    expect(pathsOf(d)['c:p3']).toBe('ceramiques/grand-bol/');
  });
  it('gives a page only to the creations she chose: all, the described ones, or none', () => {
    const ids = (seo: SeoSettings) => site(seo).seo!.pages.filter((p) => p.kind === 'creation').map((p) => p.id);
    expect(ids({})).toEqual(['c:p1', 'c:p2', 'c:p3']);
    expect(ids({ creationPages: 'described' })).toEqual(['c:p1']);
    expect(ids({ creationPages: 'none' })).toEqual([]);
  });
  it('gives no page to a creation whose name she does not show: the hidden name is never a title or an address', () => {
    const hidden = { ...showAll, show: { ...showAll.show, name: false } };
    const d = site({ origin: ORIGIN }, { showcase: { p1: showAll, p2: showAll, p3: hidden } });
    expect(pathsOf(d)['c:p3']).toBeUndefined();
    expect(pathsOf(d)['c:p1']).toBe('creations/vase-p1/');
    expect(sitemapXml(d)).not.toContain('bol');
  });
  it('writes no description at all for a page with nothing to say of itself', async () => {
    const bare: Brand = { ...brand, tagline: '', about: '' };
    const d = withSeo(buildSiteData({ ...input(), brand: bare }), 'fr', {});
    expect(page(d, 'contact').description).toBe('');
    expect(headTags(ctx(d), page(d, 'contact'))).not.toContain('og:description');
    const doc = seoFiles(fillShell((await import('./template.html?raw')).default, bare, 'fr', d), d, 'fr').find((f) => f.rel === 'contact/index.html')!.text;
    expect(doc).not.toContain('name="description"');
  });
  it('stays the one page when she chose so', () => {
    expect(site({ addresses: 'single' }).seo!.pages.map((p) => p.id)).toEqual(['']);
  });
  it('never gives an address to what the site does not show', () => {
    const d = site({}, { showcase: { p1: showAll, p2: showAll, p3: { ...showAll, hidden: true } } as never, pieces: [...pieces.slice(0, 2), piece('p3', { name: 'Bol' }), piece('p4', { name: 'Jamais en scène' })] });
    expect(pathsOf(d)['c:p4']).toBeUndefined();
    expect(sitemapXml(withSeo(d, 'fr', { origin: ORIGIN }))).not.toContain('jamais');
  });
  it('writes each title from the page then the site, and her own title in its place', () => {
    const d = site({ meta: { 'c:p3': { title: 'Bol à thé en grès', description: 'Un bol pour le thé.' } } });
    expect(page(d, '').title).toBe('Atelier <Test> · Grès tourné');
    expect(page(d, 'creations').title).toBe('Créations · Atelier <Test>');
    expect(page(d, 'c:p1').title).toBe('Vase p1 · Atelier <Test>');
    expect(page(d, 'c:p3')).toMatchObject({ title: 'Bol à thé en grès', description: 'Un bol pour le thé.' });
    // The home's title already says the tagline: its description says something else.
    expect(page(d, '').description).toBe('Je tourne le grès depuis dix ans.');
    expect(page(d, 'c:p1').description).toContain('Un vase haut.');
  });
  it('keeps the legal pages out of the sitemap unless she lists them', () => {
    const closed = sitemapXml(site({ origin: ORIGIN }))!;
    expect(closed).toContain(`<loc>${ORIGIN}/creations/bol/</loc>`);
    expect(closed).not.toContain('mentions-legales');
    expect(sitemapXml(site({ origin: ORIGIN, legalInSitemap: true }))).toContain(`<loc>${ORIGIN}/mentions-legales/</loc>`);
  });
});

describe('a sold piece', () => {
  const sold = [pieces[0]!, pieces[1]!, piece('p3', { name: 'Bol', status: 'sold' })];
  it('keeps the page it had, marked sold, out of the gallery', () => {
    const d = site({ slugs: { 'c:p3': 'bol' } }, { pieces: sold });
    expect(d.creations.map((c) => c.id)).toEqual(['p1', 'p2']);
    expect(d.sold!.map((c) => [c.id, c.sold])).toEqual([['p3', true]]);
    expect(pathsOf(d)['c:p3']).toBe('creations/bol/');
    expect(staticBody(ctx(d), page(d, 'c:p3'))).toContain('<strong>Vendue</strong>');
  });
  it('is on the site once, not twice, when she keeps it in the gallery although sold', () => {
    const d = site({ origin: ORIGIN, slugs: { 'c:p3': 'bol' } }, { pieces: sold, showcase: { p1: showAll, p2: showAll, p3: { ...showAll, onPage: true } } });
    expect(d.sold).toBeUndefined();
    expect(d.seo!.pages.filter((p) => p.id === 'c:p3')).toHaveLength(1);
    expect(d.creations.find((c) => c.id === 'p3')!.sold).toBe(true);
    expect(d.seo!.soldWord).toBe('Vendue');
  });
  it('keeps no page with no Creations page left under it', () => {
    const d = site({ slugs: { 'c:p1': 'vase', 'c:p2': 'vase-2', 'c:p3': 'bol' } }, { pieces: pieces.map((p) => ({ ...p, status: 'sold' as const })) });
    expect(d.creations).toEqual([]);
    expect(d.seo!.pages.filter((p) => p.kind === 'creation')).toEqual([]);
  });
  it('gets no page when it never had one, and loses it when she chose so', () => {
    expect(site({}, { pieces: sold }).sold).toBeUndefined();
    expect(site({ slugs: { 'c:p3': 'bol' }, sold: 'drop' }, { pieces: sold }).sold).toBeUndefined();
    expect(pathsOf(site({ slugs: { 'c:p3': 'bol' }, sold: 'drop' }, { pieces: sold }))['c:p3']).toBeUndefined();
  });
});

describe('the head of a page', () => {
  it('names no absolute address before the site has one: no canonical, no sitemap, no structured data', () => {
    const d = site();
    const head = headTags(ctx(d), page(d, 'c:p1'));
    expect(head).not.toContain('canonical');
    expect(head).not.toContain('og:url');
    expect(head).not.toContain('og:image');
    expect(head).not.toContain('ld+json');
    expect(head).toContain('<meta property="og:title" content="Vase p1 · Atelier &lt;Test&gt;">');
    expect(sitemapXml(d)).toBeNull();
    expect(robotsTxt(d.seo!)).toBe('User-agent: *\nAllow: /\n');
  });
  it('names the one address everywhere once it is known', () => {
    const d = site({ origin: ORIGIN });
    const head = headTags(ctx(d, { share: SHARE_ASSET }), page(d, 'c:p1'));
    expect(head).toContain(`<link rel="canonical" href="${ORIGIN}/creations/vase-p1/">`);
    expect(head).toContain(`<meta property="og:image" content="${ORIGIN}/assets/creation-p1.webp">`);
    // The home's picture is the JPEG every network reads.
    expect(headTags(ctx(d, { share: SHARE_ASSET }), page(d, ''))).toContain(`${ORIGIN}/${SHARE_ASSET}`);
    expect(robotsTxt(d.seo!)).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
  it('says noindex on every page of a closed site, and gives it no sitemap', () => {
    const d = site({ origin: ORIGIN, engines: 'closed' });
    for (const p of d.seo!.pages) expect(headTags(ctx(d), p)).toContain('<meta name="robots" content="noindex">');
    expect(sitemapXml(d)).toBeNull();
    expect(robotsTxt(d.seo!)).not.toContain('Sitemap');
    expect(headTags(ctx(site({ origin: ORIGIN })), page(d, ''))).not.toContain('noindex');
  });
  it('refuses the AI crawlers by name only when she closed them', () => {
    expect(robotsTxt(site().seo!)).not.toContain('GPTBot');
    const closed = robotsTxt(site({ aiBots: 'closed' }).seo!);
    for (const bot of AI_BOTS) expect(closed).toContain(`User-agent: ${bot}\nDisallow: /`);
    expect(closed.startsWith('User-agent: *\nAllow: /\n')).toBe(true);
  });
  it('carries Google’s verification on the home only', () => {
    const d = site({ verification: 'abcDEF_123-xyz' });
    expect(headTags(ctx(d), page(d, ''))).toContain('<meta name="google-site-verification" content="abcDEF_123-xyz">');
    expect(headTags(ctx(d), page(d, 'creations'))).not.toContain('google-site-verification');
  });
});

describe('structured data', () => {
  const types = (d: SiteData, id: string) => structuredData(ctx(d), page(d, id)) as Array<Record<string, unknown>>;
  it('describes a creation with an offer only when she shows a price, never an invented field', () => {
    const d = site({ origin: ORIGIN });
    const [p1] = types(d, 'c:p1');
    expect(p1).toMatchObject({ '@type': 'Product', name: 'Vase p1', description: 'Un vase haut.', offers: { price: 120, priceCurrency: 'CHF' } });
    // No status on the piece: its availability is not said, never guessed.
    expect((p1 as { offers: object }).offers).not.toHaveProperty('availability');
    const forSale = site({ origin: ORIGIN }, { pieces: [piece('p1', { price: 120, status: 'available' }), pieces[1]!, pieces[2]!] });
    expect((types(forSale, 'c:p1')[0] as { offers: { availability: string } }).offers.availability).toBe('https://schema.org/InStock');
    const held = site({ origin: ORIGIN }, { pieces: [piece('p1', { price: 120, status: 'reserved' }), pieces[1]!, pieces[2]!] });
    expect((types(held, 'c:p1')[0] as { offers: object }).offers).not.toHaveProperty('availability');
    const [p3] = types(d, 'c:p3');
    expect(p3).not.toHaveProperty('offers');
    expect(p3).not.toHaveProperty('description');
    expect(JSON.stringify(types(d, 'c:p1'))).not.toMatch(/aggregateRating|review/i);
  });
  it('says a sold piece is sold', () => {
    const d = site({ origin: ORIGIN, slugs: { 'c:p1': 'vase' } }, { pieces: [piece('p1', { price: 120, status: 'sold' }), pieces[1]!, pieces[2]!] });
    expect((types(d, 'c:p1')[0] as { offers: { availability: string } }).offers.availability).toBe('https://schema.org/SoldOut');
  });
  it('names a local business only with her address; without, the organisation alone', () => {
    const d = site({ origin: ORIGIN });
    expect(types(d, '')[0]).toMatchObject({ '@type': 'LocalBusiness', address: '1 rue du Four, 1200 Genève', email: 'a@b.ch' });
    expect(types(d, '')[0]).not.toHaveProperty('telephone');
    const bare = withSeo(buildSiteData(input({ origin: ORIGIN })), 'fr', { origin: ORIGIN }, { address: '  ', phone: '' });
    expect(types(bare, '')[0]).toMatchObject({ '@type': 'Organization' });
    expect(types(bare, '')[0]).not.toHaveProperty('address');
  });
  it('writes each kind only while she leaves it on', () => {
    const d = site({ origin: ORIGIN, structured: { products: false, business: false, articles: false } });
    expect(types(d, 'c:p1')).toEqual([]);
    expect(types(d, '')).toEqual([]);
    expect(types(d, 'blog-a')).toEqual([]);
    expect(types(site({ origin: ORIGIN }), 'blog-a')[0]).toMatchObject({ '@type': 'BlogPosting', headline: 'Le four à bois', datePublished: '2026-06-12' });
  });
});

describe('the words of a page without its script', () => {
  it('says what the page shows, her words escaped, each link a real address', () => {
    const d = site();
    const home = staticBody(ctx(d), page(d, ''));
    expect(home).toContain('<h1>Atelier &lt;Test&gt;</h1>');
    expect(home).toContain('<a href="creations/">Créations</a>');
    const list = staticBody(ctx(d), page(d, 'creations'));
    expect(list).toContain('<a href="creations/vase-p1/">Vase p1</a>');
    expect(list).toContain('alt="Bol"');
    const one = staticBody(ctx(d), page(d, 'c:p1'));
    expect(one).toContain('<h1>Vase p1</h1>');
    expect(one).toContain('Un vase haut.');
    expect(staticBody(ctx(d), page(d, 'blog-a'))).toContain('Une cuisson de trois jours.');
    expect(staticBody(ctx(d), page(d, 'a-propos'))).toContain('Je tourne le grès depuis dix ans.');
  });
  it('keeps the one page’s anchors on a one-page site', () => {
    const d = site({ addresses: 'single' });
    expect(staticBody(ctx(d), page(d, ''))).not.toContain('href="creations/"');
  });
  it('cuts a description between two words', () => {
    expect(excerpt('un deux trois quatre cinq', 14)).toBe('un deux trois…');
    expect(plainText('<p>Un &amp; <b>deux</b></p><script>x</script>')).toBe('Un & deux');
  });
});

describe('the second language', () => {
  const two = (seo: SeoSettings = { origin: ORIGIN }): SiteData => {
    const main = buildSiteData(input(seo));
    const en = buildSiteData({ ...input(seo), lang: 'en' });
    return withSeo({ ...main, alt: { lang: 'en', data: { ...en, creations: en.creations.map((c) => ({ ...c, alt: `EN ${c.alt}` })) } } }, 'fr', seo);
  };
  it('has the same addresses under its code, on the main language’s slugs', () => {
    const d = two();
    const alt = pathsOf(d.alt!.data);
    expect(alt['']).toBe('en/');
    expect(alt['a-propos']).toBe('en/about/');
    // The translated name does not move the address.
    expect(alt['c:p3']).toBe('en/creations/bol/');
    expect(Object.keys(alt).sort()).toEqual(Object.keys(pathsOf(d)).sort());
  });
  it('names each page’s twin in the head and in the sitemap', () => {
    const d = two();
    const head = headTags(ctx(d), page(d, 'a-propos'));
    expect(head).toContain(`<link rel="alternate" hreflang="en" href="${ORIGIN}/en/about/">`);
    expect(head).toContain(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/a-propos/">`);
    const map = sitemapXml(d)!;
    expect(map).toContain(`<loc>${ORIGIN}/en/about/</loc>`);
    expect(map).toContain(`<xhtml:link rel="alternate" hreflang="fr" href="${ORIGIN}/a-propos/"/>`);
  });
  it('sends a returning or foreign-language visitor to it as the site always did, unless she turned that off', () => {
    expect(two().seo!.follow).toBe(true);
    expect(two().alt!.data.seo!.follow).toBe(true);
    expect(two({ origin: ORIGIN, visitorLanguage: 'address' }).seo!.follow).toBeUndefined();
    // One language: nothing to follow.
    expect(site({ origin: ORIGIN }).seo!.follow).toBeUndefined();
  });
  it('stays one address with ?lang= on a one-page site', () => {
    const d = two({ origin: ORIGIN, addresses: 'single' });
    expect(d.alt!.data.seo).toBeUndefined();
    expect(d.seo!.pages).toHaveLength(1);
  });
});

describe('the files of the addresses', () => {
  const tplOf = async () => (await import('./template.html?raw')).default;
  it('writes one light document per address, each with its own head and words, the style and the script shared', async () => {
    const d = site({ origin: ORIGIN });
    const shell = fillShell(await tplOf(), brand, 'fr', d);
    const files = seoFiles(shell, d, 'fr');
    const names = files.map((f) => f.rel);
    expect(names).toEqual(expect.arrayContaining(['assets/site.css', 'assets/site.js', 'creations/index.html', 'creations/vase-p1/index.html', 'blog/le-four-a-bois/index.html', 'robots.txt', 'sitemap.xml', '404.html']));
    expect(names).not.toContain('index.html');
    expect(names).not.toContain('vercel.json');
    const doc = files.find((f) => f.rel === 'creations/vase-p1/index.html')!.text;
    expect(doc).toContain('<base href="../../">');
    expect(doc).toContain('<title>Vase p1 · Atelier &lt;Test&gt;</title>');
    expect(doc).toContain('<html lang="fr" data-lang="fr" data-main="fr">');
    expect(doc).toMatch(/<script src="assets\/site\.js\?v=[a-z0-9]+"><\/script>/);
    expect(doc).not.toContain('id="site-data"');
    expect(doc).toContain('<h1>Vase p1</h1>');
    expect(doc).toContain('index.html#c:p1');
    // Opened from the disk, the hand-over to the whole page runs BEFORE the <base>: read after it, « ../../ » would count twice.
    expect(doc.indexOf('location.replace("../../index.html#c:p1")')).toBeGreaterThan(0);
    expect(doc.indexOf('location.replace(')).toBeLessThan(doc.indexOf('<base href='));
    // A light document is a small one: the page's script and style are not in it.
    expect(doc.length).toBeLessThan(8000);
    expect(files.find((f) => f.rel === 'assets/site.js')!.text).toContain('const REAL =');
  });
  it('leaves the home page whole, with its own head and words', async () => {
    const d = site({ origin: ORIGIN });
    const shell = fillShell(await tplOf(), brand, 'fr', d, { share: SHARE_ASSET });
    expect(shell).toContain('<title>Atelier &lt;Test&gt; · Grès tourné</title>');
    expect(shell).toContain(`<link rel="canonical" href="${ORIGIN}/">`);
    expect(shell).toContain('<div id="static"><h1>Atelier &lt;Test&gt;</h1>');
    expect(shell).toContain('id="site-data"');
    // A preview has no addresses: the shell is the page of before.
    const plain = fillShell(await tplOf(), brand, 'fr', buildSiteData(input()));
    expect(plain).not.toContain('<div id="static">');
    expect(plain).toContain('<html lang="fr">');
  });
  it('never starts an address with a folder name the host takes for a work folder: the send would be refused whole', () => {
    const d = site({ words: { blog: 'journal', creations: 'products' } }, { pages: [{ id: 'studio', type: 'text', name: 'Studio', text: 'Visitez.' }] });
    expect(pathsOf(d)).toMatchObject({ blog: 'page-journal/', creations: 'page-products/', studio: 'page-studio/', 'c:p3': 'page-products/bol/' });
    for (const p of seoPaths(d)) expect(RESERVED_FOLDERS as readonly string[]).not.toContain(p.split('/')[0]);
  });
  it('writes over an address the site no longer has, so it never stays online as it was', async () => {
    const before = site({ origin: ORIGIN });
    const written = writtenPaths(undefined, seoPaths(before));
    expect(written).toContain('creations/bol/');
    // The bowl is taken off the site, and « About » moves to her own word.
    const now = site({ origin: ORIGIN, words: { about: 'atelier' }, redirects: [{ from: 'a-propos/', id: 'a-propos' }] }, { pieces: pieces.slice(0, 2), scenes: scenes.slice(0, 2) });
    const files = seoFiles(fillShell(await tplOf(), brand, 'fr', now), now, 'fr', {}, written);
    const gone = files.find((f) => f.rel === 'creations/bol/index.html')!.text;
    expect(gone).toContain('<meta name="robots" content="noindex">');
    expect(gone).toContain('<meta http-equiv="refresh" content="0; url=/">');
    expect(gone).not.toContain('Bol');
    // A moved page leads to where it went.
    expect(files.find((f) => f.rel === 'a-propos/index.html')!.text).toContain('url=/atelier/');
    // A page that is still there is written once, as itself.
    expect(files.filter((f) => f.rel === 'creations/vase-p1/index.html')).toHaveLength(1);
    expect(files.find((f) => f.rel === 'creations/vase-p1/index.html')!.text).not.toContain('http-equiv');
    expect(normalizeSeo({ written: ['creations/bol/', '../x/', 'creations/bol/', 7] }).written).toEqual(['creations/bol/']);
  });
  it('writes an old address’s redirect only when one moved', async () => {
    const d = site({ origin: ORIGIN, words: { creations: 'ceramiques' }, redirects: [{ from: 'creations/', id: 'creations' }, { from: 'blog/', id: 'blog' }] });
    const file = seoFiles(fillShell(await tplOf(), brand, 'fr', d), d, 'fr').find((f) => f.rel === 'vercel.json')!;
    // « blog/ » is still the blog's address: it redirects nowhere.
    expect(JSON.parse(file.text)).toEqual({ redirects: [{ source: '/creations', destination: '/ceramiques/', permanent: true }, { source: '/creations/', destination: '/ceramiques/', permanent: true }] });
  });
  it('the export writes them after the pictures and before the home page, and names only the pictures it made', async () => {
    const d = { ...site({ origin: ORIGIN }), identity: { html: '', favicon: 'data:image/svg+xml,%3Csvg/%3E' } } as SiteData;
    expect(seoPictures(d)).toEqual({ share: SHARE_ASSET, icon: ICON_ASSET });
    const saved: Array<[string, string]> = [];
    const deps = { readImage: async () => 'data:image/png;base64,AAAA', readMedia: async () => 'data:video/mp4;base64,AAAA', toWebp: async () => 'AAAA', save: async (n: string, b: string) => { saved.push([n, b]); }, onProgress: () => {}, lang: 'fr' as const };
    const res = await exportSite(d, scenes, pieces, fillShell(await tplOf(), brand, 'fr', d, seoPictures(d)), { ...deps, toShare: async () => 'BBBB', toIcon: async () => 'CCCC' });
    const names = saved.map(([n]) => n);
    expect(names.indexOf('creations/index.html')).toBeGreaterThan(names.indexOf('assets/creation-p1.webp'));
    expect(names.indexOf('creations/index.html')).toBeLessThan(names.indexOf('index.html'));
    expect(names.at(-1)).toBe('index.html');
    expect(names).toEqual(expect.arrayContaining([SHARE_ASSET, ICON_ASSET, 'sitemap.xml', 'robots.txt']));
    expect(res.files).toBe(saved.length);
    const text = (n: string) => new TextDecoder().decode(Uint8Array.from(atob(saved.find(([x]) => x === n)![1]), (c) => c.charCodeAt(0)));
    expect(text('index.html')).toContain(`${ORIGIN}/${SHARE_ASSET}`);
    expect(text('creations/index.html')).toContain(`href="${ICON_ASSET}"`);
    // Without the two encoders (an older host), no document names a picture nobody wrote.
    saved.length = 0;
    await exportSite(d, scenes, pieces, fillShell(await tplOf(), brand, 'fr', d, seoPictures(d)), deps);
    expect(saved.map(([n]) => n)).not.toContain(SHARE_ASSET);
    expect(text('index.html')).not.toContain(SHARE_ASSET);
    expect(text('creations/index.html')).not.toContain(ICON_ASSET);
  });
});

describe('the print of the site', () => {
  const settings = (seo: SeoSettings) => ({ ...normalizeSiteSettings({ brand }, 'x'), seo, legal: EMPTY_LEGAL });
  const print = (seo: SeoSettings) => { const s = settings(seo); return sitePrint({ ...siteFields(s), lang: 'fr', untitled: 'x', scenes, pieces }, s, { scenes, pieces }); };
  it('does not move when the slugs of a send are kept: every address stays where it was', () => {
    expect(print({ slugs: { 'c:p1': 'vase-p1', 'c:p2': 'vase-p1-2', 'c:p3': 'bol' } })).toBe(print({}));
  });
  it('moves with the site’s address, a word of hers, a choice of hers', () => {
    const base = print({});
    expect(print({ origin: ORIGIN })).not.toBe(base);
    expect(print({ words: { creations: 'ceramiques' } })).not.toBe(base);
    expect(print({ aiBots: 'closed' })).not.toBe(base);
    expect(print({ slugs: { 'c:p3': 'grand-bol' } })).not.toBe(base);
    expect(print({ visitorLanguage: 'address' })).not.toBe(base);
  });
});
