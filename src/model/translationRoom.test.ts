import { buildSiteData, type Brand } from '../site/buildSite';
import type { Scene } from './types';
import { editEntry, fieldText, fromField, herItems, htmlBlocks, htmlPieces, lineCounts, normalizeTranslation, proposeEntry, readAll, readEntry, roomLines, translated } from './translation';

const brand: Brand = { accent: '#5F5A53', ink: '#2B2926', paper: '#EEECE7', name: 'Atelier', tagline: 'Céramique et plantes', about: 'Je tourne la terre.', email: '', instagram: '', introLine: '', portraitCaption: '', contactNote: '', formspree: '' };

describe('a long text, block by block', () => {
  const html = '<h2>Le four</h2>\n<p>Trois jours de <b>feu</b>.</p><ul><li>bûches</li></ul><figure class="pe-img"><img alt="four"></figure><p>Prix : 40 CHF</p>';

  it('cuts at the top-level blocks and gives every character back', () => {
    expect(htmlBlocks(html)).toEqual(['<h2>Le four</h2>', '<p>Trois jours de <b>feu</b>.</p>', '<ul><li>bûches</li></ul>', '<figure class="pe-img"><img alt="four"></figure>', '<p>Prix : 40 CHF</p>']);
    expect(htmlPieces(html).map((p) => p.s).join('')).toBe(html);
    expect(htmlPieces(html).filter((p) => p.ws).map((p) => p.s)).toEqual(['\n']);
    // Whitespace after the last block is kept too, and never sent as a block.
    expect(htmlPieces('<p>a</p>\n\n').map((p) => p.s).join('')).toBe('<p>a</p>\n\n');
    expect(htmlBlocks('<p>a</p>\n\n')).toEqual(['<p>a</p>']);
    expect(htmlPieces('Un mot \n<p>b</p>').map((p) => p.s)).toEqual(['Un mot', ' \n', '<p>b</p>']);
    // Inline words at the top stay one sentence; a nested block never cuts its parent.
    expect(htmlBlocks('Un <a href="#">lien</a> ici')).toEqual(['Un <a href="#">lien</a> ici']);
    expect(htmlBlocks('<blockquote><p>a</p><p>b</p></blockquote><hr><p>c</p>')).toEqual(['<blockquote><p>a</p><p>b</p></blockquote>', '<hr>', '<p>c</p>']);
  });

  const post = (h: string) => ({ ...buildSiteData({ brand, lang: 'en', today: '2026-11-02', untitled: 'x', scenes: [] as Scene[], pieces: [] }), posts: [{ id: 'four', title: 'Le four', when: '2026-11-01', html: h, excerpt: 'Trois jours', minutes: 1 }] });

  it('a changed price asks for its paragraph again, the paragraphs she read stay read', () => {
    const tr = { lang: 'en' as const, entries: Object.fromEntries(htmlBlocks(html).map((b) => [b, { to: `EN ${b}`, ok: true as const }])) };
    const out = translated(post(html.replace('40 CHF', '45 CHF')), tr).posts![0]!.html;
    expect(out).toContain('EN <p>Trois jours de <b>feu</b>.</p>');
    expect(out).toContain('<p>Prix : 45 CHF</p>');
    expect(out).not.toContain('EN <p>Prix : 45 CHF</p>');
    expect(out).toContain('</h2>\n');
  });

  it('leaves the picture and the grid of pieces the build writes in a post as they are', () => {
    const built = '<p>Mes pots</p><figure class="post-img wide"><img src="assets/post-four-0.webp" alt="four"><figcaption>four</figcaption></figure><div class="post-pieces row"><figure><img src="assets/creation-p1.webp" alt="Pot strié"></figure></div>';
    const items = herItems(post(built));
    expect(items.filter((w) => w.group === 'blog').map((w) => w.text)).toEqual(['Le four', '<p>Mes pots</p>', 'Trois jours']);
    const all = { lang: 'en' as const, entries: { '<p>Mes pots</p>': { to: '<p>My pots</p>', ok: true as const } } };
    expect(translated(post(built), all).posts![0]!.html).toBe(built.replace('<p>Mes pots</p>', '<p>My pots</p>'));
  });

  it('places a text where the site first shows it', () => {
    const d = { ...buildSiteData({ brand, lang: 'en', today: '2026-11-02', untitled: 'x', scenes: [] as Scene[], pieces: [] }), categories: [{ id: 'j', name: 'Jardin' }] };
    const twice = { ...d, rows: [{ name: 'Jardin', scenes: [] }] };
    expect(herItems(twice).filter((w) => w.text === 'Jardin')).toEqual([{ text: 'Jardin', group: 'scenes', where: 'row0' }]);
  });

  it('places each block by its post and its rank', () => {
    const items = herItems(post(html));
    expect(items.find((w) => w.text === '<p>Prix : 40 CHF</p>')).toMatchObject({ group: 'blog', where: 'post:four#4' });
    expect(items.find((w) => w.text === 'Le four')).toMatchObject({ group: 'blog', where: 'post:four:title' });
  });

  it('cuts a whole text read before the blocks, block against block, only when the counts match', () => {
    const whole = '<p>Un</p><p>Deux</p>';
    const out = normalizeTranslation({ lang: 'en', entries: { [whole]: { to: '<p>One</p><p>Two</p>', ok: true, by: 'local:q', at: 'about' } } }, 'fr')!;
    expect(out.entries).toEqual({ '<p>Un</p>': { to: '<p>One</p>', ok: true, by: 'local:q', at: 'about#0' }, '<p>Deux</p>': { to: '<p>Two</p>', ok: true, by: 'local:q', at: 'about#1' } });
    const off = normalizeTranslation({ lang: 'en', entries: { [whole]: { to: '<p>One. Two.</p>', ok: true } } }, 'fr')!;
    expect(off.entries).toEqual({ [whole]: { to: '<p>One. Two.</p>', ok: true } });
  });
});

describe('the translation room', () => {
  const words = [
    { text: 'Céramique et plantes', group: 'about' as const, where: 'tagline' },
    { text: 'Vase bleu', group: 'creations' as const, where: 'piece:p1:name' },
    { text: 'Vase p2', group: 'creations' as const, where: 'piece:p2:name' },
    { text: 'Jardin', group: 'creations' as const, where: 'cat:j' },
    { text: 'Table', group: 'scenes' as const, where: 'scene:s1:name' },
  ];
  const tr = { lang: 'en' as const, entries: {
    'Céramique et plantes': { to: 'Ceramics and plants', ok: true as const, by: 'local:q' },
    'Vase p2': { to: 'Vase p2 EN', by: 'cloud:mnemo-cloud' },
    Jardin: { to: 'My garden', ok: true as const, ed: true as const },
    // « Vase vert » renamed « Vase bleu »: the old translation sat at the same place.
    'Vase vert': { to: 'Green vase', ok: true as const, at: 'piece:p1:name' },
  } };

  it('says each line state, a rewritten sentence as stale with its old translation', () => {
    const lines = roomLines(words, tr);
    expect(lines.map((l) => l.state)).toEqual(['read', 'stale', 'proposed', 'edited', 'missing']);
    expect(lines[1]!.old).toEqual({ from: 'Vase vert', entry: tr.entries['Vase vert'] });
    expect(lineCounts(lines)).toEqual({ missing: 1, stale: 1, proposed: 1, read: 1, edited: 1, total: 5 });
  });
  it('a proposal never overwrites what she read', () => {
    expect(proposeEntry(tr, 'Céramique et plantes', 'Other', 'local:x', 'tagline')).toBe(tr);
    expect(proposeEntry(tr, 'Table', 'Table EN', 'local:x', 'scene:s1:name').entries.Table).toEqual({ to: 'Table EN', by: 'local:x', at: 'scene:s1:name' });
    expect(proposeEntry(tr, 'Table', '  ', 'local:x', 'scene:s1:name')).toBe(tr);
  });
  it('a new translation lets the stale one it replaces go, and never another line of the same place', () => {
    const next = proposeEntry(tr, 'Vase bleu', 'Blue vase', 'local:q', 'piece:p1:name', 'Vase vert');
    expect(next.entries['Vase vert']).toBeUndefined();
    expect(Object.keys(next.entries).sort()).toEqual(['Céramique et plantes', 'Jardin', 'Vase bleu', 'Vase p2']);
    expect(editEntry(tr, 'Vase bleu', 'Blue', 'piece:p1:name', 'Vase vert').entries['Vase vert']).toBeUndefined();
    // Two current strings at one place (a row and a category both named « Jardin »): the read one stays.
    const shared = { lang: 'en' as const, entries: { Jardin: { to: 'Garden', ok: true as const, at: 'row0' }, Terrasse: { to: 'Old', at: 'row0' } } };
    expect(proposeEntry(shared, 'Patio', 'Patio EN', 'local:q', 'row0').entries.Jardin).toEqual(shared.entries.Jardin);
    expect(editEntry(shared, 'Patio', 'Patio', 'row0').entries.Jardin).toEqual(shared.entries.Jardin);
    // Replacing itself never deletes the line being written.
    expect(proposeEntry(tr, 'Table', 'Table EN', 'local:q', 'scene:s1:name', 'Table').entries.Table!.to).toBe('Table EN');
  });
  it('her own words are read and marked hers; emptied, the line is gone', () => {
    expect(editEntry(tr, 'Vase p2', 'Vase number two', 'piece:p2:name').entries['Vase p2']).toEqual({ to: 'Vase number two', ok: true, ed: true, at: 'piece:p2:name', by: 'cloud:mnemo-cloud' });
    expect(editEntry(tr, 'Vase p2', 'Vase p2 EN', 'piece:p2:name')).toBe(tr);
    expect(editEntry(tr, 'Vase p2', ' ', 'piece:p2:name').entries['Vase p2']).toBeUndefined();
  });
  it('ticks one, or a whole widget, and never an empty line', () => {
    expect(readEntry(tr, 'Vase p2', true).entries['Vase p2']!.ok).toBe(true);
    expect(readEntry(tr, 'Céramique et plantes', false).entries['Céramique et plantes']).toEqual({ to: 'Ceramics and plants', by: 'local:q' });
    expect(readEntry(tr, 'Table', true)).toBe(tr);
    const blank = { lang: 'en' as const, entries: { Table: { to: '  ' } } };
    expect(readEntry(blank, 'Table', true)).toBe(blank);
    expect(readAll(blank, ['Table']).entries.Table!.ok).toBeUndefined();
    const all = readAll(tr, ['Vase p2', 'Table', 'Jardin']);
    expect(all.entries['Vase p2']!.ok).toBe(true);
    expect(all.entries.Table).toBeUndefined();
    expect(all.entries.Jardin).toEqual(tr.entries.Jardin);
  });
  it('keeps who made a line, her edit, its place; a proposal with its model never goes online', () => {
    const back = normalizeTranslation({ lang: 'en', entries: { a: { to: 'b', by: 'local:q', ed: true, at: 'x', ok: true }, c: { to: 'd', by: 7 } } }, 'fr')!;
    expect(back.entries).toEqual({ a: { to: 'b', ok: true, by: 'local:q', ed: true, at: 'x' }, c: { to: 'd' } });
    const data = buildSiteData({ brand, lang: 'en', today: '2026-11-02', untitled: 'x', scenes: [] as Scene[], pieces: [] });
    const proposedOnly = { lang: 'en' as const, entries: { 'Céramique et plantes': { to: 'Ceramics', by: 'local:q', at: 'tagline' } } };
    expect(translated(data, proposedOnly).brand.tagline).toBe('Céramique et plantes');
  });
});

describe('her legal pages', () => {
  const legal = { owner: 'Claire', status: '', siret: '', address: '', phone: '', director: '', hostName: '', hostAddress: '', notice: false, credit: true, noticeText: '# Mentions\n\nÉditée par Claire.', privacyText: '' };
  it('are hers once she rewrote them, never while they are made from her fields', () => {
    const d = buildSiteData({ brand, lang: 'en', today: '2026-11-02', untitled: 'x', scenes: [] as Scene[], pieces: [], legal });
    const legalWords = herItems(d).filter((w) => w.group === 'legal');
    expect(legalWords.map((w) => w.text)).toEqual(['<h2>Mentions</h2>', '<p>Éditée par Claire.</p>']);
    expect(legalWords.every((w) => w.where.startsWith('legal:'))).toBe(true);
  });
});

describe('the field of a block', () => {
  it('shows the words inside their element and puts them back in it', () => {
    expect(fieldText('<p>Prix : 40 CHF</p>', '<p>Price: 40 CHF</p>')).toBe('Price: 40 CHF');
    expect(fieldText('<h2>Le four</h2>', '<p>The kiln</p>')).toBe('<p>The kiln</p>');
    expect(fieldText('Vase bleu', 'Blue vase')).toBe('Blue vase');
    expect(fromField('<p>Prix : 40 CHF</p>', ' Price: 40 CHF ')).toBe('<p>Price: 40 CHF</p>');
    expect(fromField('<p>a</p>', '<p>b</p>')).toBe('<p>b</p>');
    expect(fromField('<p>a</p>', '<b>Bold</b> start')).toBe('<p><b>Bold</b> start</p>');
    expect(fromField('<p>a</p>', '  ')).toBe('  ');
    expect(fromField('Vase', 'Vase EN')).toBe('Vase EN');
  });
});
