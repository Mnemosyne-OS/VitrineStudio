/**
 * Measures how much the room changed between two pictures, in the browser.
 * The arithmetic is `changedShare` (pure, tested); this file only decodes.
 * Both pictures are drawn at the same small size: the share is about the
 * room, and 256 px wide is plenty to see a moved table, cheap to compute.
 */
import { changedShare } from '../model/decor';

const WIDTH = 256;

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('PICTURE_UNDECODABLE'));
    img.src = src;
  });
}

function pixels(img: HTMLImageElement, height: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS');
  ctx.drawImage(img, 0, 0, WIDTH, height);
  return ctx.getImageData(0, 0, WIDTH, height).data;
}

/** Share of the room that changed (0 to 1), or null when it cannot be measured. */
export async function measureDecorChange(beforeDataUrl: string, afterDataUrl: string): Promise<number | null> {
  const [a, b] = await Promise.all([load(beforeDataUrl), load(afterDataUrl)]);
  if (!a.naturalWidth || !b.naturalWidth) return null;
  const height = Math.max(1, Math.round((WIDTH * a.naturalHeight) / a.naturalWidth));
  return changedShare(pixels(a, height), pixels(b, height));
}
