/**
 * Photos dropped on the studio.
 *
 * Since Electron 32 a dropped file carries no path, only its bytes. A photo
 * becomes usable as a reference once it is ON DISK, so it is written into this
 * cartridge's own sandbox vault (`vault.sandbox.saveImage`): the host derives
 * the folder from the cartridge id, sniffs the bytes, and answers the absolute
 * path. As a bonus the photo becomes memory (DocWatch reads that folder).
 *
 * 🪤 A FileReader on a file dragged from a web page can fire NEITHER load NOR
 * error (doc 119 §14): every read here has a deadline and is aborted with it.
 */
import { sdk } from './host';
import { dataUrlPayload } from './bytes';

const READ_TIMEOUT_MS = 10_000;
const SAVE_TIMEOUT_MS = 30_000;
const EXT_FOR: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export class PhotoError extends Error {
  constructor(public readonly code: 'NOT_A_PHOTO' | 'READ_TIMEOUT' | 'READ_FAILED' | 'HOST_TOO_OLD', detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'PhotoError';
  }
}

/** The host keeps a picture of up to 8 MB in a sandbox (`MAX_IMAGE_BYTES`, main/vault/sandboxImages). */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** One file of an upload, as the screen shows it. */
export interface Upload {
  id: string;
  name: string;
  size: number;
  status: 'saving' | 'done' | 'refused';
  /** i18n key of the refusal. */
  reasonKey?: string;
  /** An object URL of the file, revoked when the list is cleared. */
  preview?: string;
}

/** Why a file cannot be sent, as an i18n key, or null. Checked BEFORE reading a byte. */
export function refusalOf(file: { type: string; size: number }): string | null {
  if (!isUsablePhoto(file)) return 'error.NOT_A_PHOTO';
  if (file.size > MAX_PHOTO_BYTES) return 'upload.tooLarge';
  return null;
}

/** Only the picture types the host accepts as a reference. */
export function isUsablePhoto(file: { type: string }): boolean {
  return file.type in EXT_FOR;
}

/** "vase-totem_02.jpg" → "Vase totem 02": a first name the person can change. */
export function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
}

/** Reads a file within READ_TIMEOUT_MS, as a data URL or as text; the reader is aborted with the deadline. */
function readBounded(file: File, as: 'dataUrl' | 'text'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timer = setTimeout(() => {
      reader.abort();
      reject(new PhotoError('READ_TIMEOUT', file.name));
    }, READ_TIMEOUT_MS);
    reader.onload = () => {
      clearTimeout(timer);
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      clearTimeout(timer);
      reject(new PhotoError('READ_FAILED', file.name));
    };
    try {
      if (as === 'text') reader.readAsText(file);
      else reader.readAsDataURL(file);
    } catch (err) {
      clearTimeout(timer);
      reject(new PhotoError('READ_FAILED', err instanceof Error ? err.message : String(err)));
    }
  });
}

/** The text of a dropped file (an SVG logo), read within the same deadline as a photo. */
export function readFileText(file: File): Promise<string> {
  return readBounded(file, 'text');
}

/** Writes a dropped photo on disk and resolves its absolute path. `stem` must be a plain id. */
export async function saveDroppedPhoto(file: File, stem: string): Promise<string> {
  const ext = EXT_FOR[file.type];
  if (!ext) throw new PhotoError('NOT_A_PHOTO', file.type || file.name);
  return saveImageBase64(`${stem}.${ext}`, dataUrlPayload(await readBounded(file, 'dataUrl')));
}

/** Writes picture bytes into the app's own vault and resolves the absolute path. */
export async function saveImageBase64(name: string, base64: string): Promise<string> {
  // This action answers main's envelope as is: { success, data, error }.
  const res = await sdk.invoke<{ success?: boolean; data?: { absolutePath?: string }; error?: string }>(
    'vault.sandbox.saveImage', { name, base64 }, SAVE_TIMEOUT_MS);
  if (!res?.success) throw new Error(res?.error ?? 'SAVE_FAILED');
  if (!res.data?.absolutePath) throw new PhotoError('HOST_TOO_OLD');
  return res.data.absolutePath;
}
