import { decorPrompt, filmOf } from './film';
import { profileById } from './profiles';
import { newFilm, withKeyframe, type Film } from './filmRecord';

const steps = filmOf(profileById('ceramics-plants')).steps;
const ids = steps.map((s) => s.id);

/** A whole film: every picture, every clip, a cut and a running job. */
function whole(): Film {
  const f = newFilm('ceramics-plants', '16:9', new Date('2026-10-11T10:00:00Z'));
  const keyframes = Object.fromEntries(ids.map((id) => [id, `k-${id}.png`]));
  const clips = Object.fromEntries(ids.slice(1).map((id) => [id, `c-${id}.mp4`]));
  return { ...f, keyframes, conformed: { [ids[2]!]: 'conf.png' }, clips, cuts: { [ids[1]!]: { in: 0, out: 4 }, [ids[2]!]: { in: 1, out: 5 } }, clipJobs: {}, validated: true };
}

describe('a picture of the film replaced', () => {
  it('keeps the pictures before it, takes the new one, and drops the pictures after it', () => {
    const f = withKeyframe(whole(), ids[2]!, 'mine.jpg', steps);
    expect(f.keyframes[ids[0]!]).toBe(`k-${ids[0]}.png`);
    expect(f.keyframes[ids[1]!]).toBe(`k-${ids[1]}.png`);
    expect(f.keyframes[ids[2]!]).toBe('mine.jpg');
    for (const id of ids.slice(3)) expect(f.keyframes[id]).toBeUndefined();
    expect(f.validated).toBe(false);
  });
  it('drops every video that touches it, the one ending on it included, and its cut and crop', () => {
    const f = withKeyframe(whole(), ids[2]!, 'mine.jpg', steps);
    expect(f.clips[ids[1]!]).toBe(`c-${ids[1]}.mp4`);
    expect(f.cuts[ids[1]!]).toEqual({ in: 0, out: 4 });
    expect(f.clips[ids[2]!]).toBeUndefined();
    expect(f.cuts[ids[2]!]).toBeUndefined();
    expect(f.conformed[ids[2]!]).toBeUndefined();
    for (const id of ids.slice(3)) expect(f.clips[id]).toBeUndefined();
  });
  it('on the last picture, keeps all the others', () => {
    const last = ids[ids.length - 1]!;
    const f = withKeyframe(whole(), last, 'mine.jpg', steps);
    expect(Object.keys(f.keyframes)).toHaveLength(ids.length);
    expect(f.clips[last]).toBeUndefined();
    expect(f.clips[ids[1]!]).toBeDefined();
  });
  it('ignores a step that is not in the film', () => {
    const before = whole();
    expect(withKeyframe(before, 'nowhere', 'x.png', steps)).toBe(before);
  });
});

describe('a change of setting', () => {
  it('carries her words and keeps the rest of the picture', () => {
    const p = decorPrompt('  un mur en brique ');
    expect(p).toContain('Change only these elements of the setting: un mur en brique.');
    expect(p).toContain('Keep the person');
  });
});
