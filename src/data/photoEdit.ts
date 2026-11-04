/**
 * Making a creation's photo better, at three prices (Tony, 2026-10-11):
 *
 * - CUT OUT, free: the image engine on this machine (Theia's matte) lifts the
 *   piece off its background. Its pixels are the photo's own: nothing invented.
 * - ON A PLAIN COLOUR, free too: the cut-out piece laid by the studio itself on
 *   a colour, with a soft shadow under it. No model at all.
 * - A NEW BACKGROUND, paid: an edit on the credit route. The model may change
 *   the piece a little, so the person looks before keeping it.
 * - CROPPED AND TURNED, free (2026-11-03): drawn by the studio on a canvas.
 *
 * The original is never touched: every result is a new file.
 */
import { sdk } from './host';
import { saveImageBase64 } from './photos';
import { dataUrlPayload } from './bytes';
import { scaleLine, type PieceShow } from '../model/showcase';
import { cropPixels, turnedSize, WHOLE, type PhotoFrame, type QuarterTurns } from '../model/photoFrame';

/** Minutes on a CPU the first time (the engine prepares its model); main's own bound is longer. */
const CUTOUT_TIMEOUT_MS = 16 * 60_000;

/**
 * The piece lifted off its background, as a new PNG with transparency. Throws the host's code.
 * `phrases` name what to lift (doc 189): the host's phrase matte answers when the person
 * turned it on in Mnemosyne, its salient matte otherwise. A host from before ignores them.
 */
export async function cutOut(path: string, phrases?: string[]): Promise<string> {
  try {
    const payload = phrases && phrases.length > 0 ? { path, phrases } : { path };
    const res = await sdk.invoke<{ path?: string; by?: string; phraseRefused?: string }>('image.removeBackground', payload, CUTOUT_TIMEOUT_MS);
    if (!res?.path) throw new Error('NO_PICTURE_RETURNED');
    if (phrases && res.by !== 'phrase') console.info(`[vitrine-studio] cut by the salient matte (${res.phraseRefused ?? 'host without the phrase matte'})`);
    return res.path;
  } catch (err) {
    // A Mnemosyne from before this action answers that it does not know it.
    if (err instanceof Error && /not supported/i.test(err.message)) throw new Error('CUTOUT_NEEDS_UPDATE');
    throw err;
  }
}

/** The colours offered first; any other through the picker. */
export const PLAIN_COLOURS = ['#ffffff', '#f3efe8', '#e6e1d8', '#d9d4cc', '#1f1d1a'];

/** The cut-out picture as a drawable image. */
function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // A picture that never answers ends in a refusal, never a tool spinning forever.
    const late = setTimeout(() => reject(new Error('PICTURE_UNDECODABLE')), 15_000);
    img.onload = () => { clearTimeout(late); resolve(img); };
    img.onerror = () => { clearTimeout(late); reject(new Error('PICTURE_UNDECODABLE')); };
    img.src = src;
  });
}

/**
 * The cut-out piece on a plain colour, a soft shadow under it, the same size
 * as the photo. `read` gives the cut-out's data URL (the host's reader).
 * Resolves the new file's path.
 */
export async function onPlainColour(cutoutPath: string, colour: string, shadow: boolean, read: (path: string) => Promise<string>, stem: string): Promise<string> {
  const img = await load(await read(cutoutPath));
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS');
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (shadow) {
    const unit = Math.max(canvas.width, canvas.height);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = unit * 0.035;
    ctx.shadowOffsetY = unit * 0.012;
  }
  ctx.drawImage(img, 0, 0);
  const url = canvas.toDataURL('image/jpeg', 0.93);
  return saveImageBase64(`${stem}.jpg`, dataUrlPayload(url));
}

/**
 * The picture turned by `frame.turns` quarters, then cut to `frame.crop`,
 * drawn at `scale` of its size. One drawing for the preview and the saved file.
 */
function drawFramed(img: HTMLImageElement, frame: PhotoFrame, scale: number): HTMLCanvasElement {
  const w0 = img.naturalWidth, h0 = img.naturalHeight;
  const turned = turnedSize(w0, h0, frame.turns);
  const r = cropPixels(frame.crop, turned.w, turned.h);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(r.w * scale));
  canvas.height = Math.max(1, Math.round(r.h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS');
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);
  ctx.translate(-r.x, -r.y);
  // Each case puts the turned picture's top-left corner at (0, 0).
  if (frame.turns === 1) { ctx.translate(turned.w, 0); ctx.rotate(Math.PI / 2); }
  else if (frame.turns === 2) { ctx.translate(w0, h0); ctx.rotate(Math.PI); }
  else if (frame.turns === 3) { ctx.translate(0, turned.h); ctx.rotate(-Math.PI / 2); }
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/** The longest side of the preview the crop is drawn on: the full picture is only drawn once, on save. */
const PREVIEW_SIDE = 1600;

/** The whole photo turned, small, to draw the crop on. Its size gives the crop's pixel ratio. */
export async function turnedPreview(dataUrl: string, turns: QuarterTurns): Promise<{ url: string; width: number; height: number }> {
  const img = await load(dataUrl);
  const turned = turnedSize(img.naturalWidth, img.naturalHeight, turns);
  const canvas = drawFramed(img, { turns, crop: WHOLE }, Math.min(1, PREVIEW_SIDE / Math.max(turned.w, turned.h)));
  return { url: canvas.toDataURL('image/jpeg', 0.9), width: turned.w, height: turned.h };
}

/**
 * The photo turned and cropped, as a new file at full size. A PNG stays a PNG
 * (a cut-out keeps its transparency), anything else is saved as JPEG.
 * `read` gives the photo's data URL (the host's reader). Resolves the new path.
 */
export async function reframe(path: string, frame: PhotoFrame, read: (path: string) => Promise<string>, stem: string): Promise<string> {
  const src = await read(path);
  const png = src.startsWith('data:image/png');
  const canvas = drawFramed(await load(src), frame, 1);
  const url = png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.93);
  return saveImageBase64(`${stem}.${png ? 'png' : 'jpg'}`, dataUrlPayload(url));
}

/** Backgrounds offered for the paid edit, by their key; the words sent are English, the label is hers. */
export const BACKDROPS: Record<string, string> = {
  wood: 'a light oak wooden table, softly blurred room behind',
  linen: 'a natural beige linen cloth, folds softly lit',
  marble: 'a white marble surface with subtle grey veins',
  concrete: 'a smooth light grey concrete surface, minimal',
  shelf: 'a simple shelf in a bright, calm living room',
  garden: 'outdoors on a stone ledge, green garden softly blurred behind',
};
export const BACKDROP_KEYS = Object.keys(BACKDROPS);

/** What the paid edit asks: the piece exactly kept, only what is behind it changed. */
export function backdropPrompt(where: string, size?: PieceShow['size']): string {
  const scale = scaleLine(size);
  return [
    'Product photograph. Keep the product exactly as it is: same shape, proportions, colours, texture, glaze and every detail, same position and size in the frame.',
    `Replace only the background and the surface it stands on with: ${where.trim()}.`,
    'Soft natural light consistent with the product, a realistic contact shadow under it. No text, no other object in front of the product.',
    ...(scale ? [scale] : []),
  ].join(' ');
}
