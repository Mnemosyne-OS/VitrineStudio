import { EMPTY_LEGAL, legalMissing, normalizeLegal, siretLooksRight, VERCEL_HOST } from '../model/legal';
import { legalMarkdown, legalPages, LEGAL_PAGE_ID, MNEMOSYNE_URL, PRIVACY_PAGE_ID } from './legalPages';
import { normalizePages } from '../model/pages';

const site = { name: 'Atelier Rosalie', email: 'claire@example.fr', formspree: false, form: true, socials: true, lang: 'fr' as const };
const full = { ...EMPTY_LEGAL, owner: 'Claire L.', status: 'Micro-entrepreneur (EI)', siret: '123 456 789 00012', address: '3 rue des Potiers\n13000 Marseille', ...VERCEL_HOST };

describe('the legal fields', () => {
  it('keep her words, drop what is not text, and default the notice and the credit on', () => {
    const l = normalizeLegal({ owner: 'Claire', siret: 42, notice: false });
    expect(l.owner).toBe('Claire');
    expect(l.siret).toBe('');
    expect(l.notice).toBe(false);
    expect(l.credit).toBe(true);
    expect(normalizeLegal(undefined)).toEqual(EMPTY_LEGAL);
  });
  it('name only what a French site still lacks', () => {
    expect(legalMissing(EMPTY_LEGAL, '')).toEqual(['owner', 'address', 'siret', 'contact', 'host']);
    expect(legalMissing(full, 'a@b.fr')).toEqual([]);
    expect(legalMissing({ ...full, phone: '06' }, '')).toEqual([]);
  });
  it('read a SIRET as 14 digits, spaces allowed', () => {
    expect(siretLooksRight('123 456 789 00012')).toBe(true);
    expect(siretLooksRight('12345')).toBe(false);
  });
});

describe('the legal pages', () => {
  it('say who publishes and who hosts, never a placeholder for an empty field', () => {
    const notice = legalPages(full, site).pages.find((p) => p.id === LEGAL_PAGE_ID)!.html;
    expect(notice).toContain('SIRET : 123 456 789 00012');
    expect(notice).toContain('3 rue des Potiers<br>13000 Marseille');
    expect(notice).toContain('Vercel Inc.');
    expect(notice).not.toContain('intelligence artificielle');
    expect(legalPages(full, { ...site, staged: true }).pages[0]!.html).toContain('intelligence artificielle');
    // A name ending with a dot never doubles the sentence's own.
    expect(notice).toContain('appartiennent à Claire L. Toute');
    const bare = legalPages(EMPTY_LEGAL, site).pages.find((p) => p.id === LEGAL_PAGE_ID)!.html;
    expect(bare).not.toContain('SIRET');
    expect(bare).not.toContain('Hébergement');
    expect(bare).toContain('Atelier Rosalie');
  });
  it('speak of Formspree only when the form sends there, and of no form when there is none', () => {
    const privacy = (s: typeof site) => legalPages(full, s).pages.find((p) => p.id === PRIVACY_PAGE_ID)!.html;
    expect(privacy(site)).not.toContain('Formspree');
    expect(privacy(site)).toContain('logiciel de messagerie');
    expect(privacy({ ...site, formspree: true })).toContain('Formspree');
    expect(privacy({ ...site, form: false, email: '' })).toContain('aucune donnée personnelle');
  });
  it('escape her words', () => {
    const html = legalPages({ ...full, owner: '<b>x</b>' }, site).pages[0]!.html;
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>x</b>');
  });
  it('carry the notice and the credit only when she keeps them on', () => {
    expect(legalPages(full, site).notice).toContain(`#${PRIVACY_PAGE_ID}`);
    expect(legalPages({ ...full, notice: false }, site).notice).toBeUndefined();
    expect(legalPages(full, site).footer).toContain(MNEMOSYNE_URL);
    expect(legalPages({ ...full, credit: false }, site).footer).not.toContain(MNEMOSYNE_URL);
    expect(legalPages({ ...full, credit: false }, site).footer).toContain(`#${LEGAL_PAGE_ID}`);
  });
  it('keep their addresses: an added page never takes them', () => {
    expect(normalizePages([{ id: LEGAL_PAGE_ID, type: 'text', name: 'x' }, { id: PRIVACY_PAGE_ID, type: 'text', name: 'y' }])).toEqual([]);
  });
  it('are drawn by the page, out of the menu, with the footer and the notice', async () => {
    const tpl = (await import('./template.html?raw')).default;
    expect(tpl).toContain("if (D.legal) D.legal.pages.forEach((p) => pages.push({ id: p.id, title: p.title, sub: true,");
    expect(tpl).toContain('<footer class="legal-foot"></footer>');
    expect(tpl).toContain("localStorage.setItem('site-notice-closed', '1')");
  });
});

describe('her own legal pages', () => {
  it('replace the text from the fields once she has written them, and follow the fields until then', () => {
    const own = legalPages({ ...full, noticeText: ['### Qui suis-je', 'Claire, potière.'].join('\n') }, site).pages;
    expect(own[0]!.html).toContain('Claire, potière.');
    expect(own[0]!.html).not.toContain('SIRET');
    expect(own[1]!.html).toContain('Responsable du traitement');
    expect(legalPages({ ...full, noticeText: '   ' }, site).pages[0]!.html).toContain('SIRET');
  });
  it('start from Markdown in which her words stay words', () => {
    const md = legalMarkdown({ ...full, owner: '*Atelier* [x](https://evil.example)' }, site).notice;
    const html = legalPages({ ...full, owner: '*Atelier* [x](https://evil.example)' }, site).pages[0]!.html;
    expect(md.startsWith('### ')).toBe(true);
    expect(html).not.toContain('<em>Atelier</em>');
    expect(html).not.toContain('href="https://evil.example"');
  });
  it('keep the e-mail a link in the Markdown the editor opens', () => {
    expect(legalMarkdown(full, site).privacy).toContain('[claire@example.fr](mailto:claire@example.fr)');
  });
  it('are kept as text, bounded', async () => {
    const { normalizeLegal, LEGAL_PAGE_MAX } = await import('../model/legal');
    expect(normalizeLegal({ privacyText: 'x'.repeat(LEGAL_PAGE_MAX + 10) }).privacyText.length).toBe(LEGAL_PAGE_MAX);
    expect(normalizeLegal({ noticeText: 3 }).noticeText).toBe('');
  });
});

describe('the privacy page when the site counts its visits', () => {
  it('names the counter and no longer says there is no audience measurement', () => {
    const off = legalMarkdown(full, site).privacy;
    const on = legalMarkdown(full, { ...site, measured: true }).privacy;
    expect(off).toContain('aucun outil de mesure');
    expect(off).not.toContain('Vercel Web Analytics');
    expect(on).toContain('### Mesure d’audience');
    expect(on).toContain('Vercel Web Analytics');
    expect(on).not.toContain('aucun outil de mesure');
  });
  it('adds the paragraph to her own text when it does not name the counter, once', () => {
    const own = { ...full, privacyText: ['### Ma page', 'Mes mots.'].join('\n') };
    const page = (l: typeof full, measured: boolean) => legalPages(l, { ...site, measured }).pages.find((p) => p.id === PRIVACY_PAGE_ID)!.html;
    expect(page(own, false)).not.toContain('Vercel Web Analytics');
    expect(page(own, true)).toContain('Mes mots.');
    expect(page(own, true)).toContain('Vercel Web Analytics');
    const named = { ...full, privacyText: 'Mesure par Vercel Web Analytics, à ma façon.' };
    expect(page(named, true).match(/Vercel Web Analytics/g)).toHaveLength(1);
  });
});
