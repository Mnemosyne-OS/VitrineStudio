import { normalizePages, onPage, pageIdFor } from './pages';
import { normalizePiece, normalizeSiteSettings } from './records';
import { normalizePosts } from './blog';

describe('the added pages', () => {
  it('keeps a known type with a name and an address, and nothing that would take a built-in page', () => {
    expect(normalizePages([
      { id: 'bijoux', type: 'catalogue', name: '  Bijoux  ' },
      { id: 'creations', type: 'catalogue', name: 'x' },
      { id: 'blog-x', type: 'blog', name: 'x' },
      { id: 'wild', type: 'shop', name: 'x' },
      { id: 'bijoux', type: 'blog', name: 'twice' },
      { id: '../etc', type: 'blog', name: 'x' },
    ])).toEqual([{ id: 'bijoux', type: 'catalogue', name: 'Bijoux' }]);
  });

  it('makes a readable address that no page, no record and no built-in page holds', () => {
    expect(pageIdFor("Bijoux d'été", [])).toBe('bijoux-d-ete');
    expect(pageIdFor('Bijoux', ['bijoux', 'bijoux-2'])).toBe('bijoux-3');
    expect(pageIdFor('Blog', [])).toBe('blog-2');
    expect(pageIdFor('!!!', [])).toBe('page');
  });

  it('gives a record without a page, or of a page gone, to the built-in page', () => {
    const pages = [{ id: 'bijoux', type: 'catalogue' as const, name: 'Bijoux' }];
    const recs = [{ id: 'a' }, { id: 'b', pageId: 'bijoux' }, { id: 'c', pageId: 'gone' }];
    expect(onPage(recs, null, pages).map((r) => r.id)).toEqual(['a', 'c']);
    expect(onPage(recs, 'bijoux', pages).map((r) => r.id)).toEqual(['b']);
  });

  it('reads the page of a product, a post, and the pages of the site', () => {
    expect(normalizePiece({ id: 'p', name: 'P', pageId: 'bijoux' })?.pageId).toBe('bijoux');
    expect(normalizePiece({ id: 'p', name: 'P', pageId: '../x' })?.pageId).toBeUndefined();
    expect(normalizePosts([{ id: 'x', path: 'a.md', pageId: 'journal' }])[0]?.pageId).toBe('journal');
    expect(normalizeSiteSettings({ pages: [{ id: 'j', type: 'blog', name: 'Journal' }] }, 'A').pages).toEqual([{ id: 'j', type: 'blog', name: 'Journal' }]);
  });
});

describe('a scene of an added page', () => {
  it('keeps its page when read back', async () => {
    const { normalizeScene } = await import('./records');
    expect(normalizeScene({ id: 's', pieceId: 'p', pageId: 'jardin' })?.pageId).toBe('jardin');
    expect(normalizeScene({ id: 's', pieceId: 'p' })?.pageId).toBeUndefined();
  });
});

describe('a text page and a form page', () => {
  it('keep their own words, picture, layout and fields', () => {
    const [text, form] = normalizePages([
      { id: 'atelier', type: 'text', name: 'L’atelier', text: '## Hello', photo: 'C:/p.jpg', layout: 'left' },
      { id: 'inscription', type: 'form', name: 'Inscription', layout: 'right', fields: [
        { id: 'nom', label: 'Nom', kind: 'text', required: true },
        { id: 'cours', label: 'Cours', kind: 'choice', options: ['Tour', ' ', 'Modelage'] },
        { id: 'vide', label: 'Vide', kind: 'choice', options: [] },
        { id: 'x', label: 'X', kind: 'upload' },
      ] },
    ]);
    expect(text).toEqual({ id: 'atelier', type: 'text', name: 'L’atelier', text: '## Hello', photo: 'C:/p.jpg', layout: 'left' });
    expect(form!.fields).toEqual([{ id: 'nom', label: 'Nom', kind: 'text', required: true }, { id: 'cours', label: 'Cours', kind: 'choice', required: false, options: ['Tour', 'Modelage'] }]);
    expect(form!.layout).toBe('right');
  });

  it("keeps a form on the right and drops what a form cannot be (top); a text page keeps left and top", () => {
    const pages = normalizePages([
      { id: 'a', type: 'form', name: 'A', layout: 'right' },
      { id: 'b', type: 'form', name: 'B', layout: 'top' },
      { id: 'c', type: 'text', name: 'C', layout: 'right' },
      { id: 'd', type: 'text', name: 'D', layout: 'top' },
    ]);
    expect(pages.map((p) => p.layout)).toEqual(['right', undefined, undefined, 'top']);
  });
});
