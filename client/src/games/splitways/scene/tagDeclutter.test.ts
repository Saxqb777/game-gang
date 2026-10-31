import { describe, expect, it } from 'vitest';
import { NAME_TAGS } from '../config';
import { TagDeclutter, approachOpacity, tagDistanceOpacity } from './tagDeclutter';

const { nearHide, nearFull, farFull, farHide, fadeRate } = NAME_TAGS;

describe('tagDistanceOpacity', () => {
  it('hides tags on your bumper and far away, and fades in between', () => {
    expect(tagDistanceOpacity(nearHide - 1)).toBe(0);
    expect(tagDistanceOpacity((nearHide + nearFull) / 2)).toBeCloseTo(0.5);
    expect(tagDistanceOpacity((nearFull + farFull) / 2)).toBe(1);
    expect(tagDistanceOpacity((farFull + farHide) / 2)).toBeCloseTo(0.5);
    expect(tagDistanceOpacity(farHide)).toBe(0);
    expect(tagDistanceOpacity(farHide * 3)).toBe(0);
  });
});

describe('approachOpacity', () => {
  it('moves at the fade rate and stops at the target', () => {
    expect(approachOpacity(0, 1, 0.1, fadeRate)).toBeCloseTo(Math.min(1, fadeRate * 0.1));
    expect(approachOpacity(1, 0, 0.1, fadeRate)).toBeCloseTo(Math.max(0, 1 - fadeRate * 0.1));
    expect(approachOpacity(0.9, 1, 10, fadeRate)).toBe(1);
    expect(approachOpacity(0.1, 0, 10, fadeRate)).toBe(0);
  });
});

describe('TagDeclutter', () => {
  const mid = (nearFull + farFull) / 2;

  it('keeps only the nearest of overlapping tags', () => {
    const layout = new TagDeclutter(4);
    layout.set(0, 0, 0, 40, 10, mid + 5); // farther, same spot
    layout.set(1, 5, 3, 40, 10, mid); // nearest
    layout.set(2, 300, 0, 40, 10, mid + 8); // clear of the others
    layout.set(3, 30, 15, 40, 10, mid + 9); // overlaps the nearest
    layout.solve(4);
    expect(Array.from(layout.target)).toEqual([0, 1, 1, 0]);
  });

  it('lets a hidden or faded-out tag block nothing', () => {
    const layout = new TagDeclutter(3);
    layout.set(0, 0, 0, 40, 10, nearHide - 2); // on your bumper: hidden
    layout.hide(1); // your own car
    layout.set(2, 0, 0, 40, 10, mid);
    layout.solve(3);
    expect(Array.from(layout.target)).toEqual([0, 0, 1]);
  });

  it('applies the distance fade to tags that do not overlap', () => {
    const layout = new TagDeclutter(2);
    layout.set(0, -200, 0, 20, 5, (farFull + farHide) / 2);
    layout.set(1, 200, 0, 20, 5, farHide + 10);
    layout.solve(2);
    expect(layout.target[0]).toBeCloseTo(0.5);
    expect(layout.target[1]).toBe(0);
  });

  it('does not allocate per solve (buffers are reused)', () => {
    const layout = new TagDeclutter(2);
    const target = layout.target;
    layout.set(0, 0, 0, 10, 10, mid);
    layout.set(1, 100, 0, 10, 10, mid);
    layout.solve(2);
    layout.solve(2);
    expect(layout.target).toBe(target);
  });
});
