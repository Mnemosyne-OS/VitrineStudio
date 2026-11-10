import { useEffect, useState } from 'react';
import { readImage } from '../data/host';
import { toWebp } from '../data/webp';

/** A demonstration's photo is small: a card is a few hundred pixels wide, and nine of them carry six photos each. */
const DEMO_WIDTH = 420;
const DEMO_COUNT = 6;
/** A photo the host does not give after this long is left out: a plain tile stands in. */
const READ_TIMEOUT_MS = 15_000;
/** Small copies already made, by the photo's path: a copy is made once per session. */
const made = new Map<string, string>();

/**
 * Small copies of her creations' photos for the catalogue's demonstrations
 * (doc 145 §10.25), as data URLs. Empty until they are made, and for a photo
 * that cannot be read (the demonstration then draws a plain tile): a missing
 * photo never holds a demonstration back.
 */
export function useDemoPhotos(paths: readonly string[]): { photos: string[]; pending: boolean } {
  const key = paths.slice(0, DEMO_COUNT).join('\n');
  const [photos, setPhotos] = useState<string[]>(() => key.split('\n').filter(Boolean).flatMap((p) => (made.has(p) ? [made.get(p)!] : [])));
  // The list whose reading is over: until it is this one, the demonstrations say they are loading
  // instead of standing empty.
  const [readKey, setReadKey] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const list = key.split('\n').filter(Boolean);
    void (async () => {
      const out: string[] = [];
      for (const path of list) {
        // The screen was left: the photos still to read are not read for nobody.
        if (!alive) return;
        let small = made.get(path);
        if (!small) {
          try {
            let timer = 0;
            const late = new Promise<never>((_, no) => { timer = window.setTimeout(() => no(new Error('READ_TIMEOUT')), READ_TIMEOUT_MS); });
            try { small = `data:image/webp;base64,${await Promise.race([readImage(path).then((url) => toWebp(url, DEMO_WIDTH, 0.8)), late])}`; }
            finally { window.clearTimeout(timer); }
            made.set(path, small);
          } catch (err) {
            console.warn('[vitrine-studio] a photo was not read for the demonstrations, a plain tile stands in:', path, err);
            continue;
          }
        }
        out.push(small);
      }
      if (alive) { setPhotos(out); setReadKey(key); }
    })();
    return () => { alive = false; };
  }, [key]);
  return { photos, pending: key !== '' && readKey !== key };
}
