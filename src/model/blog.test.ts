import { markdownToHtml, normalizePosts, postExcerpt, postFileName, postTitle, readingMinutes, sortPosts } from './blog';

describe('the blog', () => {
  it('turns a note into the page\'s own tags, the title left to the page', () => {
    const html = markdownToHtml('# Mon four\n\nUne **cuisson** à *1280°*.\nDeuxième ligne.\n\n## Les émaux\n\n- bleu\n- vert\n\n1. un\n2. deux\n\n> le feu décide\n\n---');
    expect(html).toBe('<p>Une <strong>cuisson</strong> à <em>1280°</em>.<br>Deuxième ligne.</p><h3>Les émaux</h3><ul><li>bleu</li><li>vert</li></ul><ol><li>un</li><li>deux</li></ol><blockquote><p>le feu décide</p></blockquote><hr>');
  });

  it('keeps a heading that does not open the note', () => {
    expect(markdownToHtml('Bonjour\n\n# Plus bas')).toBe('<p>Bonjour</p><h2>Plus bas</h2>');
  });

  it('lets nothing from the file run on the site', () => {
    const html = markdownToHtml('<script>alert(1)</script> [clic](javascript:alert(1)) [site](https://rosalie.fr) [mail](mailto:a@b.c) ![four](four.jpg) <img src=x onerror=alert(1)>');
    expect(html).not.toMatch(/<script|<img|javascript:/);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('clic');
    expect(html).toContain('<a href="https://rosalie.fr" rel="noopener">site</a>');
    expect(html).toContain('<a href="mailto:a@b.c" rel="noopener">mail</a>');
    expect(html).toContain('four');
  });

  it('names a post by its first heading, else its file', () => {
    expect(postTitle('\n# Le marché de Noël \n\ntexte', 'C:/b/x.md')).toBe('Le marché de Noël');
    expect(postTitle('juste du texte', 'C:\\notes\\Journal du four.md')).toBe('Journal du four');
  });

  it('opens a tile on the first words, without the title or the markup', () => {
    expect(postExcerpt('# Titre\n\nUne **cuisson** au [bois](https://x.fr).\n\n- bûches\n> feu')).toBe('Une cuisson au bois. bûches feu');
    expect(postExcerpt('# Seul titre')).toBe('');
    const long = postExcerpt(`# T\n\n${'mot '.repeat(80)}`, 40);
    expect(long.endsWith('…')).toBe(true);
    expect(long.length).toBeLessThanOrEqual(41);
    expect(long).not.toMatch(/mo…$/);
  });

  it('counts the reading time on the words alone, at 200 a minute', () => {
    const words = (n: number) => Array.from({ length: n }, () => 'mot').join(' ');
    expect(readingMinutes('# Titre\n\n![une très longue légende de photo](<C:/a.jpg> "left")\n\n::pieces{ids="p1"}\n\nDeux mots.')).toBe(1);
    expect(readingMinutes(`# T\n\n${words(200)}`)).toBe(1);
    expect(readingMinutes(`# T\n\n${words(201)}`)).toBe(2);
    expect(readingMinutes(`# T\n\n**${words(399)}** - — 1`)).toBe(2);
    expect(readingMinutes('')).toBe(1);
  });

  it('gives a new post a plain file name that is not taken', () => {
    const taken = new Set(['le-four.md']);
    expect(postFileName('Le four !', (n) => taken.has(n))).toBe('le-four-2.md');
    expect(postFileName('Émaux d\'été', () => false)).toBe('emaux-d-ete.md');
    expect(postFileName('***', () => false)).toBe('article.md');
  });

  it('reads back only posts it can open, once each, newest first', () => {
    const posts = normalizePosts([
      { id: 'a', path: 'C:/b/a.md', date: '2026-09-01' },
      { id: 'a', path: 'C:/b/dup.md', date: '2026-09-02' },
      { id: 'b', path: 'C:/b/b.pdf', date: '2026-09-03' },
      { id: '../c', path: 'C:/b/c.md', date: '2026-09-04' },
      { id: 'd', path: 'C:/b/d.txt', date: 'demain', published: false },
      { id: 'e', path: 'C:/b/e.markdown', date: '2026-10-01' },
    ]);
    expect(posts.map((p) => p.id)).toEqual(['a', 'd', 'e']);
    expect(posts[1]).toEqual({ id: 'd', path: 'C:/b/d.txt', date: '', published: false });
    expect(sortPosts(posts).map((p) => p.id)).toEqual(['e', 'a', 'd']);
    expect(normalizePosts('nope')).toEqual([]);
  });
});
