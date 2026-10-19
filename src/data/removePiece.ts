/**
 * Taking a creation out of the studio: its record moves to
 * `<root>/archive/products/`, its photos stay on disk. A scene made with it
 * keeps its pictures; nothing the person brought or the studio made is deleted.
 */
import { ARCHIVE_DIR, joinPath, PIECES_DIR, saveRecord, StoreError, type FolderIO } from './folderStore';
import type { Piece } from '../model/types';

/** The archived copy is written FIRST: if removing the original then fails, the piece is in both places and nothing is lost. */
export async function archivePiece(io: FolderIO, root: string, piece: Piece, now: string): Promise<void> {
  await saveRecord(io, root, `${ARCHIVE_DIR}/${PIECES_DIR}`, { ...piece, updatedAt: now } as Piece);
  const res = await io.deleteFile(joinPath(root, PIECES_DIR, `${piece.id}.json`));
  if (!res.success) throw new StoreError('WRITE_FAILED', res.error);
}
