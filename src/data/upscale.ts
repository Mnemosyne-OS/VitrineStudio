/**
 * Enlarging the studio's pictures on the person's own machine (doc 88): the
 * pictures came out of the model at about 1 000 px, which a large screen shows
 * pixelated. No credit is spent and the composition does not move: the host
 * runs Real-ESRGAN locally and writes a NEW file beside each picture.
 *
 * Pure decisions here (which pictures, what the scene becomes); the host call
 * is injected so the loop is tested without one.
 */
import { BEATS, type Beat, type Scene } from '../model/types';

export interface UpscaleJob {
  sceneId: string;
  beat: Beat;
  /** Always the ORIGINAL picture: enlarging an enlargement only adds blur. */
  from: string;
}

/** Every picture not yet enlarged by `scale` (one enlarged by less is redone from its original). */
export function upscaleJobs(scenes: Scene[], scale: number): UpscaleJob[] {
  const jobs: UpscaleJob[] = [];
  for (const s of scenes) {
    for (const beat of BEATS) {
      const current = s.images[beat];
      if (!current) continue;
      const done = s.enlarged?.[beat];
      if (done && done.scale >= scale) continue;
      jobs.push({ sceneId: s.id, beat, from: done?.from ?? current });
    }
  }
  return jobs;
}

/**
 * The scene once a picture was enlarged. `path` may be the original itself
 * when the host found it already wide enough: it is still recorded, so the
 * picture is not offered again.
 */
export function withEnlarged(scene: Scene, job: UpscaleJob, path: string, scale: number, now: string): Scene {
  return {
    ...scene,
    images: { ...scene.images, [job.beat]: path },
    enlarged: { ...scene.enlarged, [job.beat]: { from: job.from, scale } },
    updatedAt: now,
  };
}
