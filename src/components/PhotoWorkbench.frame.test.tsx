// The crop-and-turn tool of the photo workbench: what is kept is what was drawn.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PhotoWorkbench } from './PhotoWorkbench';
import { reframe, turnedPreview } from '../data/photoEdit';
import type { Piece } from '../model/types';

vi.mock('../data/host', () => ({
  readImage: vi.fn(() => Promise.resolve('data:image/jpeg;base64,AAAA')),
  sdk: {},
}));
vi.mock('../data/photoEdit', async (orig) => ({
  ...(await orig<typeof import('../data/photoEdit')>()),
  // A 4000 × 2000 photo: turned a quarter, its preview is 2000 × 4000.
  turnedPreview: vi.fn((_url: string, turns: number) => Promise.resolve(turns % 2 ? { url: 'data:t', width: 2000, height: 4000 } : { url: 'data:p', width: 4000, height: 2000 })),
  reframe: vi.fn(() => Promise.resolve('C:/vault/p1-frame.jpg')),
}));

const piece = { id: 'p1', name: 'Bol', photoPath: 'C:/vault/bol.jpg', photoTakes: [] } as unknown as Piece;

function bench(onImprove = vi.fn(() => Promise.resolve(piece))) {
  const onClose = vi.fn();
  render(<PhotoWorkbench piece={piece} imageModel="m" siteColour="#ffffff" spend={vi.fn()} onImprove={onImprove}
    onKeepCutout={vi.fn()} onChoose={vi.fn()} onDrop={vi.fn()} onClose={onClose} />);
  return { onImprove, onClose };
}
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const byName = (re: RegExp) => screen.getByRole('button', { name: re });

describe('crop and turn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a turn then a square keeps a square of the TURNED photo, as a new version', async () => {
    const { onImprove } = bench();
    fireEvent.click(byName(/crop or turn|recadrer ou tourner|recortar o girar/i));
    await settle();
    const keep = byName(/keep this framing|garder ce cadrage|guardar este encuadre/i);
    // Untouched: nothing to save.
    expect(keep).toBeDisabled();
    fireEvent.click(byName(/turn right|tourner à droite|girar a la derecha/i));
    await settle();
    expect(turnedPreview).toHaveBeenLastCalledWith('data:image/jpeg;base64,AAAA', 1);
    fireEvent.click(byName(/^(square|carré|cuadrado)$/i));
    expect(keep).toBeEnabled();
    fireEvent.click(keep);
    await settle();
    // 2000 × 4000 once turned: the square is the full width, half the height, centred.
    expect(reframe).toHaveBeenCalledWith('C:/vault/bol.jpg', { turns: 1, crop: { x: 0, y: 0.25, w: 1, h: 0.5 } }, expect.any(Function), expect.stringMatching(/^p1-frame/));
    expect(onImprove).toHaveBeenCalledWith(piece, 'C:/vault/p1-frame.jpg');
  });

  it('a corner dragged on the photo is the crop kept', async () => {
    bench();
    fireEvent.click(byName(/crop or turn|recadrer ou tourner|recortar o girar/i));
    await settle();
    const stage = document.querySelector('.crop-stage') as HTMLElement;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
    const corner = document.querySelector('.crop-corner.se') as HTMLElement;
    corner.setPointerCapture = () => {};
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 300, clientY: 100 });
    fireEvent.pointerUp(corner, { pointerId: 1 });
    fireEvent.click(byName(/keep this framing|garder ce cadrage|guardar este encuadre/i));
    await settle();
    expect(reframe).toHaveBeenCalledWith('C:/vault/bol.jpg', { turns: 0, crop: { x: 0, y: 0, w: 0.75, h: 0.5 } }, expect.any(Function), expect.any(String));
  });

  it('Escape closes the crop first, the bench only after', async () => {
    const { onClose } = bench();
    fireEvent.click(byName(/crop or turn|recadrer ou tourner|recortar o girar/i));
    await settle();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('.crop-stage')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
