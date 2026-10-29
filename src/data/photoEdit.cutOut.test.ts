/**
 * cutOut asks the host with the phrases that name the piece (doc 189 §5), and
 * stays the old door when it has none.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('./host', () => ({ sdk: { invoke } }));

import { cutOut } from './photoEdit';

beforeEach(() => { invoke.mockReset(); vi.spyOn(console, 'info').mockImplementation(() => {}); });

describe('cutOut', () => {
  it('sends the phrases when it has some', async () => {
    invoke.mockResolvedValueOnce({ path: 'C:/cut.png', by: 'phrase', found: 1 });
    await expect(cutOut('C:/scene.png', ['the ceramic piece'])).resolves.toBe('C:/cut.png');
    expect(invoke).toHaveBeenCalledWith('image.removeBackground', { path: 'C:/scene.png', phrases: ['the ceramic piece'] }, expect.any(Number));
  });

  it('no phrases (or an empty list): the payload is the old one, a host from before reads it unchanged', async () => {
    invoke.mockResolvedValue({ path: 'C:/cut.png' });
    await cutOut('C:/scene.png');
    await cutOut('C:/scene.png', []);
    expect(invoke.mock.calls.map(c => c[1])).toEqual([{ path: 'C:/scene.png' }, { path: 'C:/scene.png' }]);
  });

  it('the salient matte answering is a cut-out all the same', async () => {
    invoke.mockResolvedValueOnce({ path: 'C:/cut.png', by: 'salient', phraseRefused: 'PHRASE_MATTE_OFF' });
    await expect(cutOut('C:/scene.png', ['the lamp'])).resolves.toBe('C:/cut.png');
  });
});
