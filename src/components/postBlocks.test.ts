import { actOn, dressBlocks, imageBlock, insertBlock, moveBlock, piecesBlock, setCaption, type BlockLabels } from './postBlocks';
import { buildSiteData } from '../site/buildSite';
import { domToMarkdown } from '../model/blogEdit';
import type { Piece } from '../model/types';

const labels: BlockLabels = { left: 'G', right: 'D', full: 'L', row: 'H', column: 'V', remove: 'X', gone: '?', up: 'U', down: 'B', drag: 'M', caption: 'C' };
const pieces: Piece[] = [
  { schema: 1, id: 'p1', name: 'Vase', kind: 'unique', tags: [], photoPath: 'C:/p1.jpg' },
  { schema: 1, id: 'p2', name: 'Bol', kind: 'unique', tags: [], photoPath: 'C:/p2.jpg' },
];
const page = (html: string) => { const el = document.createElement('div'); el.innerHTML = html; return el; };
const read = () => Promise.resolve('data:image/png;base64,AA==');

describe('the blocks of the post editor', () => {
  it('sets a picture before the paragraph it sits beside, pieces after it, and keeps a line to write on', () => {
    const p = page('<p>un</p><p>deux <b>gras</b></p>');
    insertBlock(p, imageBlock('C:/a.jpg', 'left'), p.querySelector('b')!.firstChild, 'before');
    insertBlock(p, piecesBlock(['p1'], 'row'), p.firstChild!.firstChild, 'after');
    expect(Array.from(p.children).map((c) => c.className || c.tagName)).toEqual(['P', 'pe-pieces row', 'pe-img left', 'P']);
    const end = page('<p>seul</p>');
    insertBlock(end, piecesBlock(['p1'], 'row'), end.firstChild!.firstChild, 'after');
    // The block is not last: a paragraph follows, or the writing could not go on below it.
    expect(end.lastElementChild!.tagName).toBe('P');
  });

  it('writes the file from what a block carries, its buttons and pictures left out', () => {
    const p = page('<p>Texte.</p>');
    insertBlock(p, imageBlock('C:/a b.jpg', 'left'), p.firstChild, 'before');
    insertBlock(p, piecesBlock(['p1', 'p2'], 'row'), p.querySelector('p'), 'after');
    dressBlocks(p, pieces, labels, read);
    expect(p.querySelectorAll('.pe-ctl').length).toBe(2);
    expect(p.querySelector('.pe-pieces')!.textContent).toContain('Vase');
    expect(domToMarkdown(p)).toBe('![](<C:/a b.jpg> "left")\n\nTexte.\n\n::pieces{ids="p1,p2" layout="row"}');
  });

  it('moves a picture, lays out the pieces, removes a block, and dresses again without piling buttons up', () => {
    const p = page('');
    const fig = imageBlock('C:/a.jpg', 'left');
    const row = piecesBlock(['p1', 'p2'], 'row');
    p.append(fig, row);
    expect(actOn(fig, 'right')).toBe(true);
    expect(actOn(row, 'column')).toBe(true);
    // A picture has no layout of pieces, and the reverse.
    expect(actOn(fig, 'column')).toBe(false);
    expect(actOn(row, 'left')).toBe(false);
    dressBlocks(p, pieces, labels, read);
    dressBlocks(p, pieces, labels, read);
    expect(fig.querySelectorAll('.pe-ctl').length).toBe(1);
    expect(fig.querySelector('.on')!.textContent).toBe('D');
    expect(domToMarkdown(p)).toBe('![](<C:/a.jpg> "right")\n\n::pieces{ids="p1,p2" layout="column"}');
    expect(actOn(fig, 'remove')).toBe(true);
    expect(domToMarkdown(p)).toBe('::pieces{ids="p1,p2" layout="column"}');
  });

  it('offers a layout only to more than one piece, and names a piece that is gone', () => {
    const p = page('');
    p.append(piecesBlock(['p1'], 'row'), piecesBlock(['gone'], 'row'));
    dressBlocks(p, pieces, labels, read);
    const [one, gone] = Array.from(p.querySelectorAll('.pe-pieces'));
    expect(Array.from(one!.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['U', 'B', 'X']);
    expect(gone!.textContent).toContain('?');
  });

  it('writes a caption into the file, and shows it under the picture on the site', () => {
    const p = page('<p>Texte.</p>');
    const fig = imageBlock('C:/a.jpg', 'left');
    insertBlock(p, fig, p.firstChild, 'before');
    dressBlocks(p, pieces, labels, read);
    const field = fig.querySelector<HTMLInputElement>('input.pe-cap')!;
    field.value = 'Le four [bois]\n à 1280°  ';
    setCaption(fig, field.value);
    const md = domToMarkdown(p);
    expect(md).toBe('![Le four bois à 1280°](<C:/a.jpg> "left")\n\nTexte.');
    // Dressed again (a button pressed elsewhere): the same field, the caption kept.
    dressBlocks(p, pieces, labels, read);
    expect(fig.querySelectorAll('input.pe-cap')).toHaveLength(1);
    const site = buildSiteData({ brand: { accent: '#000000', ink: '#000000', paper: '#ffffff', name: 'A', tagline: '', about: '', email: '', instagram: '', introLine: '', portraitCaption: '', contactNote: '', formspree: '' }, lang: 'fr', today: '2026-01-01', untitled: 'x', scenes: [], pieces: [], posts: [{ id: 'b', title: 'T', date: '', text: md }] });
    expect(site.posts![0]!.html).toContain('<figcaption>Le four bois à 1280°</figcaption></figure>');
  });

  it('moves a block up and down past its neighbour, never off the page', () => {
    const p = page('<p>a</p><p>b</p>');
    const fig = imageBlock('C:/a.jpg', 'full');
    p.insertBefore(fig, p.lastChild);
    expect(actOn(fig, 'up')).toBe(true);
    expect(domToMarkdown(p)).toBe('![](<C:/a.jpg> "full")\n\na\n\nb');
    expect(actOn(fig, 'up')).toBe(false);
    expect(actOn(fig, 'down')).toBe(true);
    expect(actOn(fig, 'down')).toBe(true);
    expect(actOn(fig, 'down')).toBe(false);
    expect(domToMarkdown(p)).toBe('a\n\nb\n\n![](<C:/a.jpg> "full")');
  });

  it('drops a dragged block before the block under the pointer, or after it from its lower half', () => {
    const p = page('<p>a</p><p>b</p><p>c</p>');
    const block = piecesBlock(['p1'], 'row');
    p.prepend(block);
    expect(moveBlock(p, block, p.children[3]!.firstChild, false)).toBe(true);
    expect(domToMarkdown(p)).toBe('a\n\nb\n\n::pieces{ids="p1" layout="row"}\n\nc');
    expect(moveBlock(p, block, p.children[3]!.firstChild, true)).toBe(true);
    // Last now: a paragraph follows so writing goes on under it.
    expect(p.lastElementChild!.tagName).toBe('P');
    expect(p.children[3]).toBe(block);
    // Over itself, or outside the page: nothing moves.
    expect(moveBlock(p, block, block, true)).toBe(false);
    expect(moveBlock(p, block, null, true)).toBe(false);
  });
});
