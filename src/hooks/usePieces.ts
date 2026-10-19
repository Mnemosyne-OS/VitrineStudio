import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { hostIO, pickImage } from '../data/host';
import { baseName, PIECES_DIR, saveRecord } from '../data/folderStore';
import { archivePiece } from '../data/removePiece';
import { backToPhoto, withNewPhoto, withoutPhotoTake } from '../model/photoTakes';
import { isUsablePhoto, nameFromFile, refusalOf, saveDroppedPhoto, type Upload } from '../data/photos';
import { newId, newPiece } from '../model/records';
import type { Piece } from '../model/types';
import { describeError } from '../components/errors';
import { sortPieces, type Studio } from './useStudio';

/** The creations: dropped or picked photos become pieces; a piece's name, words and photo change. */
export function usePieces(studio: Studio) {
  const { t } = useI18n();
  const { folder, alive, setPieces, replacePiece, savePiece, setNotice, fail, piecesRef } = studio;
  /** The piece as it is now (another change may have landed while a job ran). */
  const now = (piece: Piece) => piecesRef.current.find((x) => x.id === piece.id) ?? piece;
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);

  // The previews are object URLs: released when the studio closes.
  const uploadsRef = useRef<Upload[]>([]);
  uploadsRef.current = uploads;
  useEffect(() => () => uploadsRef.current.forEach((u) => u.preview && URL.revokeObjectURL(u.preview)), []);

  const setUpload = (id: string, patch: Partial<Upload>) => setUploads((all) => all.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  /**
   * One dropped photo = one piece. Every file gets its own line in the upload
   * list: a refused one says why (not a photo, too large, the host's reason),
   * never silently skipped.
   */
  const addPiecesFromFiles = async (files: File[], pageId: string | null = null): Promise<Piece[]> => {
    // A new batch replaces the last one's list; its previews are released.
    uploadsRef.current.forEach((u) => u.preview && URL.revokeObjectURL(u.preview));
    const batch: Upload[] = files.map((f) => {
      const reasonKey = refusalOf(f);
      return { id: newId('up'), name: f.name, size: f.size, status: reasonKey ? 'refused' : 'saving', ...(reasonKey ? { reasonKey } : { preview: URL.createObjectURL(f) }) };
    });
    setUploads(batch);
    const made: Piece[] = [];
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const line = batch[i]!;
        if (line.status === 'refused') continue;
        const piece = newPiece(nameFromFile(file.name) || t('pieces.untitled'), undefined, undefined);
        if (pageId) piece.pageId = pageId;
        try {
          if (!folder) throw new Error('NO_FOLDER');
          piece.photoPath = await saveDroppedPhoto(file, `${piece.id}-photo`);
          await saveRecord(hostIO, folder, PIECES_DIR, piece);
          made.push(piece);
          if (alive.current) setUpload(line.id, { status: 'done' });
        } catch (err) {
          console.warn('[vitrine-studio] a dropped photo was refused:', err);
          if (alive.current) setUpload(line.id, { status: 'refused', reasonKey: describeError(err).key });
        }
      }
    } finally {
      if (alive.current) setBusy(false);
    }
    if (alive.current && made.length) setPieces((all) => sortPieces([...all, ...made]));
    return made;
  };

  /** The system picker, for a person who does not drag. Resolves the piece made, or null; throws what the host refused. */
  const pickNewPiece = async (pageId: string | null = null): Promise<Piece | null> => {
    const path = await pickImage(t('pieces.photoFilter'));
    if (!path) return null;
    const piece = newPiece(nameFromFile(baseName(path)) || t('pieces.untitled'), path, undefined);
    if (pageId) piece.pageId = pageId;
    if (!(await savePiece(piece))) return null;
    setPieces((all) => sortPieces([...all, piece]));
    return piece;
  };

  const setPhotoFromFile = async (piece: Piece, file: File) => {
    if (!isUsablePhoto(file)) {
      setNotice({ kind: 'error', text: t('pieces.refusedFiles', { names: file.name }) });
      return;
    }
    try {
      const path = await saveDroppedPhoto(file, `${piece.id}-${newId('photo')}`);
      const next = { ...now(piece), photoPath: path, updatedAt: new Date().toISOString() };
      if (await savePiece(next)) replacePiece(next);
    } catch (err) {
      fail(err);
    }
  };

  const pickPhoto = async (piece: Piece) => {
    try {
      const path = await pickImage(t('pieces.photoFilter'));
      if (!path) return;
      const next = { ...now(piece), photoPath: path, updatedAt: new Date().toISOString() };
      if (await savePiece(next)) replacePiece(next);
    } catch (err) {
      fail(err);
    }
  };

  /** Saves the change; true once it is on disk (an agent answers on it, never on the attempt). */
  const editPiece = async (piece: Piece, patch: { name?: string; description?: string; price?: number | null; status?: Piece['status'] | null }): Promise<boolean> => {
    const { price, status, ...rest } = patch;
    const next: Piece = { ...now(piece), ...rest, updatedAt: new Date().toISOString() };
    if (patch.description === '') delete next.description;
    if (price === null) delete next.price;
    else if (price !== undefined) next.price = price;
    if (status === null) delete next.status;
    else if (status !== undefined) next.status = status;
    if (!(await savePiece(next))) return false;
    replacePiece(next);
    return true;
  };

  /** Out of the studio into its archive folder; its photos and its scenes stay. */
  const removePiece = async (piece: Piece): Promise<boolean> => {
    try {
      if (!folder) throw new Error('NO_FOLDER');
      await archivePiece(hostIO, folder, piece, new Date().toISOString());
      if (alive.current) setPieces((all) => all.filter((x) => x.id !== piece.id));
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  };

  /** A better photo made in the studio: shown, the one before kept in the versions. Resolves the piece saved, or null. */
  const improvePhoto = async (piece: Piece, path: string): Promise<Piece | null> => {
    const next = withNewPhoto(now(piece), path, new Date().toISOString());
    if (!(await savePiece(next))) return null;
    replacePiece(next);
    return next;
  };
  /** The cut-out of the photo shown, remembered without changing the photo. */
  const keepCutout = async (piece: Piece, cutout: NonNullable<Piece['cutout']>): Promise<Piece | null> => {
    const next = { ...now(piece), cutout, updatedAt: new Date().toISOString() };
    if (!(await savePiece(next))) return null;
    replacePiece(next);
    return next;
  };
  const choosePhoto = async (piece: Piece, path: string) => {
    const cur = now(piece);
    const next = backToPhoto(cur, path, new Date().toISOString());
    if (next !== cur && (await savePiece(next))) replacePiece(next);
  };
  const dropPhoto = async (piece: Piece, path: string) => {
    const next = withoutPhotoTake(now(piece), path, new Date().toISOString());
    if (await savePiece(next)) replacePiece(next);
  };

  return { uploads, busy, addPiecesFromFiles, pickNewPiece, setPhotoFromFile, pickPhoto, editPiece, removePiece, improvePhoto, keepCutout, choosePhoto, dropPhoto };
}
