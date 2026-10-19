// The room under the layers where synthetic pictures used to agree: a deep coloured contact shadow, a window the matte found.
import { makeLayers, type Pixels } from './sceneLayers';

const W = 200, H = 120;
type Rect = [number, number, number, number];
const inside = (x: number, y: number, [x0, y0, x1, y1]: Rect) => x >= x0 && x < x1 && y >= y0 && y < y1;
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
function cut(rects: Rect[]): Pixels {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rects.some((r) => inside(x, y, r))) data[(y * W + x) * 4 + 3] = 255;
  return { width: W, height: H, data };
}
const WINDOW: Rect = [150, 5, 195, 50];
const POT: Rect = [90, 60, 110, 90];
const CONTACT: Rect = [86, 90, 114, 96]; // a deep, WARM contact shadow under the pot
const PLANT: Rect = [70, 40, 130, 62];
const at = (p: Pixels, x: number, y: number) => Array.from(p.data.slice((y * W + x) * 4, (y * W + x) * 4 + 3));

describe('the room under the layers', () => {
  it('under a DEEP coloured contact shadow, the room is the place (grey), never the shadow lightened into a stain', () => {
    const place = paint([[WINDOW, [240, 240, 240]]]);
    const piece = paint([[WINDOW, [240, 240, 240]], [CONTACT, [120, 80, 50]], [POT, [150, 120, 100]]]);
    const alive = paint([[WINDOW, [240, 240, 240]], [CONTACT, [120, 80, 50]], [POT, [150, 120, 100]], [PLANT, [60, 160, 60]]]);
    const m = makeLayers(place, piece, alive, cut([POT, WINDOW]), cut([POT, PLANT, WINDOW]))!;
    const px = at(m.room, 100, 93);
    // Lightening (120,80,50) by its luminance alpha gives about (255,178,111): the orange stain. The place there is grey 200.
    for (const c of px) expect(Math.abs(c - 200)).toBeLessThanOrEqual(12);
    expect(Math.abs(px[0]! - px[2]!)).toBeLessThanOrEqual(12);
  });

  it('a window the matte found but the layer never kept stays the LAST picture, even when the generator redrew it', () => {
    const place = paint([[WINDOW, [240, 240, 240]]]);
    const piece = paint([[WINDOW, [230, 230, 230]], [POT, [150, 120, 100]]]);
    const alive = paint([[WINDOW, [230, 230, 230]], [POT, [150, 120, 100]], [PLANT, [60, 160, 60]]]);
    const m = makeLayers(place, piece, alive, cut([POT, WINDOW]), cut([POT, PLANT, WINDOW]))!;
    expect(at(m.room, 170, 20)).toEqual([230, 230, 230]);
  });

  it('a shadow cast right against the pot reaches its edge: no pale line between the two at rest', () => {
    // The shadow lies on the wall right against the pot.
    const BESIDE: Rect = [110, 60, 124, 90];
    const place = paint([[WINDOW, [240, 240, 240]]]);
    const piece = paint([[WINDOW, [240, 240, 240]], [BESIDE, [140, 140, 140]], [POT, [150, 120, 100]]]);
    const alive = paint([[WINDOW, [240, 240, 240]], [BESIDE, [140, 140, 140]], [POT, [150, 120, 100]], [PLANT, [60, 160, 60]]]);
    // The matte's soft rim: two pixels past the pot at 40 %, as a real cut fades out.
    const soft = (c: Pixels): Pixels => {
      for (let y = POT[1] - 2; y < POT[3] + 2; y++) for (let x = POT[0] - 2; x < POT[2] + 2; x++) if (!inside(x, y, POT)) c.data[(y * W + x) * 4 + 3] = 100;
      return c;
    };
    const m = makeLayers(place, piece, alive, soft(cut([POT, WINDOW])), soft(cut([POT, PLANT, WINDOW])))!;
    const s = m.shadowAlive!;
    const sx0 = Math.round((s.box.x / 100) * W), sy0 = Math.round((s.box.y / 100) * H);
    const alpha = (x: number, y: number) => s.pixels.data[((y - sy0) * s.pixels.width + (x - sx0)) * 4 + 3]! / 255;
    // Just outside the pot, in the matte's rim: the room times its shadow is the wall in shadow, not the bare wall.
    for (const x of [110, 111]) {
      const seen = at(m.room, x, 75)[0]! * (1 - alpha(x, 75));
      expect(Math.abs(seen - 140)).toBeLessThanOrEqual(16);
    }
  });

  it('carries the soft shade around the pot in behind it: a moved pot uncovers a shaded wall, not a pale one', () => {
    // A faint shade (3 %, under what counts as a shadow) all around the pot, the far wall untouched.
    const HALO: Rect = [80, 50, 120, 100];
    const place = paint([[WINDOW, [240, 240, 240]]]);
    const piece = paint([[WINDOW, [240, 240, 240]], [HALO, [194, 194, 194]], [POT, [150, 120, 100]]]);
    const alive = paint([[WINDOW, [240, 240, 240]], [HALO, [194, 194, 194]], [POT, [150, 120, 100]], [PLANT, [60, 160, 60]]]);
    const m = makeLayers(place, piece, alive, cut([POT, WINDOW]), cut([POT, PLANT, WINDOW]))!;
    const s = m.shadowAlive!;
    const sx0 = Math.round((s.box.x / 100) * W), sy0 = Math.round((s.box.y / 100) * H);
    const alpha = (x: number, y: number) => s.pixels.data[((y - sy0) * s.pixels.width + (x - sx0)) * 4 + 3]! / 255;
    // In the middle of the pot, the wall it hides is shaded about as much as the wall around it.
    const seen = at(m.room, 100, 80)[0]! * (1 - alpha(100, 80));
    expect(Math.abs(seen - 194)).toBeLessThanOrEqual(2);
  });
});
