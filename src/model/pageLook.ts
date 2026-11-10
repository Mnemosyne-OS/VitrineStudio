/**
 * How a page of words and one picture is laid out on a large screen: the
 * empty space around it, how much room the picture takes beside the words,
 * where the two meet in height, and the picture's shape.
 *
 * Asked on 10/11: margins she can set on the desktop version, and the picture
 * placed where she wants it, because the words and the picture on a
 * 12-column grid left uneven gaps (the words capped at 38em, the picture at
 * 360px, both pushed to the left of their columns). With a look, the two
 * blocks fill their share and the space between them equals the space
 * around them.
 *
 * A page without a look keeps the site of before, exactly. Phones always
 * stack the words and the picture, whatever is set here.
 */

/** The empty space on each side of the page, and between the words and the picture. */
export const PAGE_MARGINS = ['none', 's', 'm', 'l'] as const;
export type PageMargin = (typeof PAGE_MARGINS)[number];
/** How much of the width the picture takes beside the words. */
export const PAGE_SPLITS = ['third', 'half', 'twothirds'] as const;
export type PageSplit = (typeof PAGE_SPLITS)[number];
/** Where the words and the picture meet in height, when they stand side by side. */
export const PAGE_ALIGNS = ['top', 'center', 'bottom'] as const;
export type PageAlign = (typeof PAGE_ALIGNS)[number];
/** The picture's frame: its own shape, or cut to one. */
export const PHOTO_SHAPES = ['natural', 'square', 'portrait', 'landscape'] as const;
export type PhotoShape = (typeof PHOTO_SHAPES)[number];

export interface PageLook {
  margin: PageMargin;
  split: PageSplit;
  align: PageAlign;
  shape: PhotoShape;
}

/** What a page gets when she first touches its layout, and what a new page starts with: balanced. */
export const BALANCED_LOOK: PageLook = { margin: 'm', split: 'half', align: 'center', shape: 'natural' };

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly unknown[]).includes(v) ? (v as T) : fallback);

/** A look read from a file: every part from its closed list, a part it does not know taken from the balanced look. Not an object = no look. */
export function normalizeLook(raw: unknown): PageLook | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  return {
    margin: pick(PAGE_MARGINS, r.margin, BALANCED_LOOK.margin),
    split: pick(PAGE_SPLITS, r.split, BALANCED_LOOK.split),
    align: pick(PAGE_ALIGNS, r.align, BALANCED_LOOK.align),
    shape: pick(PHOTO_SHAPES, r.shape, BALANCED_LOOK.shape),
  };
}

/** The classes the site and the editor put on the page's columns: one per part, read by the CSS. */
export function lookClasses(look: PageLook | undefined): string {
  if (!look) return '';
  return `looked m-${look.margin} s-${look.split} a-${look.align} sh-${look.shape}`;
}

/** An arrangement drawn as a tile: where the picture stands and how much room it takes, in one click. */
export interface LookPreset {
  id: string;
  layout: 'right' | 'left' | 'top' | 'bottom';
  split: PageSplit;
}

/**
 * The arrangements offered first, each a drawing: most pages are one of these.
 * The margin, the height and the shape stay as she set them.
 */
export const LOOK_PRESETS: readonly LookPreset[] = [
  { id: 'textImage', layout: 'right', split: 'half' },
  { id: 'imageText', layout: 'left', split: 'half' },
  { id: 'bigImage', layout: 'right', split: 'twothirds' },
  { id: 'bigText', layout: 'right', split: 'third' },
  { id: 'imageTop', layout: 'top', split: 'half' },
  { id: 'imageBottom', layout: 'bottom', split: 'half' },
];
