/**
 * The blocks of the post editor that are not text: a picture set beside the
 * paragraph after it (or across the page), and a block of the studio's pieces.
 *
 * In the page they are `contenteditable="false"` elements that carry what the
 * file needs in `data-*` (model/blogEdit reads only that), and a dressing the
 * editor adds: the picture itself, the pieces' photos and names, a few
 * buttons. The dressing is rebuilt from the data, never read back.
 */
import type { ImageLayout, PiecesLayout } from '../model/blog';
import type { Piece } from '../model/types';

export interface BlockLabels {
  left: string;
  right: string;
  full: string;
  row: string;
  column: string;
  remove: string;
  gone: string;
  up: string;
  down: string;
  drag: string;
  caption: string;
}

/** The direct child of the page that holds `node`, or null. */
export function blockOf(page: HTMLElement, node: Node | null): HTMLElement | null {
  let n: Node | null = node;
  while (n && n.parentNode !== page) n = n.parentNode;
  return n && n.nodeType === 1 ? (n as HTMLElement) : null;
}

/** A new picture block, with nothing dressed yet. */
export function imageBlock(path: string, layout: ImageLayout, alt = ''): HTMLElement {
  const fig = document.createElement('figure');
  fig.className = `pe-img ${layout}`;
  fig.contentEditable = 'false';
  fig.dataset.path = path;
  fig.dataset.layout = layout;
  fig.dataset.alt = alt;
  fig.appendChild(document.createElement('img')).alt = alt;
  return fig;
}

/** A new block of pieces, with nothing dressed yet. */
export function piecesBlock(ids: string[], layout: PiecesLayout): HTMLElement {
  const div = document.createElement('div');
  div.className = `pe-pieces ${layout}`;
  div.contentEditable = 'false';
  div.dataset.ids = ids.join(',');
  div.dataset.layout = layout;
  return div;
}

/**
 * Puts a block in the page next to the block holding `at`: a picture goes
 * BEFORE it (it sits beside that paragraph), pieces go AFTER it. With nothing
 * to hold on to, at the end. A paragraph always follows, so writing goes on.
 */
export function insertBlock(page: HTMLElement, block: HTMLElement, at: Node | null, where: 'before' | 'after'): void {
  const ref = blockOf(page, at);
  if (ref && where === 'before') page.insertBefore(block, ref);
  else if (ref) page.insertBefore(block, ref.nextSibling);
  else page.appendChild(block);
  if (!block.nextSibling) {
    const p = document.createElement('p');
    p.appendChild(document.createElement('br'));
    page.appendChild(p);
  }
}

function button(act: string, label: string, on = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.act = act;
  b.textContent = label;
  if (on) b.className = 'on';
  return b;
}

/** The handle a block is dragged by (the block itself holds a caption field, which must stay selectable). */
function grip(label: string): HTMLSpanElement {
  const g = document.createElement('span');
  g.className = 'pe-grip';
  g.draggable = true;
  g.title = label;
  g.setAttribute('aria-label', label);
  g.textContent = '⠿';
  return g;
}

/**
 * Applies a button pressed in a block: a picture's place, the pieces' layout,
 * up or down past its neighbour, or out of the page. True when something changed.
 */
export function actOn(block: HTMLElement, act: string): boolean {
  if (act === 'remove') { block.remove(); return true; }
  if (act === 'up') {
    const prev = block.previousElementSibling;
    if (!prev) return false;
    prev.before(block);
    return true;
  }
  if (act === 'down') {
    const next = block.nextElementSibling;
    if (!next) return false;
    next.after(block);
    return true;
  }
  if (block.classList.contains('pe-img') && ['left', 'right', 'full'].includes(act)) {
    block.dataset.layout = act;
    block.className = `pe-img ${act}`;
    return true;
  }
  if (block.classList.contains('pe-pieces') && ['row', 'column'].includes(act)) {
    block.dataset.layout = act;
    block.className = `pe-pieces ${act}`;
    return true;
  }
  return false;
}

/**
 * A dragged block let go over `target`: set before the block under the
 * pointer, or after it when the pointer is in its lower half. True when it moved.
 */
export function moveBlock(page: HTMLElement, block: HTMLElement, target: Node | null, lowerHalf: boolean): boolean {
  const ref = blockOf(page, target);
  if (!ref || ref === block || block.parentNode !== page) return false;
  if (lowerHalf) ref.after(block);
  else ref.before(block);
  if (!block.nextSibling) {
    const p = document.createElement('p');
    p.appendChild(document.createElement('br'));
    page.appendChild(p);
  }
  return true;
}

/** A picture's caption, as the field under it holds it: one line. */
export function setCaption(fig: HTMLElement, text: string): void {
  fig.dataset.alt = text.replace(/[[\]\n\r]/g, ' ').replace(/\s+/g, ' ').trimStart().slice(0, 200);
  const img = fig.querySelector('img');
  if (img && !fig.classList.contains('broken')) img.alt = fig.dataset.alt;
}

/** Dresses every block of the page: pictures read, pieces shown, a caption field, buttons on. */
export function dressBlocks(page: HTMLElement, pieces: Piece[], labels: BlockLabels, read: (path: string) => Promise<string>): void {
  const moves = () => [button('up', labels.up), button('down', labels.down)];
  for (const fig of Array.from(page.querySelectorAll<HTMLElement>('.pe-img'))) {
    fig.querySelector('.pe-ctl')?.remove();
    fig.querySelector('.pe-grip')?.remove();
    const img = fig.querySelector('img') ?? fig.appendChild(document.createElement('img'));
    const path = fig.dataset.path ?? '';
    if (path && img.dataset.for !== path) {
      img.dataset.for = path;
      read(path).then((src) => { img.src = src; }, (err: unknown) => {
        console.warn('[vitrine-studio] a post picture is unreadable:', path, err);
        img.alt = labels.gone;
        fig.classList.add('broken');
      });
    }
    // The caption field stays the same element across dressings: a field rebuilt while typed in loses the caret.
    let cap = fig.querySelector<HTMLInputElement>('input.pe-cap');
    if (!cap) {
      cap = document.createElement('input');
      cap.className = 'pe-cap';
      cap.maxLength = 200;
      fig.appendChild(cap);
    }
    cap.placeholder = labels.caption;
    cap.setAttribute('aria-label', labels.caption);
    if (document.activeElement !== cap) cap.value = fig.dataset.alt ?? '';
    const ctl = document.createElement('span');
    ctl.className = 'pe-ctl';
    const lay = fig.dataset.layout;
    ctl.append(button('left', labels.left, lay === 'left'), button('right', labels.right, lay === 'right'), button('full', labels.full, lay === 'full'), ...moves(), button('remove', labels.remove));
    fig.prepend(grip(labels.drag));
    fig.appendChild(ctl);
  }
  for (const div of Array.from(page.querySelectorAll<HTMLElement>('.pe-pieces'))) {
    div.replaceChildren();
    const ids = (div.dataset.ids ?? '').split(',').filter(Boolean);
    div.appendChild(grip(labels.drag));
    for (const id of ids) {
      const p = pieces.find((x) => x.id === id);
      const item = document.createElement('span');
      item.className = 'pe-piece';
      const img = item.appendChild(document.createElement('img'));
      img.alt = p?.name ?? labels.gone;
      if (p?.photoPath) read(p.photoPath).then((src) => { img.src = src; }, (err: unknown) => console.warn('[vitrine-studio] a piece photo is unreadable:', id, err));
      item.appendChild(document.createElement('span')).textContent = p?.name ?? labels.gone;
      div.appendChild(item);
    }
    const ctl = document.createElement('span');
    ctl.className = 'pe-ctl';
    const lay = div.dataset.layout;
    if (ids.length > 1) ctl.append(button('row', labels.row, lay === 'row'), button('column', labels.column, lay === 'column'));
    ctl.append(...moves(), button('remove', labels.remove));
    div.appendChild(ctl);
  }
}
