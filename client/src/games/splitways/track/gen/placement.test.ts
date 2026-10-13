import { describe, expect, it } from 'vitest';
import base from '../../../../../../assets/tracks/kestrel-pines/base.layout.json';
import overrides from '../../../../../../assets/tracks/kestrel-pines/overrides.json';
import { TRACKGEN } from '../../config';
import { Terrain } from '../terrain';
import { buildTrack } from '../tracks';
import { placeTrackside } from './placement';

const track = buildTrack(base, overrides);
const terrain = new Terrain(track);
const placements = placeTrackside(track, terrain);
const pines = placements.filter((p) => p.kind === 'pine');

describe('trackside placements', () => {
  it('are deterministic', () => {
    const again = placeTrackside(track, terrain);
    expect(again).toHaveLength(placements.length);
    expect(again).toEqual(placements);
  }, 30_000);

  it('plant a forest under the cap', () => {
    expect(pines.length).toBeGreaterThan(5000);
    expect(pines.length).toBeLessThanOrEqual(TRACKGEN.pineCap);
    for (const p of pines) {
      expect(p.scale).toBeGreaterThanOrEqual(0.8);
      expect(p.scale).toBeLessThanOrEqual(1.35);
    }
  });

  it('keep every pine at least 8 m beyond the nearest wall', () => {
    let closest = Infinity;
    for (const p of pines) {
      let best = -1;
      let bestSq = Infinity;
      track.samples.forEach((s, i) => {
        const d = (s.position.x - p.x) ** 2 + (s.position.z - p.z) ** 2;
        if (d < bestSq) {
          bestSq = d;
          best = i;
        }
      });
      const s = track.sample(best);
      const lateral = (p.x - s.position.x) * s.right.x + (p.z - s.position.z) * s.right.z;
      closest = Math.min(closest, Math.abs(lateral) - track.side(best, lateral < 0 ? -1 : 1).wall);
    }
    expect(closest).toBeGreaterThanOrEqual(TRACKGEN.pineGap - 1e-3);
  }, 30_000);

  it('put up distance boards and marshal posts', () => {
    const kinds = new Set(placements.map((p) => p.kind));
    for (const kind of ['board300', 'board200', 'board100', 'marshal'] as const) {
      expect(kinds.has(kind)).toBe(true);
    }
    const marshals = placements.filter((p) => p.kind === 'marshal');
    expect(marshals.length).toBeGreaterThanOrEqual(9);
    expect(marshals.length).toBeLessThanOrEqual(13);
  });
});
