/**
 * Makes a scene's layers in the browser (doc 145 §10.18): the host's matte on
 * the piece and on the life (free, on this machine, about 40 s each the first
 * time, then kept by the host), the three pictures brought to ONE size (two of
 * Atelier Rosalie's scenes had pictures of different sizes: the arithmetic
 * compares pixel to pixel), then model/sceneLayers.ts, then each layer written
 * as a PNG. Nothing of the scene's own pictures is touched.
 */
import { cutOut } from './photoEdit';
import { saveImageBase64 } from './photos';
import { dataUrlPayload } from './bytes';
import { makeLayers, newSceneLayers, type Layer, type LayerFile, type Pixels, type SceneLayers } from '../model/sceneLayers';
import type { Scene } from '../model/types';

/** The layers' working width: the site's large pictures are 1600 to 2560 wide, a layer softer than that is not seen moving. */
export const LAYER_WIDTH = 2048;

/** The steps a scene's layers go through, in order (the screen shows where it is). */
export const LAYER_STEPS = ['cut-piece', 'cut-alive', 'compute', 'save'] as const;
export type LayerStep = (typeof LAYER_STEPS)[number];

export interface LayerDeps {
  /** A picture on disk as a data URL, full size. */
  read: (path: string) => Promise<string>;
  /** The host's matte: a new PNG with transparency. */
  cut: (path: string) => Promise<string>;
  /** Writes a PNG (base64) under a name, answers its path. */
  save: (name: string, base64: string) => Promise<string>;
  now: () => Date;
}

export const layerDeps = (read: (path: string) => Promise<string>): LayerDeps => ({ read, cut: cutOut, save: saveImageBase64, now: () => new Date() });

function decode(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const late = setTimeout(() => reject(new Error('PICTURE_UNDECODABLE')), 20_000);
    img.onload = () => { clearTimeout(late); resolve(img); };
    img.onerror = () => { clearTimeout(late); reject(new Error('PICTURE_UNDECODABLE')); };
    img.src = src;
  });
}

function pixelsOf(img: HTMLImageElement, width: number, height: number): Pixels {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('NO_CANVAS');
  ctx.drawImage(img, 0, 0, width, height);
  return { width, height, data: ctx.getImageData(0, 0, width, height).data };
}

function png(p: Pixels, type: 'image/png' | 'image/webp' = 'image/png'): string {
  const canvas = document.createElement('canvas');
  canvas.width = p.width;
  canvas.height = p.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
  return dataUrlPayload(canvas.toDataURL(type, 0.92));
}

/**
 * The layers of a scene whose three beats exist. Throws a named refusal:
 * NO_BEATS (a beat missing), NO_SUBJECT (the matte found nothing where the
 * beat changed the picture), or the host's own (CUTOUT_NEEDS_UPDATE, …).
 */
export async function makeSceneLayers(scene: Scene, deps: LayerDeps, onStep: (step: LayerStep) => void = () => {}): Promise<SceneLayers> {
  const { place, piece, alive } = scene.images;
  if (!place || !piece || !alive) throw new Error('NO_BEATS');
  onStep('cut-piece');
  const cutPiecePath = await deps.cut(piece);
  onStep('cut-alive');
  const cutAlivePath = await deps.cut(alive);
  onStep('compute');
  const [placeImg, pieceImg, aliveImg, cpImg, caImg] = await Promise.all([place, piece, alive, cutPiecePath, cutAlivePath].map(async (p) => decode(await deps.read(p))));
  const width = Math.min(LAYER_WIDTH, placeImg!.naturalWidth);
  const height = Math.round((placeImg!.naturalHeight * width) / placeImg!.naturalWidth);
  const at = (img: HTMLImageElement) => pixelsOf(img, width, height);
  const made = makeLayers(at(placeImg!), at(pieceImg!), at(aliveImg!), at(cpImg!), at(caImg!));
  if (!made) throw new Error('NO_SUBJECT');
  onStep('save');
  const stem = `${scene.id}-layer-${deps.now().getTime().toString(36)}`;
  const file = async (layer: Layer, name: string): Promise<LayerFile> => ({ path: await deps.save(`${stem}-${name}.png`, png(layer.pixels)), ...layer.box });
  const out: SceneLayers = newSceneLayers({
    from: { place, piece, alive },
    pot: await file(made.pot, 'piece'),
    potAlive: await file(made.potAlive, 'alive'),
    swayMap: await deps.save(`${stem}-sway.png`, png(made.swayMap)),
    // The whole picture: WebP keeps it a few hundred KB where a PNG of 2048 px weighs megabytes.
    room: await deps.save(`${stem}-room.webp`, png(made.room, 'image/webp')),
    pivot: made.pivot,
  }, deps.now());
  if (made.shadowPiece) out.shadowPiece = await file(made.shadowPiece, 'shadow-piece');
  if (made.shadowAlive) out.shadowAlive = await file(made.shadowAlive, 'shadow-alive');
  return out;
}
