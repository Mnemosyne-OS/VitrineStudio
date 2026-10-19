import { describe, it, expect } from 'vitest';
import { cutoutPlan, cutoutTodo } from './cutoutPlan';

describe('cutoutPlan', () => {
  it('nothing to do when the cut-out is on show, nothing to cut without a photo', () => {
    expect(cutoutPlan({ photoPath: 'c.png', cutout: { from: 'a.jpg', path: 'c.png' } })).toEqual({ kind: 'shown' });
    expect(cutoutPlan({})).toEqual({ kind: 'noPhoto' });
  });
  it('reuses the cut-out of the photo on show or of one of her earlier photos', () => {
    expect(cutoutPlan({ photoPath: 'a.jpg', cutout: { from: 'a.jpg', path: 'c.png' } })).toEqual({ kind: 'reuse', path: 'c.png' });
    expect(cutoutPlan({ photoPath: 'gen.png', photoTakes: ['a.jpg'], cutout: { from: 'a.jpg', path: 'c.png' } })).toEqual({ kind: 'reuse', path: 'c.png' });
  });
  it('makes one when the cut-out belongs to a photo she no longer has', () => {
    expect(cutoutPlan({ photoPath: 'b.jpg', photoTakes: [], cutout: { from: 'a.jpg', path: 'c.png' } })).toEqual({ kind: 'make', from: 'b.jpg' });
    expect(cutoutPlan({ photoPath: 'b.jpg' })).toEqual({ kind: 'make', from: 'b.jpg' });
  });
});

describe('cutoutTodo', () => {
  const pieces = [
    { id: 'a', photoPath: 'a.jpg' },
    { id: 'b', photoPath: 'c.png', cutout: { from: 'b.jpg', path: 'c.png' } },
    { id: 'n' },
  ];
  it('every piece by default, minus the cut out and the photoless, counted', () => {
    expect(cutoutTodo(pieces, null)).toEqual({ todo: ['a'], unknown: [], already: 2 });
  });
  it('names an id that is not a piece', () => {
    expect(cutoutTodo(pieces, ['a', 'zz'])).toEqual({ todo: ['a'], unknown: ['zz'], already: 0 });
  });
});
