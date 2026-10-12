import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../track/gen/placement';
import { edgeFirstOrder, pineGeometry } from './forest';
import { tyreStackGeometry } from './trackVisual';

describe('forest', () => {
  it('builds the pine within its triangle budget', () => {
    const geometry = pineGeometry();
    const triangles = geometry.getAttribute('position').count / 3;
    expect(triangles).toBe(106);
    expect(triangles).toBeLessThanOrEqual(120);
  });

  it('orders a tile edge band first, each part shuffled, every tree once', () => {
    const beyond = [50, 5, 80, 12, 31, 29, 200, 3];
    const order = edgeFirstOrder(beyond, 30, mulberry32(7));
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const edge = order.slice(0, 4).map((i) => beyond[i] as number);
    const rest = order.slice(4).map((i) => beyond[i] as number);
    expect(edge.every((b) => b <= 30)).toBe(true);
    expect(rest.every((b) => b > 30)).toBe(true);
  });

  it('thins the interior before the edge band', () => {
    const beyond = Array.from({ length: 100 }, (_, i) => (i < 40 ? 10 : 100));
    const order = edgeFirstOrder(beyond, 30, mulberry32(1));
    // Half the trees drawn: every edge tree stays.
    const drawn = order.slice(0, 50);
    expect(drawn.filter((i) => (beyond[i] as number) <= 30)).toHaveLength(40);
  });
});

describe('tyre stacks', () => {
  it('stays within 60 triangles', () => {
    const geometry = tyreStackGeometry();
    expect((geometry.getIndex()?.count ?? 0) / 3).toBeLessThanOrEqual(60);
  });
});
