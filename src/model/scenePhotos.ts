import type { Scene } from './types';

/** The furthest picture a scene has: the living one, else the piece, else the place. */
export function lastPicture(scene: Scene): string | undefined {
  return scene.images.alive ?? scene.images.piece ?? scene.images.place;
}

/** The first picture the website shows: the furthest one of the first validated scene that has any. */
export function firstSitePhoto(scenes: Scene[]): string | undefined {
  for (const s of scenes) {
    if (!s.validated) continue;
    const path = lastPicture(s);
    if (path) return path;
  }
  return undefined;
}

/** The latest picture made, for the light behind the glass. */
export function latestPicture(scenes: Scene[]): string | undefined {
  for (let i = scenes.length - 1; i >= 0; i--) {
    const path = lastPicture(scenes[i]!);
    if (path) return path;
  }
  return undefined;
}
