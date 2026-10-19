import { LAYERS_MADE, bigParts, changeMask, dilate, layerPaths, layersCurrent, makeLayers, newSceneLayers, normalizeLayers, replacedLayerFiles, type Layer, type Pixels, type SceneLayers } from './sceneLayers';

const W = 200, H = 120;
type Rect = [number, number, number, number];
const inside = (x: number, y: number, [x0, y0, x1, y1]: Rect) => x >= x0 && x < x1 && y >= y0 && y < y1;

/** A picture painted rectangle by rectangle over a grey wall. */
function paint(rects: Array<[Rect, [number, number, number]]>): Pixels {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c: [number, number, number] = [200, 200, 200];
    for (const [r, col] of rects) if (inside(x, y, r)) c = col;
    const o = (y * W + x) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  }
  return { width: W, height: H, data };
}
/** The matte's answer: opaque inside the rectangles, nothing elsewhere. */
function cut(rects: Rect[]): Pixels {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rects.some((r) => inside(x, y, r))) data[(y * W + x) * 4 + 3] = 255;
  return { width: W, height: H, data };
}

const WINDOW: Rect = [150, 5, 195, 50];
const POT: Rect = [90, 60, 110, 90];
const SHADOW: Rect = [78, 84, 96, 96];
const DRIFT: Rect = [10, 10, 20, 20];
const PLANT: Rect = [70, 40, 130, 62];
const LEAF: Rect = [122, 62, 136, 82];

const place = paint([[WINDOW, [240, 240, 240]]]);
// The piece, its shadow, and a patch where the generator drifted far from it.
const piece = paint([[WINDOW, [240, 240, 240]], [SHADOW, [150, 150, 150]], [DRIFT, [120, 120, 120]], [POT, [150, 120, 100]]]);
const alive = paint([[WINDOW, [240, 240, 240]], [SHADOW, [150, 150, 150]], [DRIFT, [120, 120, 120]], [POT, [150, 120, 100]], [PLANT, [60, 160, 60]], [LEAF, [60, 160, 60]]]);
// The matte, a salient-object model, also finds the window.
const cutPiece = cut([POT, WINDOW]);
const cutAlive = cut([POT, PLANT, LEAF, WINDOW]);

const rows = (b: { y: number; h: number }) => [Math.round((b.y / 100) * H), Math.round(((b.y + b.h) / 100) * H)];
const cols = (b: { x: number; w: number }) => [Math.round((b.x / 100) * W), Math.round(((b.x + b.w) / 100) * W)];

describe('a scene in layers', () => {
  const made = makeLayers(place, piece, alive, cutPiece, cutAlive)!;

  it('cuts the piece from the matte only where the beat changed the picture, its edge kept soft', () => {
    // The window the matte also found stays in the room.
    expect(cols(made.pot.box)).toEqual([90, 110]);
    expect(rows(made.pot.box)).toEqual([60, 90]);
    const p = made.pot.pixels;
    // Its outermost pixel at half, inside it whole: the edge belongs to the layer, not to the room.
    expect([p.data[0], p.data[1], p.data[2], p.data[3]]).toEqual([150, 120, 100, 128]);
    const mid = ((p.height >> 1) * p.width + (p.width >> 1)) * 4;
    expect(Array.from(p.data.slice(mid, mid + 4))).toEqual([150, 120, 100, 255]);
  });

  it('keeps the shadow as darkening alone, under the piece and near it, never the drift across the room', () => {
    const s = made.shadowPiece!;
    expect(s).not.toBeNull();
    const [y0] = rows(s.box);
    const [x0] = cols(s.box);
    // Where it fell (rows 84-96), its softening included, and not reaching the patch at x 10-20
    // Outside the pot and its edge band nothing is shaded above where it fell (behind the pot the
    // shade is carried in, hidden at rest by the pot).
    const sx0 = cols(s.box)[0]!;
    const band: Rect = [POT[0] - 4, POT[1] - 4, POT[2] + 4, POT[3] + 4];
    for (let y = y0!; y < 82; y++) for (let x = sx0; x < sx0 + s.pixels.width; x++) {
      if (inside(x, y, band)) continue;
      expect(s.pixels.data[((y - y0!) * s.pixels.width + (x - sx0)) * 4 + 3]).toBe(0);
    }
    expect(x0).toBeGreaterThan(40);
    // Black with an alpha: it lays on any part of the room once moved.
    expect(s.pixels.data[0]).toBe(0);
    expect(Math.max(...Array.from(s.pixels.data).filter((_, i) => i % 4 === 3))).toBeGreaterThan(40);
  });

  it('takes the piece and the life from ONE picture, so what is in front stays in front', () => {
    const [y0] = rows(made.potAlive.box);
    const [, x1] = cols(made.potAlive.box);
    expect(y0).toBeLessThanOrEqual(41);
    expect(x1).toBeGreaterThanOrEqual(135);
  });

  it('lets what is far from the piece sway, and holds what is on it', () => {
    const m = made.swayMap;
    const [bx, by] = [cols(made.potAlive.box)[0]!, rows(made.potAlive.box)[0]!];
    const at = (x: number, y: number) => m.data[((Math.round(y - by)) * m.width + Math.round(x - bx)) * 4]!;
    expect(at(100, 75)).toBe(128);
    expect(at(134, 80)).toBeGreaterThan(200);
    expect(made.pivot).toEqual({ x: (100 / W) * 100, y: (60 / H) * 100 });
  });

  it('leaves the room the generator only redrew a little out of the cut', () => {
    // A bench beside the pot, found by the matte, a little lighter in the new picture.
    const BENCH: Rect = [114, 66, 140, 90];
    const p2 = paint([[WINDOW, [240, 240, 240]], [BENCH, [215, 215, 215]], [POT, [150, 120, 100]]]);
    const p1 = paint([[WINDOW, [240, 240, 240]], [BENCH, [200, 200, 200]]]);
    const m = makeLayers(p1, p2, alive, cut([POT, BENCH]), cutAlive)!;
    expect(cols(m.pot.box)).toEqual([90, 110]);
  });

  it('puts the place back under the subject and its shadow, and keeps the last picture elsewhere', () => {
    const at = (x: number, y: number) => Array.from(made.room.data.slice((y * W + x) * 4, (y * W + x) * 4 + 3));
    expect(at(100, 75)).toEqual([200, 200, 200]); // where the pot stood: the empty place
    expect(at(100, 50)).toEqual([200, 200, 200]); // where the plant grew
    expect(at(70, 50)).toEqual([200, 200, 200]); // the matte's rim the layer drops: no ghost outline of the leaf
    expect(at(85, 92)).toEqual([200, 200, 200]); // where its shadow lay
    expect(at(170, 20)).toEqual([240, 240, 240]); // the window, from the last picture
    expect(at(15, 15)).toEqual([120, 120, 120]); // the drift far away stays as the last picture drew it
  });

  it('at rest, the room under its shadow IS the last picture, even where the generator redrew the room darker next to the subject', () => {
    // Foliage beside the plant, redrawn darker and greener: the shadow finds it, and the place's foliage must not come back there.
    const FOLIAGE: Rect = [52, 30, 68, 40];
    const pl = paint([[WINDOW, [240, 240, 240]], [FOLIAGE, [100, 140, 100]]]);
    const pc = paint([[WINDOW, [240, 240, 240]], [FOLIAGE, [100, 140, 100]], [SHADOW, [150, 150, 150]], [POT, [150, 120, 100]]]);
    const al = paint([[WINDOW, [240, 240, 240]], [FOLIAGE, [70, 110, 70]], [SHADOW, [150, 150, 150]], [POT, [150, 120, 100]], [PLANT, [60, 160, 60]], [LEAF, [60, 160, 60]]]);
    const m = makeLayers(pl, pc, al, cutPiece, cutAlive)!;
    const alpha = (l: Layer | null, x: number, y: number) => {
      if (!l) return 0;
      const [x0] = cols(l.box), [y0] = rows(l.box);
      const lx = x - x0!, ly = y - y0!;
      return lx < 0 || ly < 0 || lx >= l.pixels.width || ly >= l.pixels.height ? 0 : l.pixels.data[(ly * l.pixels.width + lx) * 4 + 3]! / 255;
    };
    expect(alpha(m.shadowAlive, 60, 35)).toBeGreaterThan(0.1);
    let worst = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // The layer, and the matte's faint rim the layer drops: both hidden by the room on purpose.
      if (alpha(m.potAlive, x, y) > 0 || cutAlive.data[(y * W + x) * 4 + 3]! > 0) continue;
      const s = alpha(m.shadowAlive, x, y), o = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(m.room.data[o + c]! * (1 - s) - al.data[o + c]!));
    }
    expect(worst).toBeLessThanOrEqual(3);
  });

  it('keeps each piece whole and as many pieces as the scene has, never the scraps of a redrawn room', () => {
    const field = new Float32Array(20 * 10);
    const fill = (x0: number, y0: number, x1: number, y1: number) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) field[y * 20 + x] = 1; };
    fill(1, 1, 5, 9); fill(7, 1, 11, 9); // two vases, 32 pixels each
    fill(15, 8, 17, 10); // a bench leg, 4 pixels
    const kept = bigParts(field, 20, 10);
    expect(kept[1 * 20 + 2]).toBe(1);
    expect(kept[1 * 20 + 8]).toBe(1);
    expect(kept[8 * 20 + 15]).toBe(0);
  });

  it('makes nothing when a beat shows no subject', () => {
    expect(makeLayers(place, piece, alive, cut([]), cutAlive)).toBeNull();
  });

  it('refuses pictures of two sizes rather than compare the wrong pixels', () => {
    expect(() => changeMask(place, { width: 10, height: 10, data: new Uint8ClampedArray(400) })).toThrow('SIZES_DIFFER');
  });

  it('grows a mask by a square of the radius asked', () => {
    const m = new Uint8Array(25); m[12] = 1;
    expect(Array.from(dilate(m, 5, 5, 1))).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0]);
  });
});

describe('the layers in a scene record', () => {
  const layers: SceneLayers = {
    room: 'C:/l/room.webp',
    from: { place: 'C:/a.png', piece: 'C:/b.png', alive: 'C:/c.png' },
    pot: { path: 'C:/l/pot.png', x: 45, y: 50, w: 10, h: 25 }, potAlive: { path: 'C:/l/pa.png', x: 35, y: 33, w: 33, h: 35 },
    shadowPiece: { path: 'C:/l/sp.png', x: 39, y: 70, w: 9, h: 10 }, swayMap: 'C:/l/map.png', pivot: { x: 50, y: 50 }, made: LAYERS_MADE, madeAt: '2026-10-12T00:00:00Z',
  };
  it('are current only while the three pictures are the ones they were made from', () => {
    expect(layersCurrent(layers, { place: 'C:/a.png', piece: 'C:/b.png', alive: 'C:/c.png' })).toBe(true);
    expect(layersCurrent(layers, { place: 'C:/a.png', piece: 'C:/b2.png', alive: 'C:/c.png' })).toBe(false);
    expect(layersCurrent(undefined, {})).toBe(false);
    // Made the first evening, without the cleaned room: remade.
    expect(layersCurrent({ ...layers, room: undefined }, { place: 'C:/a.png', piece: 'C:/b.png', alive: 'C:/c.png' })).toBe(false);
    // Made before the shadow stopped being put back to the place: remade.
    expect(layersCurrent({ ...layers, made: undefined }, { place: 'C:/a.png', piece: 'C:/b.png', alive: 'C:/c.png' })).toBe(false);
  });
  it('made today, they are current (a layer written without its stamp would be stale at birth)', () => {
    const { made: _m, madeAt: _a, ...parts } = layers;
    const fresh = newSceneLayers(parts, new Date('2026-10-12T05:00:00Z'));
    expect(fresh.madeAt).toBe('2026-10-12T05:00:00.000Z');
    expect(layersCurrent(fresh, { place: 'C:/a.png', piece: 'C:/b.png', alive: 'C:/c.png' })).toBe(true);
  });
  it('read back whole, and a malformed record drops them (they are remade)', () => {
    expect(normalizeLayers(JSON.parse(JSON.stringify(layers)))).toEqual(layers);
    expect(normalizeLayers({ ...layers, pot: { path: 'x', x: 120, y: 0, w: 1, h: 1 } })).toBeUndefined();
    expect(normalizeLayers({ ...layers, from: { place: 'a' } })).toBeUndefined();
  });
  it('name the files new layers replace, and only those', () => {
    const next: SceneLayers = { ...layers, pot: { ...layers.pot, path: 'C:/l/pot2.png' }, room: 'C:/l/room2.webp' };
    expect(replacedLayerFiles(layers, next)).toEqual(['C:/l/pot.png', 'C:/l/room.webp']);
    expect(replacedLayerFiles(undefined, next)).toEqual([]);
    expect(replacedLayerFiles(layers, layers)).toEqual([]);
  });
  it('name every file they own', () => {
    expect(layerPaths(layers)).toEqual(['C:/l/pot.png', 'C:/l/sp.png', 'C:/l/pa.png', 'C:/l/map.png', 'C:/l/room.webp']);
  });
});
