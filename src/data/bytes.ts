/**
 * Bytes, base64 and data URLs: the conversions the studio does in several
 * places (the export, the preview, the logo, the weight labels), written once.
 */

/** Bytes in a base64 string, padding taken off. */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Text as UTF-8 base64 (btoa alone refuses anything outside Latin-1). */
export function utf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** The base64 payload of a data URL. */
export function dataUrlPayload(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/** The text of a base64 data URL, read as UTF-8 (an SVG handed back by the host). */
export function dataUrlText(dataUrl: string): string {
  return new TextDecoder().decode(base64ToBytes(dataUrlPayload(dataUrl)));
}

/** Bytes of a data URL's payload. */
export function dataUrlBytes(dataUrl: string): number {
  return base64Bytes(dataUrlPayload(dataUrl));
}
