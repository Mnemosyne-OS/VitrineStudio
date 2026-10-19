/**
 * Frame sizes for the film's clips (doc 145 §10.7). The video model refuses
 * two frames of different sizes (`FRAMES_DIFFER`), and an edited keyframe can
 * come back a few pixels off (1392 against 1376 on the first film). So every
 * keyframe is MEASURED before the clips, and one that differs is cropped to
 * the first keyframe's size, as a copy: the keyframe itself is never touched.
 */

import { dataUrlPayload } from './bytes';

export interface Size { w: number; h: number }

/**
 * The source rectangle that fills `dst` once scaled, centred: the crop that
 * "cover" makes. Pure, so the rule is tested without a canvas.
 */
export function coverCrop(src: Size, dst: Size): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(dst.w / src.w, dst.h / src.h);
  const sw = dst.w / scale;
  const sh = dst.h / scale;
  return { sx: (src.w - sw) / 2, sy: (src.h - sh) / 2, sw, sh };
}

export const sameSize = (a: Size, b: Size) => a.w === b.w && a.h === b.h;

function load(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('IMAGE_UNREADABLE'));
    img.src = dataUrl;
  });
}

/** A picture's size in pixels. */
export async function frameSize(dataUrl: string): Promise<Size> {
  const img = await load(dataUrl);
  return { w: img.naturalWidth, h: img.naturalHeight };
}

/** The picture cropped and scaled to exactly `size`, as PNG base64. */
export async function conformTo(dataUrl: string, size: Size): Promise<string> {
  const img = await load(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS');
  const c = coverCrop({ w: img.naturalWidth, h: img.naturalHeight }, size);
  ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, 0, 0, size.w, size.h);
  return dataUrlPayload(canvas.toDataURL('image/png'));
}
