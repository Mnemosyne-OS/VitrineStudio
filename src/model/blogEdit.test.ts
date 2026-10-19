import { domToMarkdown, joinPost, splitPost } from './blogEdit';
import { markdownToHtml } from './blog';

const page = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
};

describe('the post editor', () => {
  it('gives back the same Markdown it was opened on', () => {
    const body = [
      'Une **cuisson** au *bois*, ~~trois~~ quatre jours, `1280°`.  \nLigne suivante.',
      '## Les émaux',
      '- bleu\n- vert',
      '1. un\n2. deux',
      '> le feu décide',
      '[le site](https://rosalie.fr)',
      '---',
    ].join('\n\n');
    expect(domToMarkdown(page(markdownToHtml(body, { editor: true })))).toBe(body);
  });

  it('writes what the toolbar and the keyboard make', () => {
    // Enter in a contentEditable makes DIVs; Chromium's bold is <b>.
    const md = domToMarkdown(page('premier<div><b>gras </b>et <i>penché</i></div><div><br></div><h3>Titre</h3><ul><li>a</li><li><strike>b</strike></li></ul><blockquote>cité</blockquote>'));
    expect(md).toBe('premier\n\n**gras** et *penché*\n\n### Titre\n\n- a\n- ~~b~~\n\n> cité');
  });

  it('nests bold and italic on the same words the right way round', () => {
    const md = domToMarkdown(page('<p>une nuit de <em><b>veille</b></em> et <b><i>feu</i></b>.</p>'));
    expect(md).toBe('une nuit de ***veille*** et ***feu***.');
    expect(markdownToHtml(md, { editor: true })).toBe('<p>une nuit de <strong><em>veille</em></strong> et <strong><em>feu</em></strong>.</p>');
  });

  it('keeps her words as words, on the file and on the site', () => {
    const md = domToMarkdown(page('<div>- pas une liste</div><div>2026. Une année</div><div># pas un titre</div><div>5 * 3 = _x_</div>'));
    expect(md).toBe('\\- pas une liste\n\n2026\\. Une année\n\n\\# pas un titre\n\n5 \\* 3 = \\_x\\_');
    // Back on the site, the escapes are the characters themselves.
    expect(markdownToHtml(md, { editor: true })).toBe('<p>- pas une liste</p><p>2026. Une année</p><p># pas un titre</p><p>5 * 3 = _x_</p>');
  });

  it('drops a link that would run, keeps its words', () => {
    expect(domToMarkdown(page('<p><a href="javascript:alert(1)">clic</a> <a href="mailto:a@b.c">mail</a></p>'))).toBe('clic [mail](mailto:a@b.c)');
  });

  it('keeps a picture and a block of pieces as they were placed', () => {
    const body = 'Avant.\n\n![le four](<C:/Users/D/Atelier Rosalie/four.webp> "left")\n\nÀ côté du four.\n\n::pieces{ids="p1,p2" layout="column"}\n\n::pieces{ids="p3" layout="row"}';
    const html = markdownToHtml(body, { editor: true });
    expect(html).toContain('data-path="C:/Users/D/Atelier Rosalie/four.webp" data-layout="left"');
    expect(domToMarkdown(page(html))).toBe(body);
    // The editor's dressing (buttons, thumbnails) never reaches the file.
    const dressed = page(html);
    dressed.querySelector('.pe-pieces')!.innerHTML = '<img src="data:x"><span>Vase</span><button>Ligne</button>';
    expect(domToMarkdown(dressed)).toBe(body);
  });

  it('keeps the properties block Notes writes, out of the title and the page', () => {
    const file = '---\ntitle: C:\\Users\\D\\blog\\test\nspine: EMOTION\ntags: []\n---\n# test de blog\n\nTexte.\n';
    const post = splitPost(file);
    expect(post).toEqual({ front: '---\ntitle: C:\\Users\\D\\blog\\test\nspine: EMOTION\ntags: []\n---\n', title: 'test de blog', body: 'Texte.' });
    expect(joinPost(post.title, post.body, post.front)).toBe(file);
    expect(markdownToHtml(file)).toBe('<p>Texte.</p>');
  });

  it('splits a file into its title and body, and writes it back', () => {
    expect(splitPost('# Le four\n\nTexte.\n')).toEqual({ front: '', title: 'Le four', body: 'Texte.' });
    expect(splitPost('Pas de titre.')).toEqual({ front: '', title: '', body: 'Pas de titre.' });
    expect(joinPost(' Le  four ', 'Texte.')).toBe('# Le four\n\nTexte.\n');
    expect(joinPost('Le four', '')).toBe('# Le four\n\n');
  });
});
