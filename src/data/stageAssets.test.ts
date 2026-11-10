import { dataUrlBlob, stageAssetUrl } from './stageAssets';

describe('the pictures of a page shown in the studio', () => {
  // The test window has no blob addresses: each blob gets a numbered one.
  let n = 0;
  beforeAll(() => { URL.createObjectURL = vi.fn(() => `blob:test/${++n}`); URL.revokeObjectURL = vi.fn(); });

  it('turns a data URL into its bytes, with its type', async () => {
    const blob = dataUrlBlob('data:image/png;base64,AAEC');
    expect(blob.type).toBe('image/png');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0, 1, 2]);
    expect(() => dataUrlBlob('C:/a.png')).toThrow('NOT_A_DATA_URL');
  });

  it('reads a picture once: every later page gets the same short address', async () => {
    const read = vi.fn(async () => 'data:image/webp;base64,AAAA');
    const a = await stageAssetUrl('C:/once.webp', read);
    const b = await stageAssetUrl('C:/once.webp', read);
    expect(a).toMatch(/^blob:/);
    expect(b).toBe(a);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keeps no failed read: the next page asks again', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('READ_FAILED')).mockResolvedValueOnce('data:image/webp;base64,AAAA');
    await expect(stageAssetUrl('C:/later.webp', read)).rejects.toThrow('READ_FAILED');
    await expect(stageAssetUrl('C:/later.webp', read)).resolves.toMatch(/^blob:/);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
