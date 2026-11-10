/**
 * The pictures of a page shown INSIDE the studio (the Design screen, a page
 * beside its editor), by a short `blob:` address instead of their base64.
 *
 * Measured on 10/11: each trial pasted every picture of the site into the
 * page as base64, so a site of ten scenes made a page of tens of megabytes at
 * each click, read again through the host past its 60-picture cache. Here a
 * picture is read once, turned into a blob once, and every later page names
 * it by an address of a few dozen characters: the page stays the size of its
 * text, and the frame decodes each picture once.
 *
 * Each read keeps the host's own deadline (data/host.ts, 15 s).
 * Only for pages shown in this document: a blob address dies with it, so a
 * page opened in its own window keeps the base64 (useSite.pageUrl).
 */

/** More than a large site holds (rooms, creations, portraits, posts): an evicted address is let go. */
const STAGE_ASSETS_MAX = 400;
const kept = new Map<string, Promise<string>>();

/** A data URL as bytes, without a fetch (a `data:` fetch is refused under some content policies). */
export function dataUrlBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma < 0) throw new Error('NOT_A_DATA_URL');
  const head = dataUrl.slice(5, comma);
  const type = head.split(';')[0] || 'application/octet-stream';
  const body = dataUrl.slice(comma + 1);
  if (!head.endsWith(';base64')) return new Blob([decodeURIComponent(body)], { type });
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * The short address of a picture on disk, read by `read` the first time only.
 * A failed read is not kept: the next page asks again.
 */
export function stageAssetUrl(path: string, read: (path: string) => Promise<string>): Promise<string> {
  const hit = kept.get(path);
  if (hit) return hit;
  if (kept.size >= STAGE_ASSETS_MAX) {
    const [oldest, url] = kept.entries().next().value!;
    kept.delete(oldest);
    // A read that failed has no address to let go; its failure was already said where it was asked (useSite.pageUrl).
    url.then((u) => URL.revokeObjectURL(u), () => {});
  }
  const pending = read(path).then((dataUrl) => URL.createObjectURL(dataUrlBlob(dataUrl)));
  kept.set(path, pending);
  pending.catch(() => kept.delete(path));
  return pending;
}

