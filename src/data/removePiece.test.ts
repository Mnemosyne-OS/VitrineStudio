import { archivePiece } from './removePiece';
import type { FolderIO } from './folderStore';
import { newPiece } from '../model/records';

function io(fail: Record<string, string> = {}): FolderIO & { calls: string[] } {
  const calls: string[] = [];
  const answer = (op: string, path: string) => {
    calls.push(`${op} ${path}`);
    return Promise.resolve(fail[path] ? { success: false, error: fail[path] } : { success: true });
  };
  return {
    calls,
    mkdir: (p) => answer('mkdir', p),
    readDir: () => Promise.resolve({ success: true, files: [] }),
    readFile: () => Promise.resolve({ success: false, error: 'File does not exist' }),
    writeFile: (p) => answer('write', p),
    deleteFile: (p) => answer('delete', p),
  };
}

describe('archivePiece', () => {
  const piece = { ...newPiece('Pot', 'C:/me/pot.jpg', undefined), id: 'p1' };

  it('writes the archived copy before removing the record, and never touches the photo', async () => {
    const fake = io();
    await archivePiece(fake, 'C:/s', piece, '2026-10-11');
    const writeAt = fake.calls.findIndex((c) => c.startsWith('write') && c.includes('archive') && c.endsWith('p1.json'));
    const deleteAt = fake.calls.findIndex((c) => c.startsWith('delete'));
    expect(writeAt).toBeGreaterThanOrEqual(0);
    expect(deleteAt).toBeGreaterThan(writeAt);
    expect(fake.calls.filter((c) => c.startsWith('delete'))).toEqual(['delete C:/s/products/p1.json']);
  });

  it('says so when the record could not be removed', async () => {
    await expect(archivePiece(io({ 'C:/s/products/p1.json': 'EBUSY' }), 'C:/s', piece, 'x')).rejects.toThrow();
  });
});
