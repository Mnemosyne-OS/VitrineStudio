/**
 * Did the room move? (doc 145 §4 rule 2)
 *
 * The piece is an EDIT of the place: outside the piece and its shadow, the
 * pixels must stay. Measured on the first 38 pictures: a good edit changes
 * 0.7 % to 6.8 % of the pixels, the one where the model replaced a bathtub by
 * the reference's table changed 17.7 %. Above the line the screen says the
 * room may have moved; it never decides for the person.
 *
 * Pure: two RGBA buffers of the same size in, a share out.
 */

/** A luminance step under this is compression noise, not a change. */
export const PIXEL_STEP = 20;
/** Above this share, the screen warns that the room may have moved. */
export const DECOR_WARN_SHARE = 0.12;

/** Share (0 to 1) of pixels whose luminance moved by more than `step`. Null when the sizes differ. */
export function changedShare(a: Uint8ClampedArray, b: Uint8ClampedArray, step: number = PIXEL_STEP): number | null {
  if (a.length !== b.length || a.length === 0 || a.length % 4 !== 0) return null;
  let changed = 0;
  const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const la = 0.299 * a[i]! + 0.587 * a[i + 1]! + 0.114 * a[i + 2]!;
    const lb = 0.299 * b[i]! + 0.587 * b[i + 1]! + 0.114 * b[i + 2]!;
    if (Math.abs(la - lb) > step) changed++;
  }
  return changed / n;
}
