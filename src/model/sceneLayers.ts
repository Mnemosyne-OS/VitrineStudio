/**
 * A living scene (doc 145 §10.18): the place as one picture, and what each
 * beat ADDS as transparent layers, so the site can fade the piece in over a
 * room that stays still, let the plant sway, and move it all a little with the
 * pointer (Tony, 2026-10-12: « l'effet est trop bien »).
 *
 * Measured on Atelier Rosalie before it was built (layers2.py): the cut-out
 * from the host's matte is clean on leaves; a layer made by DIFFERENCE alone
 * carries a halo of the room, and a pot and a plant taken from two pictures
 * disagree on what is in front. So:
 *
 * - every subject comes from the host's matte, kept only where the beat
 *   CHANGED the picture (the matte is a salient-object model: alone it also
 *   finds the window);
 * - the shadow is a separate layer, only the darkening the beat brought
 *   around and below the subject, as black with an alpha, so it lies on any
 *   part of the room once moved;
 * - the pot and the plant of the last beat are ONE cut of ONE picture, and the
 *   sway is a displacement that grows with the distance from the pot: nothing
 *   is cut in two, so no leaf doubles while it moves.
 *
 * Pure: RGBA buffers in, RGBA layers and boxes out. The browser part (decoding,
 * the matte, writing files) is data/sceneLayersMake.ts.
 */

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Where a layer sits, in % of the picture. */
export interface LayerBox { x: number; y: number; w: number; h: number }

export interface LayerFile extends LayerBox {
  /** The layer's PNG on disk. */
  path: string;
}

export interface SceneLayers {
  /** The pictures they were made from: a beat redone makes them stale. */
  from: { place: string; piece: string; alive: string };
  /** The piece alone, and its shadow (the second beat). */
  pot: LayerFile;
  shadowPiece?: LayerFile;
  /** The piece and the life around it, one cut of one picture, and their shadow (the third beat). */
  potAlive: LayerFile;
  shadowAlive?: LayerFile;
  /** How much each pixel of `potAlive` sways: red 128 = still, 255 = the most. Same box as `potAlive`. */
  swayMap?: string;
  /** Where the life leaves the piece, in % of the picture: the sway's axis. */
  pivot: { x: number; y: number };
  /** The room under the layers: the last picture with the subject and its shadow erased (roomOf). Absent on layers made before it. */
  room?: string;
  /** The arithmetic they were made with (LAYERS_MADE); absent = the first one. */
  made?: number;
  madeAt: string;
}

// ── The constants, measured on Atelier Rosalie's scenes (1600 px wide) ──
/** A channel step under this is the generator's noise, not a change. */
export const CHANGE_STEP = 14;
/**
 * Where the matte is kept: a STRONG change (a new object, not the room the
 * generator redrew a little), grown a few pixels at 1600 px. Seen on a bench
 * scene (2026-10-12): with any change and 40 px, the cut took slats of the bench
 * around the vase, which then slid against the bench of the room.
 */
export const SUBJECT_STEP = 40;
export const REGION_GROW = 12;
/**
 * Where the subject's layer is this opaque, the room under it is all place; under its
 * soft edge, part place, part last picture; outside it, the last picture alone. Put back
 * a few pixels BEYOND the layer (as it was first), the place showed as a pale rim
 * around every leaf.
 */
export const ROOM_CORE = 0.6;
/**
 * Under a shadow this deep and deeper the room is the place again: lightening a contact
 * shadow (alpha 0.6 and more under a pot) blew its colour up into an orange stain. A
 * shadow this deep is a real one, never the generator's drift, which darkens a little.
 */
export const ROOM_DEEP: [number, number] = [0.3, 0.5];
/** How far around the layer the matte's own soft edge (trimmed off the layer) also leaves the room, at 1600 px. */
export const ROOM_RIM = 4;

/**
 * What the room hides of a beat: the matte's whole alpha, faint edge included, but only
 * next to what the layer kept. The rim the layer drops or halves (below EDGE_FLOOR, its last pixel)
 * still holds the leaf's darkest outline: left in the room, it showed as a ghost leaf
 * beside the moved one.
 */
export function roomHides(cut: Pixels, layer: Float32Array): Float32Array {
  const { width, height } = cut;
  const n = width * height;
  const kept = new Uint8Array(n);
  for (let i = 0; i < n; i++) kept[i] = layer[i]! > 0 ? 1 : 0;
  const near = dilate(kept, width, height, scaled(ROOM_RIM, width));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = near[i] ? Math.max(layer[i]!, cut.data[i * 4 + 3]! / 255) : 0;
  return out;
}
/**
 * The ring around the subject where the two pictures' light is compared, and how far
 * that difference is spread, at 1600 px. The ring starts ROOM_GAP out: the matte's rim,
 * trimmed off the layer, still holds the subject's colours (a pot's rim in it turned
 * the whole hole brown).
 */
export const ROOM_GAP = 6;
export const ROOM_RING = 20;
export const ROOM_LIGHT = 40;
/** The most the place's light is moved toward the last picture's, per channel: a light shift, never a repaint. */
export const ROOM_LIGHT_MAX = 30;
/**
 * The arithmetic the layers were made with; layers made by an older one are
 * remade (2: the shadow no longer put back to the place; 3: the cut's soft edge kept in
 * the layer and the shadow carried to it; 4: the shade carried in behind the subject,
 * 2026-10-12).
 */
export const LAYERS_MADE = 4;
/** How far around the subject a shadow may fall, at 1600 px (a plant's shadow on the wall behind it included). */
export const SHADOW_REACH = 110;
/** Above the subject's middle (a shadow on the wall), only a clear darkening counts: faint lines there were the generator's drift. */
export const SHADOW_MIN_HIGH = 0.08;
/** A darkening under this is noise; the deepest kept is this. */
export const SHADOW_MIN = 0.04;
export const SHADOW_MAX = 0.85;
/** How far around the subject its shade is read to fill the wall behind it, at 1600 px. */
export const SHADOW_BEHIND = 80;
/** Alpha under 5 % at a cut's edge is noise of the matte, dropped. */
export const EDGE_FLOOR = 12;
/** Near the pot (px at 1600) nothing sways; past OUTER, all of it. */
export const SWAY_INNER = 18;
export const SWAY_OUTER = 90;

const scaled = (px: number, width: number) => Math.max(1, Math.round((px * width) / 1600));

/** 1 where any channel moved by more than `step` between the two pictures. */
export function changeMask(a: Pixels, b: Pixels, step = CHANGE_STEP): Uint8Array {
  if (a.width !== b.width || a.height !== b.height) throw new Error('SIZES_DIFFER');
  const n = a.width * a.height;
  const out = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const d = Math.max(Math.abs(a.data[p]! - b.data[p]!), Math.abs(a.data[p + 1]! - b.data[p + 1]!), Math.abs(a.data[p + 2]! - b.data[p + 2]!));
    out[i] = d > step ? 1 : 0;
  }
  return out;
}

/** A binary mask grown by `r` pixels (square), in two passes of running counts. */
export function dilate(mask: Uint8Array, width: number, height: number, r: number): Uint8Array {
  if (r <= 0) return mask.slice();
  const tmp = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let count = 0;
    for (let x = 0; x < Math.min(r, width); x++) count += mask[row + x]!;
    for (let x = 0; x < width; x++) {
      if (x + r < width) count += mask[row + x + r]!;
      if (x - r - 1 >= 0) count -= mask[row + x - r - 1]!;
      tmp[row + x] = count > 0 ? 1 : 0;
    }
  }
  const out = new Uint8Array(mask.length);
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = 0; y < Math.min(r, height); y++) count += tmp[y * width + x]!;
    for (let y = 0; y < height; y++) {
      if (y + r < height) count += tmp[(y + r) * width + x]!;
      if (y - r - 1 >= 0) count -= tmp[(y - r - 1) * width + x]!;
      out[y * width + x] = count > 0 ? 1 : 0;
    }
  }
  return out;
}

/** A soft version of a 0..1 field: a box blur of radius `r`, twice (close to a gaussian). */
export function blur(field: Float32Array, width: number, height: number, r: number): Float32Array {
  if (r <= 0) return field.slice();
  const cur = field.slice();
  const tmp = new Float32Array(field.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < height; y++) {
      const row = y * width;
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += cur[row + Math.min(width - 1, Math.max(0, x))]!;
      for (let x = 0; x < width; x++) {
        tmp[row + x] = sum / (2 * r + 1);
        sum += cur[row + Math.min(width - 1, x + r + 1)]! - cur[row + Math.max(0, x - r)]!;
      }
    }
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[Math.min(height - 1, Math.max(0, y)) * width + x]!;
      for (let y = 0; y < height; y++) {
        cur[y * width + x] = sum / (2 * r + 1);
        sum += tmp[Math.min(height - 1, y + r + 1) * width + x]! - tmp[Math.max(0, y - r) * width + x]!;
      }
    }
  }
  return cur;
}

/** A part of the subject smaller than this share of the biggest one is a scrap of the room, not a piece. */
export const PART_SHARE = 0.25;

/**
 * The subject's big parts only: each piece in one hold, and as many pieces as
 * the scene has (four vases on a shelf), but not the scraps of a room the
 * generator redrew (a bench's leg, the end of its seat: seen on a bench scene,
 * they slid away with the vase). A pixel's part is found by its 4 neighbours.
 */
export function bigParts(alpha: Float32Array, width: number, height: number, share = PART_SHARE): Float32Array {
  const n = width * height;
  const label = new Int32Array(n);
  const sizes: number[] = [0];
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (label[i] || alpha[i]! <= 0.3) continue;
    const id = sizes.length;
    let size = 0;
    label[i] = id;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop()!;
      size++;
      const x = j % width;
      const next = [x > 0 ? j - 1 : -1, x < width - 1 ? j + 1 : -1, j - width, j + width];
      for (const k of next) if (k >= 0 && k < n && !label[k] && alpha[k]! > 0.3) { label[k] = id; stack.push(k); }
    }
    sizes.push(size);
  }
  const biggest = Math.max(0, ...sizes);
  const out = new Float32Array(n);
  if (!biggest) return out;
  // The soft edge (alpha under 0.3) goes with the part it touches.
  const keep = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (label[i] && sizes[label[i]!]! >= share * biggest) keep[i] = 1;
  const near = dilate(keep, width, height, 2);
  for (let i = 0; i < n; i++) if (near[i]) out[i] = alpha[i]!;
  return out;
}

/** Where a picture changed STRONGLY from another, grown a little: where the matte may be kept. */
export function strongChange(before: Pixels, after: Pixels): Uint8Array {
  return dilate(changeMask(before, after, SUBJECT_STEP), after.width, after.height, scaled(REGION_GROW, after.width));
}

/**
 * The subject of a beat: the matte's alpha (0..1) kept where the beat changed
 * the picture, its outermost pixel at half, only the faintest rim dropped. The
 * edge stays in the layer: trimmed off (one pixel, and everything under 15 %),
 * it was the room's to show, and showed as a pale contour around every pot.
 */
export function subjectAlpha(cut: Pixels, region: Uint8Array): Float32Array {
  const { width, height } = cut;
  const n = width * height;
  const solid = new Uint8Array(n);
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = region[i] ? cut.data[i * 4 + 3]! : 0;
    a[i] = v < EDGE_FLOOR ? 0 : v / 255;
    solid[i] = a[i]! > 0 ? 0 : 1;
  }
  // The outermost pixel, half: the edge stays soft without carrying a ring of the wall.
  const outside = dilate(solid, width, height, 1);
  for (let i = 0; i < n; i++) if (outside[i]) a[i] = a[i]! * 0.5;
  return a;
}

/**
 * The shadow the beat brought: how much darker the room got, outside the
 * subject and near it (on what the piece stands on, and a clear one on the
 * wall behind it), never across the room, as an alpha for black.
 */
/** Each pixel takes the largest value within `r` (a square), rows then columns. */
function spread(field: Float32Array, width: number, height: number, r: number): Float32Array {
  const tmp = new Float32Array(field.length), out = new Float32Array(field.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let m = 0;
    for (let k = Math.max(0, x - r); k <= Math.min(width - 1, x + r); k++) m = Math.max(m, field[y * width + k]!);
    tmp[y * width + x] = m;
  }
  for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
    let m = 0;
    for (let k = Math.max(0, y - r); k <= Math.min(height - 1, y + r); k++) m = Math.max(m, tmp[k * width + x]!);
    out[y * width + x] = m;
  }
  return out;
}

/**
 * @param edge What the room hides of the subject (`roomHides`): the matte's faint rim
 *   included, never read as a shadow, and given the shadow beside it instead.
 */
export function shadowAlpha(room: Pixels, lit: Pixels, subject: Float32Array, edge: Float32Array = subject): Float32Array {
  const { width, height } = room;
  const n = width * height;
  const seen = new Uint8Array(n);
  let top = -1;
  let bottom = -1;
  for (let i = 0; i < n; i++) {
    if (subject[i]! > 0.3) {
      seen[i] = 1;
      const y = Math.floor(i / width);
      if (top < 0) top = y;
      bottom = y;
    }
  }
  const out = new Float32Array(n);
  if (top < 0) return out;
  const near = dilate(seen, width, height, scaled(SHADOW_REACH, width));
  // The piece's own edge (trimmed off the cut, darker than the wall) is never its shadow.
  const touch = new Uint8Array(n);
  for (let i = 0; i < n; i++) touch[i] = subject[i]! > 0.02 || edge[i]! > 0.02 ? 1 : 0;
  const body = dilate(touch, width, height, 2);
  const from = top + Math.floor((bottom - top) / 2);
  for (let i = 0; i < n; i++) {
    if (!near[i] || body[i]) continue;
    const high = Math.floor(i / width) < from;
    const p = i * 4;
    const lr = 0.299 * room.data[p]! + 0.587 * room.data[p + 1]! + 0.114 * room.data[p + 2]! + 1;
    const ll = 0.299 * lit.data[p]! + 0.587 * lit.data[p + 1]! + 0.114 * lit.data[p + 2]! + 1;
    let dark = Math.min(SHADOW_MAX, Math.max(0, 1 - ll / lr));
    if (dark < (high ? SHADOW_MIN_HIGH : SHADOW_MIN)) dark = 0;
    out[i] = dark * (1 - Math.min(1, subject[i]! * 1.5));
  }
  // Around the subject's edge the shadow beside it carries on: left at 0 there, the room showed
  // the unshadowed place as a white line between a pot and its shadow (Tony, 2026-10-12: « le
  // contour blanc »). Not under the subject's opaque body, which casts no shadow on itself.
  // As far as the band reaches: the matte's rim (up to ROOM_RIM) and the two pixels around it.
  const beside = spread(out, width, height, scaled(ROOM_RIM, width) + 3);
  for (let i = 0; i < n; i++) if (body[i] && near[i] && Math.max(subject[i]!, edge[i]!) < ROOM_CORE) out[i] = beside[i]!;
  // Behind the subject's body: the shade around it, carried in (an average of what the wall shows
  // around, the nearest counting most). Hidden at rest by the piece; when the piece moves, the wall it
  // uncovers is as shaded as the wall beside it, not the bare place (Tony, 2026-10-12: « récupérer
  // l'ombre derrière », pale silhouettes of the leaves beside the moved plant).
  // Read from the wall's raw darkening, the soft shade a pot casts on the wall right around it
  // included (too faint to count as a shadow above, yet what made the uncovered wall look pale),
  // less the darkening the whole picture took (the room is shifted by that much already).
  const raw = new Float32Array(n);
  const drifts: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!near[i] || body[i]) continue;
    const p = i * 4;
    const lr = 0.299 * room.data[p]! + 0.587 * room.data[p + 1]! + 0.114 * room.data[p + 2]! + 1;
    const ll = 0.299 * lit.data[p]! + 0.587 * lit.data[p + 1]! + 0.114 * lit.data[p + 2]! + 1;
    raw[i] = 1 - ll / lr;
    if ((i & 7) === 0) drifts.push(raw[i]!);
  }
  drifts.sort((x, y) => x - y);
  const drift = drifts.length ? drifts[drifts.length >> 1]! : 0;
  const known = new Float32Array(n), val = new Float32Array(n);
  for (let i = 0; i < n; i++) if (near[i] && !body[i]) { known[i] = 1; val[i] = Math.max(out[i]!, Math.min(SHADOW_MAX, Math.max(0, raw[i]! - drift))); }
  const reach = scaled(SHADOW_BEHIND, width);
  const kb = blur(known, width, height, reach), vb = blur(val, width, height, reach);
  for (let i = 0; i < n; i++) if (body[i] && near[i] && Math.max(subject[i]!, edge[i]!) >= ROOM_CORE) out[i] = kb[i]! > 1e-3 ? Math.min(SHADOW_MAX, vb[i]! / kb[i]!) : 0;
  return blur(out, width, height, 1);
}

/** How much each pixel may sway: 0 on and near the piece, 1 far from it. */
export function swayWeight(piece: Float32Array, width: number, height: number): Float32Array {
  const seen = new Uint8Array(piece.length);
  for (let i = 0; i < piece.length; i++) seen[i] = piece[i]! > 0.3 ? 1 : 0;
  const grown = dilate(seen, width, height, scaled(SWAY_INNER, width));
  const field = new Float32Array(piece.length);
  for (let i = 0; i < piece.length; i++) field[i] = grown[i]!;
  const near = blur(field, width, height, scaled((SWAY_OUTER - SWAY_INNER) / 2, width));
  const w = new Float32Array(piece.length);
  for (let i = 0; i < piece.length; i++) w[i] = Math.min(1, Math.max(0, 1 - near[i]! * 1.6));
  return w;
}

/** The smallest box holding every pixel above `min` alpha, or null for an empty layer. */
export function bounds(alpha: Float32Array, width: number, height: number, min = 6 / 255): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x]! > min) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

export interface Layer { pixels: Pixels; box: LayerBox }

/** A layer cut to its box: the colours of `src` (or black for a shadow) under `alpha`. */
export function layerOf(alpha: Float32Array, width: number, height: number, src: Pixels | null): Layer | null {
  const b = bounds(alpha, width, height);
  if (!b) return null;
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (b.y0 + y) * width + b.x0 + x;
      const o = (y * w + x) * 4;
      if (src) { data[o] = src.data[i * 4]!; data[o + 1] = src.data[i * 4 + 1]!; data[o + 2] = src.data[i * 4 + 2]!; }
      data[o + 3] = Math.round(alpha[i]! * 255);
    }
  }
  return { pixels: { width: w, height: h, data }, box: { x: (b.x0 / width) * 100, y: (b.y0 / height) * 100, w: (w / width) * 100, h: (h / height) * 100 } };
}

/** The sway map over a box: red 128 + 127 × weight, green 128 (no vertical push). */
export function swayMapOf(weight: Float32Array, width: number, height: number, box: LayerBox): Pixels {
  const x0 = Math.round((box.x / 100) * width), y0 = Math.round((box.y / 100) * height);
  const w = Math.max(1, Math.round((box.w / 100) * width)), h = Math.max(1, Math.round((box.h / 100) * height));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = Math.min(height - 1, y0 + y) * width + Math.min(width - 1, x0 + x);
      const o = (y * w + x) * 4;
      data[o] = 128 + Math.round(127 * weight[i]!);
      data[o + 1] = 128;
      data[o + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

/**
 * The room under the layers (Tony: « effacer le sujet de l'arrière-plan avec
 * une passe de la photo 1 »). The rule it keeps: at rest, room + shadow + layer
 * IS the last picture, so the only pixels taken from the place are those the
 * subject hides.
 *
 * - Under the subject, never beyond its layer: the place, carried to the last
 *   picture's light by the difference measured on a ring around it (the
 *   generator redraws the whole picture a little lighter or warmer).
 * - Under its shadow: the last picture itself, lightened by the shadow's own
 *   alpha. The shadow layer darkens it back exactly. Under a deep shadow
 *   (ROOM_DEEP), the place again. Seen on a terrace
 *   (2026-10-12): the shadow zone put back to the place's pixels carried the
 *   place's trees into the last picture's foliage, pale patches around the pot.
 */
export function roomOf(place: Pixels, alive: Pixels, subject: Float32Array, shadow: Float32Array): Pixels {
  const { width, height } = alive;
  const n = width * height;
  // The last picture without its shadow (the inverse of black at that alpha).
  const lit = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = 1 / (1 - Math.min(SHADOW_MAX, shadow[i]!));
    for (let c = 0; c < 3; c++) lit[i * 3 + c] = Math.min(255, alive.data[i * 4 + c]! * k);
  }
  const hole = new Uint8Array(n);
  for (let i = 0; i < n; i++) hole[i] = subject[i]! > 0 || shadow[i]! > ROOM_DEEP[0] ? 1 : 0;
  // How far the last picture's light is from the place's, around the hole.
  const near = dilate(hole, width, height, Math.max(2, scaled(ROOM_GAP, width)));
  const around = dilate(hole, width, height, Math.max(4, scaled(ROOM_RING, width)));
  const ring = new Float32Array(n);
  // Only the room the two pictures share counts: never a shadow (lightened, it overshoots), never what
  // the generator drew differently there (an object moved). Measured on a chest of drawers
  // (2026-10-12): the ring through the pots' shadow turned the hole a pale halo brighter than the wall.
  for (let i = 0; i < n; i++) {
    if (!around[i] || near[i] || shadow[i]! > SHADOW_MIN) continue;
    const p = i * 4;
    const drift = Math.max(Math.abs(alive.data[p]! - place.data[p]!), Math.abs(alive.data[p + 1]! - place.data[p + 1]!), Math.abs(alive.data[p + 2]! - place.data[p + 2]!));
    if (drift < SUBJECT_STEP) ring[i] = 1;
  }
  const reach = scaled(ROOM_LIGHT, width);
  const weight = blur(ring, width, height, reach);
  const offset: Float32Array[] = [];
  for (let c = 0; c < 3; c++) {
    const d = new Float32Array(n);
    for (let i = 0; i < n; i++) if (ring[i]) d[i] = lit[i * 3 + c]! - place.data[i * 4 + c]!;
    const sum = blur(d, width, height, reach);
    for (let i = 0; i < n; i++) sum[i] = weight[i]! > 1e-4 ? Math.max(-ROOM_LIGHT_MAX, Math.min(ROOM_LIGHT_MAX, sum[i]! / weight[i]!)) : 0;
    offset.push(sum);
  }
  const data = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const deep = Math.min(1, Math.max(0, (shadow[i]! - ROOM_DEEP[0]) / (ROOM_DEEP[1] - ROOM_DEEP[0])));
    const k = Math.max(deep, Math.min(1, subject[i]! / ROOM_CORE)), p = i * 4;
    for (let c = 0; c < 3; c++) data[p + c] = Math.round(lit[i * 3 + c]! * (1 - k) + (place.data[p + c]! + offset[c]![i]!) * k);
    data[p + 3] = 255;
  }
  return { width, height, data };
}

export interface MadeLayers {
  pot: Layer;
  shadowPiece: Layer | null;
  potAlive: Layer;
  shadowAlive: Layer | null;
  swayMap: Pixels;
  /** The whole picture under the layers (roomOf). */
  room: Pixels;
  pivot: { x: number; y: number };
}

/**
 * All the layers of a scene from its three pictures (same size) and the
 * matte's cut of the last two. Null when a beat shows no subject at all.
 */
export function makeLayers(place: Pixels, piece: Pixels, alive: Pixels, cutPiece: Pixels, cutAlive: Pixels): MadeLayers | null {
  const { width, height } = place;
  const pieceA = bigParts(subjectAlpha(cutPiece, strongChange(place, piece)), width, height);
  // The life: what it ADDED to the second picture, and the piece itself. Not what changed
  // from the place: when the generator redrew the room (a bench at 20 %), that took slats
  // of the bench into the layer, and they slid when the piece moved.
  const added = strongChange(piece, alive);
  const seen = new Uint8Array(pieceA.length);
  for (let i = 0; i < pieceA.length; i++) seen[i] = pieceA[i]! > 0.3 ? 1 : 0;
  const pieceZone = dilate(seen, width, height, scaled(REGION_GROW, width));
  for (let i = 0; i < added.length; i++) if (pieceZone[i]) added[i] = 1;
  // A leaf can hang apart from the rest: the life keeps far smaller parts than the piece does.
  const aliveA = bigParts(subjectAlpha(cutAlive, added), width, height, 0.03);
  const pot = layerOf(pieceA, width, height, piece);
  const potAlive = layerOf(aliveA, width, height, alive);
  if (!pot || !potAlive) return null;
  const hidesPiece = roomHides(cutPiece, pieceA), hidesAlive = roomHides(cutAlive, aliveA);
  const shadowPieceA = shadowAlpha(place, piece, pieceA, hidesPiece);
  const shadowAliveA = shadowAlpha(place, alive, aliveA, hidesAlive);
  const shadowPiece = layerOf(shadowPieceA, width, height, null);
  const shadowAlive = layerOf(shadowAliveA, width, height, null);
  const swayMap = swayMapOf(swayWeight(pieceA, width, height), width, height, potAlive.box);
  // Both beats' subjects leave the room: the piece of the second beat sits a little elsewhere than in the third.
  // The shadow lightened is the last picture's, the one its layer puts back.
  const subject = new Float32Array(pieceA.length);
  for (let i = 0; i < pieceA.length; i++) subject[i] = Math.max(hidesPiece[i]!, hidesAlive[i]!);
  const room = roomOf(place, alive, subject, shadowAliveA);
  return { pot, shadowPiece, potAlive, shadowAlive, swayMap, room, pivot: { x: pot.box.x + pot.box.w / 2, y: pot.box.y } };
}

/**
 * Whether the layers still match the scene's pictures (a beat redone makes them
 * stale), and are of the kind made today: layers without their cleaned room (made
 * the first evening) let the room double when the piece moves, so they are remade.
 */
export function layersCurrent(layers: SceneLayers | undefined, images: Partial<Record<'place' | 'piece' | 'alive', string>>): layers is SceneLayers {
  return !!layers && !!layers.room && (layers.made ?? 1) >= LAYERS_MADE && layers.from.place === images.place && layers.from.piece === images.piece && layers.from.alive === images.alive;
}

/** A scene's layers as written today: stamped with the arithmetic that made them, so `layersCurrent` keeps them. */
export function newSceneLayers(parts: Omit<SceneLayers, 'made' | 'madeAt'>, now: Date): SceneLayers {
  return { ...parts, made: LAYERS_MADE, madeAt: now.toISOString() };
}

/** Every file the layers point at. */
export function layerPaths(layers: SceneLayers | undefined): string[] {
  if (!layers) return [];
  return [layers.pot.path, layers.shadowPiece?.path, layers.potAlive.path, layers.shadowAlive?.path, layers.swayMap, layers.room].filter((p): p is string => !!p);
}

/**
 * The files of layers that new ones replace: theirs alone (named after the scene, made
 * for it), so they go when the new layers are written. Measured 2026-10-12: six files
 * (908 KB) already left behind by one evening of remaking.
 */
export function replacedLayerFiles(before: SceneLayers | undefined, after: SceneLayers | undefined): string[] {
  const kept = new Set(layerPaths(after));
  return layerPaths(before).filter((p) => !kept.has(p));
}

const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 1000 ? v : null);

function readFile(v: unknown): LayerFile | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const path = str(r.path), x = num(r.x, 0, 100), y = num(r.y, 0, 100), w = num(r.w, 0, 100), h = num(r.h, 0, 100);
  return path && x !== null && y !== null && w !== null && h !== null ? { path, x, y, w, h } : null;
}

/** The layers as read from a scene's file; anything malformed drops them whole (they are remade). */
export function normalizeLayers(raw: unknown): SceneLayers | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const f = (r.from && typeof r.from === 'object' ? r.from : {}) as Record<string, unknown>;
  const from = { place: str(f.place), piece: str(f.piece), alive: str(f.alive) };
  const pot = readFile(r.pot), potAlive = readFile(r.potAlive);
  const pv = (r.pivot && typeof r.pivot === 'object' ? r.pivot : {}) as Record<string, unknown>;
  const px = num(pv.x, 0, 100), py = num(pv.y, 0, 100);
  const madeAt = str(r.madeAt);
  if (!from.place || !from.piece || !from.alive || !pot || !potAlive || px === null || py === null || !madeAt) return undefined;
  const out: SceneLayers = { from: { place: from.place, piece: from.piece, alive: from.alive }, pot, potAlive, pivot: { x: px, y: py }, madeAt };
  const sp = readFile(r.shadowPiece), sa = readFile(r.shadowAlive), sm = str(r.swayMap), room = str(r.room);
  if (room) out.room = room;
  const made = num(r.made, 1, 1000);
  if (made !== null) out.made = made;
  if (sp) out.shadowPiece = sp;
  if (sa) out.shadowAlive = sa;
  if (sm) out.swayMap = sm;
  return out;
}
