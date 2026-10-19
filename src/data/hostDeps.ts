import { generateImage, generateVideo, MODEL_FOR_QUALITY, readImage, readMedia, videoStatus } from './host';
import { conformTo, frameSize } from './frames';
import { saveImageBase64 } from './photos';
import type { ClipFrameDeps } from './clipFrames';
import { measureDecorChange } from './decorMeasure';
import type { BeatDeps } from './makeBeat';
import type { ClipDeps } from './makeClip';

/** The real host behind a scene's pictures (the tests pass fakes of the same shape). */
export const beatDeps: BeatDeps = {
  generate: generateImage,
  measure: async (before, after) => measureDecorChange(await readImage(before), await readImage(after)),
  modelFor: (q) => MODEL_FOR_QUALITY[q],
  now: () => new Date(),
};

/** The real host behind a clip. */
export const clipDeps: ClipDeps = {
  start: generateVideo,
  status: videoStatus,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
};

/** The real host behind a clip's wide frames. */
export const clipFrameDeps: ClipFrameDeps = {
  generate: generateImage,
  sizeOf: async (path) => frameSize(await readMedia(path)),
  conform: async (path, size, stem) => saveImageBase64(`${stem}.png`, await conformTo(await readMedia(path), size)),
};
