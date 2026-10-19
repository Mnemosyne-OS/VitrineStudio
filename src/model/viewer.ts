/**
 * How a creation shows when it is opened large on the site (Tony: « le zoom,
 * une loupe design, dans les settings de la page, des curseurs loupe
 * différents, option cadre photo, ombre »).
 *
 * - The loupe: none, a round lens or a square one that follows the pointer,
 *   or the picture itself zooming where the pointer is. On a touch screen a
 *   tap zooms and a second tap comes back.
 * - The frame: none, a soft shadow (it follows a cut-out piece's own shape),
 *   a white passe-partout, or rounded corners. Also on the catalogue's tiles.
 *
 * A loupe needs a sharp picture: with one on, the export writes each
 * creation a second time at the large width.
 */
export const LOUPES = ['none', 'lens', 'square', 'zoom'] as const;
export type Loupe = (typeof LOUPES)[number];
export const FRAMES = ['none', 'shadow', 'frame', 'round'] as const;
export type Frame = (typeof FRAMES)[number];

export interface ViewerSettings {
  loupe: Loupe;
  frame: Frame;
}

export function normalizeViewer(raw: unknown): ViewerSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    loupe: (LOUPES as readonly unknown[]).includes(r.loupe) ? (r.loupe as Loupe) : 'none',
    frame: (FRAMES as readonly unknown[]).includes(r.frame) ? (r.frame as Frame) : 'none',
  };
}

/** The large copy a loupe reads, beside the creation's own picture. */
export const creationZoomAsset = (pieceId: string, n: number) => `assets/creation-${pieceId}${n ? `-${n + 1}` : ''}-z.webp`;
