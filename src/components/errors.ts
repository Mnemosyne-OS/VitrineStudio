import { translate } from '../i18n';

/**
 * The host's refusal codes, turned into an i18n key the person can act on.
 * A code with no sentence still shows, raw, next to a generic line: an
 * unknown refusal is never hidden.
 */
const KNOWN = [
  'NOT_FROM_A_GESTURE',
  'CREDITS_EXHAUSTED',
  'CREDITS_RATE_LIMITED',
  'PIECE_HAS_NO_PHOTO',
  'NO_PLACE_DESCRIPTION',
  'NO_PLACE_YET',
  'NO_PIECE_YET',
  'PERMISSION_DENIED',
  'WRITE_FAILED',
  'MKDIR_FAILED',
  'LIST_FAILED',
  'NOT_A_PHOTO',
  'READ_TIMEOUT',
  'READ_FAILED',
  'HOST_TOO_OLD',
  'NO_TOKEN',
  'TOKEN_REFUSED',
  'RATE_LIMITED',
  'PLAN_LIMIT',
  'NO_INDEX_HTML',
  'TIMEOUT',
  'NETWORK',
  'UNKNOWN_SITE',
  'SITE_FOLDER_MISSING',
  'BAD_PROJECT_NAME',
  'WEBP_NOT_SUPPORTED',
  'CLIP_NEEDS_TWO_PICTURES',
  'CLIP_FAILED',
  'CLIP_TIMEOUT',
  'CLIP_LOST',
  'FRAMES_DIFFER',
  'IMAGE_RATIO_MISMATCH',
  'SITE_FOLDER_HOLDS_RECORDS',
  'FILM_NO_PIECE',
  'FILM_NO_PREVIOUS',
  'FILM_KEYFRAMES_MISSING',
  'THEIA_ENGINE_REQUIRED',
  'UPSCALER_NOT_INSTALLED',
  'ALREADY_RUNNING',
  'CUTOUT_NEEDS_UPDATE',
  'UPSCALER_CHECKSUM',
  'IMAGE_TOO_LARGE',
  'PATH_OUTSIDE_HOME',
  'NOT_A_LOGO',
  'LOGO_TOO_LARGE',
  'FFMPEG_NOT_INSTALLED',
  'FFMPEG_FAILED',
  'FFMPEG_TIMEOUT',
  'NO_PARTS',
  'KIT_TOO_LARGE',
  'KIT_NOT_JSON',
  'KIT_NOT_A_KIT',
  'KIT_BAD_PATH',
  'KIT_FILE_TYPE',
  'KIT_PAGE_MISSING',
  'KIT_BAD_FILE',
  'KIT_FOLDER_UNREADABLE',
  'KIT_FILE_UNREADABLE',
  'KIT_LOGO_TYPE',
  'KIT_NOT_WRITTEN',
  'KIT_NOT_NEWER',
  'KIT_NEEDS_FOLDER',
  'KIT_BAD_RECORD',
  'KIT_DROPPED_FOLDER',
  'KIT_IN_PLACE_UNREADABLE',
  'PICTURE_UNDECODABLE',
  'NO_CANVAS',
  'POST_UNREADABLE',
  'POST_NOT_WRITTEN',
  'RATES_REFUSED',
  'RATES_UNREADABLE',
  'RATES_TIMEOUT',
  'RATES_NONE_ASKED',
  'NO_PROJECT_YET',
  'DOMAIN_TAKEN',
  'DOMAIN_REFUSED',
  'BAD_DOMAIN',
  'VERCEL_ADDRESS',
  'ANALYTICS_OFF',
  'NO_BEATS',
  'NO_SUBJECT',
  'SIZES_DIFFER',
] as const;

export type KnownCode = (typeof KNOWN)[number];

/** The code at the start of a host message ("CREDITS_EXHAUSTED: …" or "… denied …"). */
export function codeOf(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/permission|denied|not authori[sz]ed/i.test(msg) && !msg.startsWith('NOT_FROM_A_GESTURE')) return 'PERMISSION_DENIED';
  const head = msg.split(/[:\s]/)[0] ?? '';
  return head;
}

/** The i18n key for a refusal, and the raw message to show beside an unknown one. */
export function describeError(err: unknown): { key: string; raw?: string } {
  const code = codeOf(err);
  // A file named by the error (a blog post) goes beside the sentence: which one is the next step.
  const path = err && typeof err === 'object' && typeof (err as { path?: unknown }).path === 'string' ? (err as { path: string }).path : '';
  if ((KNOWN as readonly string[]).includes(code)) return path ? { key: `error.${code}`, raw: path.split(/[\\/]/).pop() } : { key: `error.${code}` };
  return { key: 'error.unknown', raw: err instanceof Error ? err.message : String(err) };
}

/** A refusal as the screen writes it: its sentence, and the raw message beside an unknown one. */
export function errorText(e: { key: string; raw?: string }): string {
  return `${translate(e.key)}${e.raw ? ` (${e.raw})` : ''}`;
}

export const ERROR_CODES = KNOWN;
