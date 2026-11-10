/** A picture that has not decoded in this time never will (rule 9). */
const DECODE_TIMEOUT_MS = 15_000;
/** One encoding of the largest size the site asks (3 840 px) is well under this. */
const ENCODE_TIMEOUT_MS = 30_000;

/**
 * The last picture decoded, kept for the next call: the export encodes every
 * picture at two widths in a row, and decoding a 4K PNG twice is the slow half.
 * One entry only, so a big site never holds more than one decoded picture.
 */
let lastDecoded: { src: string; img: Promise<HTMLImageElement> } | null = null;
let forget: ReturnType<typeof setTimeout> | undefined;
function decoded(src: string): Promise<HTMLImageElement> {
  // Let go of the picture a few seconds after the last call: an export calls again at once, nothing else does.
  clearTimeout(forget);
  forget = setTimeout(() => { lastDecoded = null; }, 5_000);
  if (lastDecoded?.src !== src) {
    const img = load(src);
    // A failed decode is not kept: the next call tries again.
    img.catch(() => { if (lastDecoded?.img === img) lastDecoded = null; });
    lastDecoded = { src, img };
  }
  return lastDecoded.img;
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('PICTURE_DECODE_TIMEOUT')), DECODE_TIMEOUT_MS);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('PICTURE_UNDECODABLE')); };
    img.src = src;
  });
}

/** The qualities tried, sharpest first, never below 0.5 (banding on the soft walls). */
export function qualityLadder(start: number): number[] {
  return [start, 0.85, 0.78, 0.7, 0.62, 0.55, 0.5].filter((q, i, all) => q <= start && all.indexOf(q) === i);
}

/**
 * The sharpest encoding that fits `maxBytes`. When even the last step does
 * not fit, the smallest one is kept: a picture is never dropped for its
 * weight, and the site's total says what it costs.
 *
 * The asked quality is tried first (with no limit, or a loose one, that is
 * the only encoding). Below it the ladder is searched by halves, since a
 * lower quality is never heavier: at most 4 encodings instead of 7, and each
 * one of a 4K picture is a fraction of a second.
 */
export async function encodeUnder(encode: (q: number) => Promise<Blob>, start: number, maxBytes?: number): Promise<Blob> {
  const ladder = qualityLadder(start);
  const first = await encode(ladder[0]!);
  if (!maxBytes || first.size <= maxBytes) return first;
  let lo = 1;
  let hi = ladder.length - 1;
  let fits: Blob | null = null;
  let lowest: Blob = first;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const blob = await encode(ladder[mid]!);
    if (mid === ladder.length - 1) lowest = blob;
    if (blob.size <= maxBytes) {
      fits = blob;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return fits ?? lowest;
}

/** Draws a decoded picture on a canvas and encodes it; the canvas is released at once. */
async function encodeCanvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, type: 'image/jpeg' | 'image/png', quality?: number): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS');
  draw(ctx);
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ENCODE_TIMEOUT')), ENCODE_TIMEOUT_MS);
    canvas.toBlob((b) => { clearTimeout(timer); resolve(b); }, type, quality);
  });
  canvas.width = 0;
  canvas.height = 0;
  if (!blob || blob.type !== type) throw new Error('ENCODE_NOT_SUPPORTED');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export const SHARE_SIZE = { w: 1200, h: 630 } as const;
/** Where a picture is cut to fill a box: the largest centred part of it with the box's shape. */
export function coverCrop(iw: number, ih: number, bw: number, bh: number): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(bw / iw, bh / ih);
  const sw = Math.min(iw, bw / scale), sh = Math.min(ih, bh / scale);
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}

/**
 * A shared link's picture: 1200 x 630, the picture cut to fill it, as a JPEG
 * (the one format every network and messenger reads). Resolves base64.
 */
export async function toShare(dataUrl: string): Promise<string> {
  const img = await decoded(dataUrl);
  const c = coverCrop(img.naturalWidth, img.naturalHeight, SHARE_SIZE.w, SHARE_SIZE.h);
  return encodeCanvas(SHARE_SIZE.w, SHARE_SIZE.h, (ctx) => ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, 0, 0, SHARE_SIZE.w, SHARE_SIZE.h), 'image/jpeg', 0.86);
}

export const ICON_SIZE = 192;
/** The tab icon as a file: the logo whole inside a transparent square PNG. Resolves base64. */
export async function toIcon(dataUrl: string): Promise<string> {
  const img = await decoded(dataUrl);
  // An SVG with no size of its own decodes at 0 x 0: it is drawn to fill the square.
  const iw = img.naturalWidth || ICON_SIZE, ih = img.naturalHeight || ICON_SIZE;
  const scale = Math.min(ICON_SIZE / iw, ICON_SIZE / ih);
  const w = iw * scale, h = ih * scale;
  return encodeCanvas(ICON_SIZE, ICON_SIZE, (ctx) => ctx.drawImage(img, (ICON_SIZE - w) / 2, (ICON_SIZE - h) / 2, w, h), 'image/png');
}

/**
 * Re-encodes a picture as WebP at most `width` wide, in the cartridge's own
 * canvas: the app ships no image tool, and Chromium encodes WebP natively.
 * Never upscales. Quality 0.85: measured on the first site (09/10), no visible
 * banding on the soft walls these scenes are made of. With `maxBytes`, the
 * quality steps down until the file fits (encodeUnder). Resolves base64.
 */
export async function toWebp(dataUrl: string, width: number, quality = 0.85, maxBytes?: number): Promise<string> {
  const img = await decoded(dataUrl);
  const w = Math.min(width, img.naturalWidth);
  const h = Math.round((img.naturalHeight * w) / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS');
  ctx.drawImage(img, 0, 0, w, h);
  const encode = async (q: number) => {
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WEBP_ENCODE_TIMEOUT')), ENCODE_TIMEOUT_MS);
      canvas.toBlob((b) => { clearTimeout(timer); resolve(b); }, 'image/webp', q);
    });
    if (!blob || blob.type !== 'image/webp') throw new Error('WEBP_NOT_SUPPORTED');
    return blob;
  };
  const blob = await encodeUnder(encode, quality, maxBytes);
  // The canvas's pixels are released now, not whenever the collector passes.
  canvas.width = 0;
  canvas.height = 0;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
