import { clipShape, followClip, startClip, type ClipDeps, type ClipJob } from './makeClip';
import { profileById } from '../model/profiles';
import { newScene } from '../model/records';

const profile = profileById('ceramics-plants');
const made = () => ({ ...newScene({ pieceId: 'p', universe: 'U', variant: 'V', placeDescription: 'x', animation: 'pothos', aspectRatio: '16:9' }), images: { place: 'a', piece: 'b', alive: 'c' } });

function deps(states: Array<Partial<ClipJob> | Error>): ClipDeps & { started: Record<string, unknown>[] } {
  const started: Record<string, unknown>[] = [];
  let t = 0;
  return {
    started,
    start: vi.fn(async (p) => { started.push(p); return { id: 'job-1', state: 'running' as const, path: null }; }),
    status: vi.fn(async () => { const s = states.shift() ?? { state: 'running' }; if (s instanceof Error) throw s; return { id: 'job-1', path: null, ...s } as ClipJob; }),
    sleep: async (ms) => { t += ms; },
    now: () => t,
  };
}

describe('clips', () => {
  it('goes from the creation picture to the living one, with a prompt that keeps the change inside the piece', async () => {
    const d = deps([]);
    const s = await startClip(made(), profile, d);
    expect(d.started[0]).toMatchObject({ startImagePath: 'b', endImagePath: 'c', aspectRatio: '16:9', durationSeconds: 6 });
    expect(d.started[0]!.prompt).toMatch(/Nothing enters from outside/);
    // Always sent: a frame already in shape is untouched, one from a 4:3 photo is widened.
    expect(d.started[0]).toHaveProperty('fit', 'widen');
    expect(s.clipJob?.id).toBe('job-1');
    // A new clip has not been seen: it leaves the site until validated again.
    expect(s.validated).toBe(false);
  });

  it('moves the way she chose: camera, light and her own word, still and steady when nothing was chosen', async () => {
    const plain = deps([]);
    await startClip(made(), profile, plain);
    expect(plain.started[0]!.prompt).toMatch(/Locked camera on a tripod, no camera movement\. The room, the furniture and the light stay identical\. Natural, calm, photographic\.$/);
    const styled = deps([]);
    await startClip({ ...made(), clipStyle: { camera: 'push', light: 'sun', note: 'Morning light.' } }, profile, styled);
    expect(styled.started[0]!.prompt).toMatch(/pushes in very slowly/);
    expect(styled.started[0]!.prompt).toMatch(/sunlight drifts/);
    expect(styled.started[0]!.prompt).not.toMatch(/Locked camera/);
    expect(styled.started[0]!.prompt).toMatch(/Morning light\.$/);
  });

  it('refuses a scene without its two pictures, before spending', async () => {
    const d = deps([]);
    await expect(startClip({ ...made(), images: { place: 'a', piece: 'b' } }, profile, d)).rejects.toThrow('CLIP_NEEDS_TWO_PICTURES');
    expect(d.start).not.toHaveBeenCalled();
  });

  it('picks the shape Veo makes closest to the declared one', () => {
    expect(clipShape('1:1')).toEqual({ aspectRatio: '16:9' });
    expect(clipShape('3:4')).toEqual({ aspectRatio: '9:16' });
    expect(clipShape('9:16')).toEqual({ aspectRatio: '9:16' });
  });

  it('asks again after a passing read error instead of dropping a paid clip', async () => {
    const s = await followClip(await startClip(made(), profile, deps([])), deps([new Error('TIMEOUT'), { state: 'done', path: 'C:/v.mp4' }]), () => {});
    expect(s.clipPath).toBe('C:/v.mp4');
    expect(s.validated).toBe(false);
  });

  it('follows until done, then keeps the clip and forgets the job', async () => {
    const s = await followClip(await startClip(made(), profile, deps([])), deps([{ state: 'running' }, { state: 'done', path: 'C:/v.mp4' }]), () => {});
    expect(s.clipPath).toBe('C:/v.mp4');
    expect(s).not.toHaveProperty('clipJob');
  });

  it('names the end: failed, lost after a restart, or too long', async () => {
    const started = await startClip(made(), profile, deps([]));
    await expect(followClip(started, deps([{ state: 'failed', error: 'SAFETY' }]), () => {})).rejects.toThrow('CLIP_FAILED: SAFETY');
    // Named LOST at once, never followed until the timeout (which is a ClipError too).
    await expect(followClip(started, deps([new Error('UNKNOWN_JOB:job-1')]), () => {})).rejects.toThrow('CLIP_LOST');
    await expect(followClip(started, deps(Array(200).fill({ state: 'running' })), () => {})).rejects.toThrow('CLIP_TIMEOUT');
  });
});
