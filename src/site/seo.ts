/**
 * What a search engine, a shared link and a reader without script get from
 * the site (doc 145 §10.24). All pure: the plan of the site's addresses, each
 * page's head, its words as plain HTML, the structured data, and the files
 * written beside the page (sitemap.xml, robots.txt, 404.html, one document per
 * address).
 *
 * Three rules hold everything here:
 * - nothing is invented: a field she left empty is left out;
 * - what the site does not show has no address and no line in the sitemap;
 * - an absolute address is only ever made from the site's one known address
 *   (`origin`); without it, no canonical, no sitemap, no structured data.
 */
import type { Lang } from '../model/profiles';
import { AI_BOTS, RESERVED_FOLDERS, WORD_DEFAULTS, slugOf, slugsFor, type AddressWord, type SeoSettings } from '../model/seo';
import type { SiteData } from './buildSite';
import { paletteOf, themeOf } from './themes';

export type SeoKind = 'home' | 'page' | 'creation' | 'post' | 'legal';

/** One address of the site. `id` is what the page's script opens (a page id, `blog-<post>`, `c:<piece>`, '' = the home). */
export interface SeoPage {
  id: string;
  kind: SeoKind;
  /** From the site's root, ending with a slash; '' = the root itself. */
  path: string;
  title: string;
  description: string;
  /** A picture of the site (a relative name), for a shared link. */
  image?: string;
  /** Kept out of the sitemap (a legal page, by default). */
  unlisted?: true;
}

/** What the page's script and the export read about the addresses, written inside the site's data. */
export interface SiteSeo {
  /** The site's one address (`https://…`, no slash at the end); absent before it is known. */
  origin?: string;
  /** '' for the main language, `en/` for the second. */
  prefix: string;
  /** The site's main language (on the main language's plan only). */
  mainLang?: string;
  pages: SeoPage[];
  /** The word over a sold piece. */
  soldWord?: string;
  /** A visitor whose browser speaks the second language is sent to it. */
  follow?: true;
  /** What only the export reads (main language only). */
  cfg?: SeoCfg;
}

export interface SeoCfg {
  noindex?: true;
  aiClosed?: true;
  structured: { business: boolean; products: boolean; articles: boolean };
  verification?: string;
  /** Old paths and where each leads now. */
  redirects?: Array<{ from: string; to: string }>;
  /** The business as her legal notice names it: only what she filled. */
  business?: { address?: string; phone?: string; owner?: string };
  /** The slug of each thing that has one now: the studio keeps them once sent. */
  slugs: Record<string, string>;
}

const WORDS: Record<Lang, { sold: string; notFound: string; notFoundText: string; home: string; pages: string }> = {
  fr: { sold: 'Vendue', notFound: 'Page introuvable', notFoundText: 'Cette page n’existe pas ou n’existe plus.', home: 'Retour à l’accueil', pages: 'Pages' },
  en: { sold: 'Sold', notFound: 'Page not found', notFoundText: 'This page does not exist, or no longer does.', home: 'Back to the home page', pages: 'Pages' },
  es: { sold: 'Vendida', notFound: 'Página no encontrada', notFoundText: 'Esta página no existe o ya no existe.', home: 'Volver al inicio', pages: 'Páginas' },
};

const esc = (s: string | undefined) => (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** The words of some HTML, on one line. */
export function plainText(html: string): string {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

/** A description of at most `max` characters, cut between two words. */
export function excerpt(text: string, max = 160): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.·-]+$/, '')}…`;
}

const safeFolder = (x: string) => ((RESERVED_FOLDERS as readonly string[]).includes(x) ? `page-${x}` : x);

type Creation = SiteData['creations'][number];
const creationsOf = (d: SiteData): Creation[] => [...d.creations, ...(d.pages ?? []).flatMap((p) => p.creations ?? [])];
const postsOf = (d: SiteData) => [...(d.posts ?? []), ...(d.pages ?? []).flatMap((p) => p.posts ?? [])];

/** The home's picture for a shared link: the film's first picture, else the first room. */
export function homeImage(d: SiteData): string | undefined {
  if (d.film) return d.film.poster.l;
  for (const row of [...d.rows, ...(d.pages ?? []).flatMap((p) => p.rows ?? [])]) for (const s of row.scenes) {
    const im = s.images.place ?? s.images.piece ?? s.images.alive;
    if (im) return im.l;
  }
  return d.creations[0]?.images[0];
}

/**
 * Every address of one language of the site, and the slugs in use. `kept` are
 * the slugs already sent (or the main language's, for the second one): an
 * address never moves because a name changed.
 */
export function seoPlan(d: SiteData, lang: Lang, seo: SeoSettings, prefix: string, kept: Readonly<Record<string, string>>): { pages: SeoPage[]; slugs: Record<string, string> } {
  const B = d.brand;
  const T = d.texts;
  const own = (id: string) => seo.meta?.[id] ?? {};
  const fallback = B.tagline || excerpt(plainText(d.aboutHtml ?? B.about ?? ''));
  const home = homeImage(d);
  const page = (id: string, kind: SeoKind, path: string, title: string, words: string, image?: string): SeoPage => ({
    id, kind, path,
    // Her own title replaces the whole of it; else the page's name, then the site's.
    title: (!prefix && own(id).title) || title,
    description: (!prefix && own(id).description) || excerpt(words) || fallback,
    ...(image ?? home ? { image: (image ?? home)! } : {}),
  });
  const about = excerpt(plainText(d.aboutHtml ?? B.about ?? ''));
  const pages: SeoPage[] = [page('', 'home', prefix, B.tagline ? `${B.name} · ${B.tagline}` : B.name, B.tagline ? about || B.introLine : B.introLine)];
  if (seo.addresses === 'single') return { pages, slugs: {} };

  const word = (k: AddressWord) => (!prefix && seo.words?.[k]) || WORD_DEFAULTS[lang][k];
  const named = (title: string) => `${title} · ${B.name}`;
  const taken = new Set<string>(['assets', lang, d.alt?.lang ?? '']);
  const top = (id: string, kind: SeoKind, slug: string, title: string, words: string, image?: string) => {
    // Two pages never share an address: the second keeps its own id.
    // A folder name the host takes for a work folder would have the whole send refused: such a page is filed under « page-… ».
    let s = safeFolder(slugOf(slug) || slugOf(id));
    if (taken.has(s)) s = safeFolder(slugOf(id));
    if (!s || taken.has(s)) return;
    taken.add(s);
    pages.push(page(id, kind, `${prefix}${s}/`, named(title), words, image));
  };
  const pathOf = (id: string) => pages.find((p) => p.id === id)?.path;

  if (d.creations.length) top('creations', 'page', word('creations'), T.creations ?? 'Creations', creationsOf(d).map((c) => c.name ?? c.alt).filter(Boolean).slice(0, 12).join(', '), d.creations[0]!.images[0]);
  if (B.about || d.portrait) top('a-propos', 'page', word('about'), T.about ?? 'About', about, d.portrait);
  if ((d.posts ?? []).length) top('blog', 'page', word('blog'), T.blog ?? 'Blog', (d.posts ?? []).map((p) => p.title).slice(0, 8).join(' · '), d.posts![0]!.cover);
  if (B.email || B.formspree || B.instagram || B.contactNote) top('contact', 'page', word('contact'), T.contact ?? 'Contact', plainText(d.contactHtml ?? B.contactNote ?? ''));
  for (const p of d.pages ?? []) {
    const words = p.html ? plainText(p.html) : p.creations ? p.creations.map((c) => c.name ?? c.alt).filter(Boolean).slice(0, 12).join(', ') : p.posts ? p.posts.map((x) => x.title).slice(0, 8).join(' · ') : '';
    const image = p.photo ?? p.creations?.[0]?.images[0] ?? p.posts?.[0]?.cover ?? p.rows?.[0]?.scenes[0]?.images.place?.l;
    top(p.id, 'page', seo.slugs?.[p.id] ?? p.id, p.title, words, image);
  }
  for (const p of d.legal?.pages ?? []) {
    top(p.id, 'legal', p.id, p.title, plainText(p.html));
    if (!seo.legalInSitemap) pages[pages.length - 1]!.unlisted = true;
  }

  // Each post under the page that lists it.
  const posts = postsOf(d);
  const postSlugs = slugsFor(posts.map((p) => ({ key: `blog-${p.id}`, name: p.title })), kept);
  const listOf = (postId: string) => ((d.posts ?? []).some((p) => p.id === postId) ? 'blog' : (d.pages ?? []).find((pg) => pg.posts?.some((p) => p.id === postId))?.id ?? 'blog');
  for (const p of posts) {
    const base = pathOf(listOf(p.id));
    const s = postSlugs[`blog-${p.id}`];
    if (base && s) pages.push(page(`blog-${p.id}`, 'post', `${base}${s}/`, named(p.title), p.excerpt || plainText(p.html), p.cover));
  }

  // Each creation that gets its page, and the sold ones that keep theirs.
  const all = [...creationsOf(d), ...(d.sold ?? [])];
  // A page only for a creation whose NAME she shows: the page's title, its heading and its address are that name,
  // and a name she hides stays hidden. A sold piece keeps its page only under a Creations page that still exists.
  const paged = all.filter((c) => !!c.name?.trim() && seo.creationPages !== 'none' && (seo.creationPages !== 'described' || !!c.description) && (!(d.sold ?? []).includes(c) || !!pathOf('creations')));
  const pieceSlugs = slugsFor(paged.map((c) => ({ key: `c:${c.id}`, name: c.name! })), kept);
  const galleryOf = (c: Creation) => (d.creations.includes(c) || (d.sold ?? []).includes(c) ? 'creations' : (d.pages ?? []).find((pg) => pg.creations?.includes(c))?.id ?? 'creations');
  // Under the Creations page's own address; without that page, under the same word, made safe the same way.
  const piecesBase = pathOf('creations') ?? `${prefix}${safeFolder(word('creations'))}/`;
  for (const c of paged) {
    const s = pieceSlugs[`c:${c.id}`];
    if (!s) continue;
    const facts = [c.description, c.dimensions, c.weight, c.price].filter(Boolean).join(' · ');
    // A creation of an added catalogue lives under that page; the others under the Creations word, page or not.
    const base = galleryOf(c) === 'creations' ? piecesBase : pathOf(galleryOf(c)) ?? piecesBase;
    pages.push(page(`c:${c.id}`, 'creation', `${base}${s}/`, named(c.name!), facts, c.images[0]));
  }
  return { pages, slugs: { ...postSlugs, ...pieceSlugs } };
}

/**
 * The site's data with its addresses: the main language's plan, then the
 * second's on the same slugs. `origin` is the one address of the site, when known.
 */
export function withSeo(data: SiteData, lang: Lang, seo: SeoSettings, business?: SeoCfg['business']): SiteData {
  const main = seoPlan(data, lang, seo, '', seo.slugs ?? {});
  const origin = seo.origin;
  const follow = seo.visitorLanguage !== 'address' && data.alt && seo.addresses !== 'single' ? { follow: true as const } : {};
  const redirects = (seo.redirects ?? []).flatMap((r) => {
    const to = main.pages.find((p) => p.id === r.id)?.path;
    return to !== undefined && to !== r.from && !main.pages.some((p) => p.path === r.from) ? [{ from: r.from, to }] : [];
  });
  const filled = business ? Object.fromEntries(Object.entries(business).filter(([, v]) => typeof v === 'string' && v.trim())) : {};
  const cfg: SeoCfg = {
    ...(seo.engines === 'closed' ? { noindex: true as const } : {}),
    ...(seo.aiBots === 'closed' ? { aiClosed: true as const } : {}),
    structured: { business: seo.structured?.business !== false, products: seo.structured?.products !== false, articles: seo.structured?.articles !== false },
    ...(seo.verification ? { verification: seo.verification } : {}),
    ...(redirects.length ? { redirects } : {}),
    ...(Object.keys(filled).length ? { business: filled } : {}),
    slugs: main.slugs,
  };
  const soldWord = (l: Lang, d: SiteData) => ([...creationsOf(d), ...(d.sold ?? [])].some((c) => c.sold) ? { soldWord: WORDS[l].sold } : {});
  const out: SiteData = { ...data, seo: { ...(origin ? { origin } : {}), prefix: '', mainLang: lang, pages: main.pages, ...soldWord(lang, data), ...follow, cfg } };
  if (data.alt && seo.addresses !== 'single') {
    const alt = seoPlan(data.alt.data, data.alt.lang, seo, `${data.alt.lang}/`, main.slugs);
    // Only the pages the main language has too: an address always has its twin.
    const pages = alt.pages.filter((p) => main.pages.some((m) => m.id === p.id));
    out.alt = { lang: data.alt.lang, data: { ...data.alt.data, seo: { ...(origin ? { origin } : {}), prefix: `${data.alt.lang}/`, pages, ...soldWord(data.alt.lang, data.alt.data), ...follow } } };
  }
  return out;
}

/**
 * What still holds the site back in a search: each entry is something she can
 * fill, named so the studio can lead her to it. Never a score.
 */
export interface SeoTodo { origin: boolean; tagline: boolean; about: boolean; address: boolean; bare: string[]; nameless: number }
export function seoTodo(d: SiteData): SeoTodo {
  const B = d.brand;
  return {
    origin: !d.seo?.origin,
    tagline: !B.tagline?.trim(),
    about: !B.about?.trim(),
    address: !d.seo?.cfg?.business?.address,
    // The creations the site shows with no description: a page of one photo says little to a search engine.
    bare: creationsOf(d).filter((c) => !c.description).map((c) => c.id),
    // The creations whose name is not shown: none of them gets a page of its own.
    nameless: creationsOf(d).filter((c) => !c.name?.trim()).length,
  };
}

// ── One page's head ───────────────────────────────────────────────────────

const OG_LOCALE: Record<string, string> = { fr: 'fr_FR', en: 'en_US', es: 'es_ES' };
const json = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

interface Ctx {
  /** The whole site (main language), with its plan. */
  site: SiteData;
  /** The language being written. */
  d: SiteData;
  lang: string;
  mainLang: string;
  /** Files the export wrote for the head: the shared-link picture, the tab icon. */
  share?: string;
  icon?: string;
}

const absOf = (origin: string, rel: string) => `${origin}/${rel}`;

/** Structured data of one page: only with the site's address, only what she filled. */
export function structuredData(ctx: Ctx, p: SeoPage): unknown[] {
  const { d, site } = ctx;
  const seo = d.seo!, cfg = site.seo!.cfg!;
  const origin = seo.origin;
  if (!origin) return [];
  const B = d.brand;
  const url = absOf(origin, p.path);
  const out: unknown[] = [];
  // The page that lists this one: the one whose address this one's starts with.
  const parentOf = (x: SeoPage) => seo.pages.find((q) => q.kind === 'page' && q.path !== x.path && x.path.startsWith(q.path))?.id ?? '';
  const crumbs = (...ids: string[]) => {
    const items = ids.map((id) => seo.pages.find((x) => x.id === id)).filter((x): x is SeoPage => !!x);
    if (items.length > 1) out.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.kind === 'home' ? B.name : x.title.replace(` · ${B.name}`, ''), item: absOf(origin, x.path) })) });
  };
  if (p.kind === 'home' && cfg.structured.business) {
    const b = cfg.business ?? {};
    const sameAs = (d.socials ?? []).map((s) => s.href);
    out.push({
      '@context': 'https://schema.org',
      // A business with an address is a local one; without, the organisation alone.
      '@type': b.address ? 'LocalBusiness' : 'Organization',
      name: B.name, url,
      ...(B.tagline ? { description: B.tagline } : {}),
      ...(b.address ? { address: b.address.replace(/\s*\n\s*/g, ', ') } : {}),
      ...(b.phone ? { telephone: b.phone } : {}),
      ...(B.email ? { email: B.email } : {}),
      ...(ctx.icon ? { logo: absOf(origin, ctx.icon) } : {}),
      ...(p.image ? { image: absOf(origin, ctx.share ?? p.image) } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    });
    out.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: B.name, url, inLanguage: ctx.lang });
  }
  if (p.kind === 'creation' && cfg.structured.products) {
    const c = [...creationsOf(d), ...(d.sold ?? [])].find((x) => `c:${x.id}` === p.id);
    if (c) {
      out.push({
        '@context': 'https://schema.org', '@type': 'Product', name: c.alt, url,
        image: c.images.map((im) => absOf(origin, im)),
        ...(c.description ? { description: c.description } : {}),
        brand: { '@type': 'Brand', name: B.name },
        // An offer only with a price she shows; a sold piece says so.
        // Its availability only as she set it: sold, or for sale. A piece with no status says nothing.
        ...(c.amount ? { offers: { '@type': 'Offer', price: c.amount[0], priceCurrency: c.amount[1], ...(c.sold ? { availability: 'https://schema.org/SoldOut' } : c.available ? { availability: 'https://schema.org/InStock' } : {}), url } } : {}),
      });
      crumbs('', parentOf(p), p.id);
    }
  }
  if (p.kind === 'post' && cfg.structured.articles) {
    const post = postsOf(d).find((x) => `blog-${x.id}` === p.id);
    if (post) {
      out.push({
        '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, url, mainEntityOfPage: url, inLanguage: ctx.lang,
        ...(post.date ? { datePublished: post.date } : {}),
        ...(post.cover ? { image: absOf(origin, post.cover) } : {}),
        author: { '@type': 'Organization', name: B.name },
      });
      crumbs('', parentOf(p), p.id);
    }
  }
  return out;
}

/** The head of one page, after its title and description. */
export function headTags(ctx: Ctx, p: SeoPage): string {
  const { d, site } = ctx;
  const seo = d.seo!, cfg = site.seo!.cfg!;
  const origin = seo.origin;
  const tags: string[] = [];
  if (cfg.noindex) tags.push('<meta name="robots" content="noindex">');
  if (cfg.verification && p.kind === 'home' && !seo.prefix) tags.push(`<meta name="google-site-verification" content="${esc(cfg.verification)}">`);
  if (ctx.icon) tags.push(`<link rel="icon" type="image/png" href="${esc(ctx.icon)}">`, `<link rel="apple-touch-icon" href="${esc(ctx.icon)}">`);
  const image = p.kind === 'home' || !p.image || p.image === homeImage(d) ? ctx.share ?? p.image : p.image;
  tags.push(`<meta property="og:type" content="${p.kind === 'post' ? 'article' : p.kind === 'creation' ? 'product' : 'website'}">`,
    `<meta property="og:site_name" content="${esc(d.brand.name)}">`,
    `<meta property="og:title" content="${esc(p.title)}">`,
    ...(p.description ? [`<meta property="og:description" content="${esc(p.description)}">`] : []),
    `<meta property="og:locale" content="${esc(OG_LOCALE[ctx.lang] ?? ctx.lang)}">`);
  if (origin) {
    tags.push(`<link rel="canonical" href="${esc(absOf(origin, p.path))}">`, `<meta property="og:url" content="${esc(absOf(origin, p.path))}">`);
    if (image) tags.push(`<meta property="og:image" content="${esc(absOf(origin, image))}">`);
    // Each language names the other, and the main one is what an unknown visitor gets.
    const main = site.seo!.pages.find((x) => x.id === p.id);
    const alt = site.alt?.data.seo?.pages.find((x) => x.id === p.id);
    if (main && alt) {
      tags.push(`<link rel="alternate" hreflang="${esc(ctx.mainLang)}" href="${esc(absOf(origin, main.path))}">`,
        `<link rel="alternate" hreflang="${esc(site.alt!.lang)}" href="${esc(absOf(origin, alt.path))}">`,
        `<link rel="alternate" hreflang="x-default" href="${esc(absOf(origin, main.path))}">`);
    }
  }
  tags.push(`<meta name="twitter:card" content="${origin && image ? 'summary_large_image' : 'summary'}">`);
  for (const o of structuredData(ctx, p)) tags.push(json(o));
  return tags.join('\n');
}

// ── One page's words, as plain HTML ───────────────────────────────────────

/**
 * What the page says, readable without its script: the same words and
 * pictures the script draws. The script removes this block when it starts.
 */
export function staticBody(ctx: Ctx, p: SeoPage): string {
  const { d } = ctx;
  const seo = d.seo!;
  const B = d.brand, T = d.texts;
  const real = seo.pages.length > 1;
  // Every address is written from the site's root: a document deeper than the root carries a <base> that leads there.
  // A real address when the page has one; else the one page's anchor.
  const href = (id: string) => { const x = seo.pages.find((y) => y.id === id); return x ? (real ? x.path || './' : id ? `#${id}` : './') : null; };
  const link = (id: string, text: string) => { const h = href(id); return h ? `<a href="${esc(h)}">${esc(text)}</a>` : esc(text); };
  const img = (src: string | undefined, alt: string) => (src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">` : '');
  const paragraphs = (s: string) => s.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).map((x) => `<p>${esc(x).replace(/\n/g, '<br>')}</p>`).join('');
  const piece = (c: Creation) => {
    const facts = [c.price, c.dimensions, c.weight].filter(Boolean).map(esc).join(' · ');
    const name = c.name ? link(`c:${c.id}`, c.name) : '';
    const pic = img(c.images[0], c.alt);
    return `<figure>${href(`c:${c.id}`) && !c.name ? `<a href="${esc(href(`c:${c.id}`)!)}">${pic}</a>` : pic}${name || facts || c.description ? `<figcaption>${name}${facts ? ` <span>${facts}</span>` : ''}${c.description ? `<p>${esc(c.description)}</p>` : ''}</figcaption>` : ''}</figure>`;
  };
  const gallery = (list: Creation[]) => `<div class="s-grid">${list.map(piece).join('')}</div>`;
  const rooms = (rows: SiteData['rows']) => rows.map((row) => `<section><h2>${esc(row.name)}</h2><div class="s-grid">${row.scenes.map((s) => {
    const im = s.images.place ?? s.images.piece ?? s.images.alive;
    const alt = [s.name !== row.name ? s.name : '', s.piece, T.generated].filter(Boolean).join(' · ');
    return im ? `<figure>${img(im.l, alt)}<figcaption>${esc([s.name !== row.name ? s.name : '', s.piece].filter(Boolean).join(' · '))}</figcaption></figure>` : '';
  }).join('')}</div></section>`).join('');
  const postList = (posts: NonNullable<SiteData['posts']>) => `<ul class="s-posts">${posts.map((x) => `<li>${link(`blog-${x.id}`, x.title)}${x.when ? ` <span>${esc(x.when)}</span>` : ''}${x.excerpt ? `<p>${esc(x.excerpt)}</p>` : ''}</li>`).join('')}</ul>`;

  let body = '';
  const added = (d.pages ?? []).find((x) => x.id === p.id);
  if (p.kind === 'home') {
    body = `<h1>${esc(B.name)}</h1>${B.tagline ? `<p>${esc(B.tagline)}</p>` : ''}${B.introLine ? paragraphs(B.introLine) : ''}${rooms(d.rows)}`;
  } else if (p.kind === 'creation') {
    const c = [...creationsOf(d), ...(d.sold ?? [])].find((x) => `c:${x.id}` === p.id);
    if (c) {
      const specs = (c.specs ?? []).length ? `<table>${c.specs!.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : [c.dimensions, c.weight].filter(Boolean).length ? `<p>${[c.dimensions, c.weight].filter(Boolean).map(esc).join(' · ')}</p>` : '';
      body = `<h1>${esc(c.alt)}</h1>${c.sold && seo.soldWord ? `<p><strong>${esc(seo.soldWord)}</strong></p>` : ''}${c.images.map((im, i) => img(im, i ? `${c.alt} ${i + 1}` : c.alt)).join('')}${c.price ? `<p>${esc(c.price)}${(c.priceAlso ?? []).length ? ` <small>(${c.priceAlso!.map(esc).join(' · ')})</small>` : ''}</p>` : ''}${specs}${c.description ? `<p>${esc(c.description)}</p>` : ''}${href('creations') ? `<p>${link('creations', `← ${T.creations ?? ''}`)}</p>` : ''}`;
    }
  } else if (p.kind === 'post') {
    const post = postsOf(d).find((x) => `blog-${x.id}` === p.id);
    if (post) body = `<article><h1>${esc(post.title)}</h1>${post.when ? `<p>${esc(post.when)}</p>` : ''}${post.html}</article>`;
  } else if (p.kind === 'legal') {
    const lp = d.legal?.pages.find((x) => x.id === p.id);
    if (lp) body = `<h1>${esc(lp.title)}</h1>${lp.html}`;
  } else if (p.id === 'creations') {
    body = `<h1>${esc(T.creations)}</h1>${gallery(d.creations)}`;
  } else if (p.id === 'a-propos') {
    body = `<h1>${esc(T.about)}</h1>${d.aboutHtml ? d.aboutHtml : paragraphs(B.about ?? '')}${img(d.portrait, B.portraitCaption || B.name)}${B.portraitCaption ? paragraphs(B.portraitCaption) : ''}${(d.aboutPhotos ?? []).map((s) => img(s, B.name)).join('')}`;
  } else if (p.id === 'blog') {
    body = `<h1>${esc(T.blog)}</h1>${postList(d.posts ?? [])}`;
  } else if (p.id === 'contact') {
    body = `<h1>${esc(T.contact)}</h1>${d.contactHtml ? d.contactHtml : B.contactNote ? paragraphs(B.contactNote) : ''}${B.email ? `<p><a href="mailto:${esc(B.email)}">${esc(B.email)}</a></p>` : ''}${(d.socials ?? []).length ? `<p>${d.socials!.map((s) => `<a href="${esc(s.href)}" rel="noopener">${esc(s.name)}</a>`).join(' · ')}</p>` : ''}`;
  } else if (added) {
    body = `<h1>${esc(added.title)}</h1>${added.html ? added.html : ''}${img(added.photo, added.title)}${added.creations ? gallery(added.creations) : ''}${added.posts ? postList(added.posts) : ''}${added.rows ? rooms(added.rows) : ''}`;
  }
  // The site's pages, on every page: what the menu and the footer lead to.
  const menu = seo.pages.filter((x) => (x.kind === 'page' || x.kind === 'legal' || x.kind === 'home') && x.id !== p.id);
  const nav = menu.length ? `<nav aria-label="${esc(WORDS[ctx.lang as Lang]?.pages ?? 'Pages')}"><ul>${menu.map((x) => `<li>${link(x.id, x.kind === 'home' ? B.name : x.title.replace(` · ${B.name}`, ''))}</li>`).join('')}</ul></nav>` : '';
  return `<div id="static">${body}${nav}</div>`;
}

// ── The files beside the page ─────────────────────────────────────────────

/** A short print of some text, for a file's cache address. */
function printOf(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** robots.txt: everyone in, the AI crawlers refused by name when she closed them, the sitemap when the address is known. */
export function robotsTxt(seo: SiteSeo): string {
  const lines = ['User-agent: *', 'Allow: /'];
  if (seo.cfg?.aiClosed) for (const bot of AI_BOTS) lines.push('', `User-agent: ${bot}`, 'Disallow: /');
  if (seo.origin && !seo.cfg?.noindex) lines.push('', `Sitemap: ${seo.origin}/sitemap.xml`);
  return `${lines.join('\n')}\n`;
}

/** sitemap.xml: every listed address of both languages, each naming its twin. Null without the site's address, or closed. */
export function sitemapXml(site: SiteData): string | null {
  const seo = site.seo;
  if (!seo?.origin || seo.cfg?.noindex) return null;
  const origin = seo.origin;
  const alt = site.alt?.data.seo;
  const x = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
  const url = (p: SeoPage, twins: Array<[string, string]>) => `  <url>\n    <loc>${x(absOf(origin, p.path))}</loc>\n${twins.map(([l, h]) => `    <xhtml:link rel="alternate" hreflang="${x(l)}" href="${x(h)}"/>\n`).join('')}  </url>`;
  const rows: string[] = [];
  const langOf = seo.mainLang ?? '';
  for (const p of seo.pages.filter((q) => !q.unlisted)) {
    const twin = alt?.pages.find((q) => q.id === p.id);
    const twins: Array<[string, string]> = twin && langOf ? [[langOf, absOf(origin, p.path)], [site.alt!.lang, absOf(origin, twin.path)]] : [];
    rows.push(url(p, twins));
    if (twin) rows.push(url(twin, twins));
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows.join('\n')}\n</urlset>\n`;
}

/** The page shown for an address the site does not have. */
export function notFoundHtml(site: SiteData, lang: Lang): string {
  const w = WORDS[lang];
  // The colours and the letters of the site itself: the theme she chose, her colours unless she asked for its own.
  const B = { ...site.brand, ...paletteOf(site.theme, site.brand) };
  const font = themeOf(site.theme?.id).tokens.font.replace(/, /g, ',');
  const hex = (c: string | undefined, f: string) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : f);
  return `<!doctype html>\n<html lang="${esc(lang)}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="robots" content="noindex">\n<title>${esc(w.notFound)} · ${esc(B.name)}</title>\n<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:${hex(B.paper, '#EEECE7')};color:${hex(B.ink, '#2B2926')};font:300 16px/1.6 ${font};text-align:center;padding:24px}h1{font-weight:400;font-size:28px;margin:0 0 12px}a{color:inherit}</style>\n</head>\n<body>\n<main><h1>${esc(w.notFound)}</h1><p>${esc(w.notFoundText)}</p><p><a href="/">${esc(w.home)} · ${esc(B.name)}</a></p></main>\n</body>\n</html>\n`;
}

/** vercel.json, only when an address moved: the old one leads to the new one for good. */
export function redirectsJson(seo: SiteSeo): string | null {
  const list = seo.cfg?.redirects ?? [];
  if (!list.length) return null;
  // Both spellings of the old address: Vercel matches a source to the letter, and serves a folder
  // with and without its last slash (seen on a real send, 2026-11-10).
  const both = list.flatMap((r) => [r.from.replace(/\/$/, ''), r.from].map((source) => ({ source: `/${source}`, destination: `/${r.to}`, permanent: true })));
  return `${JSON.stringify({ redirects: both }, null, 2)}\n`;
}

const HEAD_OPEN = '<!--seo:head-->', HEAD_CLOSE = '<!--/seo:head-->';
const STATIC_OPEN = '<!--seo:static-->', STATIC_CLOSE = '<!--/seo:static-->';
const between = (s: string, open: string, close: string, put: string) => {
  const a = s.indexOf(open), b = s.indexOf(close);
  return a < 0 || b < a ? s : `${s.slice(0, a + open.length)}${put}${s.slice(b)}`;
};

/** One page's title, description, head and words put into a document made from the shell. */
export function fillPage(doc: string, ctx: Ctx, p: SeoPage): string {
  const main = ctx.site.seo!.pages.length > 1;
  return between(between(doc, HEAD_OPEN, HEAD_CLOSE, `\n${headTags(ctx, p)}\n`), STATIC_OPEN, STATIC_CLOSE, staticBody(ctx, p))
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(p.title)}</title>`)
    // A page with nothing to say of itself carries no description, never an empty one.
    .replace(/<meta name="description" content="[^"]*">\r?\n?/, () => (p.description ? `<meta name="description" content="${esc(p.description)}">\n` : ''))
    // The script reads its language and the main one here; absent on a one-page site, which keeps ?lang=.
    // The root keeps the theme's classes (its menu, its titles): only its language is this page's own.
    .replace(/<html lang="[^"]*"[^>]*>/, (tag) => `<html lang="${esc(ctx.lang)}"${/ class="[a-z -]*"/.exec(tag)?.[0] ?? ''}${main ? ` data-lang="${esc(ctx.lang)}" data-main="${esc(ctx.mainLang)}"` : ''}>`);
}

export interface SeoFile { rel: string; text: string }

/** Every address of the site that is a document of its own, both languages. */
export function seoPaths(site: SiteData): string[] {
  return [...(site.seo?.pages ?? []), ...(site.alt?.data.seo?.pages ?? [])].map((p) => p.path).filter(Boolean);
}

/**
 * What an address the site no longer has becomes: a page that leads on, kept out of search engines.
 * A site folder is only ever written to, never emptied: without this, the page of a creation
 * she removed would stay online as it was.
 */
export function movedHtml(site: SiteData, lang: Lang, to: string): string {
  const B = site.brand;
  const href = `/${to}`;
  const canonical = site.seo?.origin ? `<link rel="canonical" href="${esc(`${site.seo.origin}/${to}`)}">\n` : '';
  return `<!doctype html>\n<html lang="${esc(lang)}">\n<head>\n<meta charset="utf-8">\n<meta name="robots" content="noindex">\n<meta http-equiv="refresh" content="0; url=${esc(href)}">\n${canonical}<title>${esc(B.name)}</title>\n</head>\n<body>\n<p><a href="${esc(href)}">${esc(WORDS[lang].home)} · ${esc(B.name)}</a></p>\n</body>\n</html>\n`;
}

/**
 * Every text file the addresses need, made from the filled shell: one light
 * document per address (the style and the script shared in two files, cached
 * once), then robots.txt, sitemap.xml, 404.html and the redirects. The root
 * `index.html` is not here: it stays the whole page in one file, so the
 * folder still opens from the disk.
 */
export function seoFiles(shell: string, site: SiteData, mainLang: Lang, made: { share?: string; icon?: string } = {}, written: readonly string[] = []): SeoFile[] {
  const seo = site.seo;
  if (!seo) return [];
  const out: SeoFile[] = [];
  const docs: Array<{ p: SeoPage; d: SiteData; lang: string }> = [
    ...seo.pages.filter((p) => p.path !== '').map((p) => ({ p, d: site, lang: mainLang })),
    ...(site.alt?.data.seo?.pages ?? []).map((p) => ({ p, d: site.alt!.data, lang: site.alt!.lang })),
  ];
  if (docs.length) {
    const s0 = shell.indexOf('<style>'), s1 = shell.lastIndexOf('</style>', shell.indexOf('</head>'));
    const d0 = shell.indexOf('<script type="application/json" id="site-data">');
    const d1 = shell.indexOf('</script>', d0) + '</script>'.length;
    const j0 = shell.indexOf('<script>', d1), j1 = shell.lastIndexOf('</script>');
    if (s0 < 0 || s1 < s0 || d0 < 0 || j0 < 0 || j1 < j0) throw new Error('SITE_SHELL_UNREADABLE');
    const css = shell.slice(s0 + '<style>'.length, s1);
    const js = shell.slice(j0 + '<script>'.length, j1);
    out.push({ rel: 'assets/site.css', text: css }, { rel: 'assets/site.js', text: js });
    const light = `${shell.slice(0, s0)}<link rel="stylesheet" href="assets/site.css?v=${printOf(css)}">${shell.slice(s1 + '</style>'.length, d0)}<script src="assets/site.js?v=${printOf(js)}"></script>${shell.slice(j1 + '</script>'.length)}`;
    for (const { p, d, lang } of docs) {
      const up = '../'.repeat(p.path.split('/').filter(Boolean).length);
      const alt = d !== site;
      // Opened from the disk, a light document cannot read data.json: it hands over to the whole page.
      const bounce = `<script>if(location.protocol==="file:")location.replace(${JSON.stringify(`${up}index.html${alt ? `?lang=${lang}` : ''}${p.id ? `#${p.id}` : ''}`)})</script>`;
      const doc = fillPage(light, { site, d, lang, mainLang, ...made }, p)
        .replace('<meta charset="utf-8">', () => `<meta charset="utf-8">\n${bounce}\n<base href="${up}">`);
      out.push({ rel: `${p.path}index.html`, text: doc });
    }
  }
  // An address written by an earlier send and gone since: written over, leading to where it moved, else to the home.
  const live = new Set(seoPaths(site));
  for (const old of written) {
    if (live.has(old) || !/^[a-z0-9/-]+\/$/.test(old)) continue;
    out.push({ rel: `${old}index.html`, text: movedHtml(site, mainLang, seo.cfg?.redirects?.find((r) => r.from === old)?.to ?? '') });
  }
  out.push({ rel: 'robots.txt', text: robotsTxt(seo) });
  const map = sitemapXml(site);
  if (map) out.push({ rel: 'sitemap.xml', text: map });
  out.push({ rel: '404.html', text: notFoundHtml(site, mainLang) });
  const redirects = redirectsJson(seo);
  if (redirects) out.push({ rel: 'vercel.json', text: redirects });
  return out;
}
