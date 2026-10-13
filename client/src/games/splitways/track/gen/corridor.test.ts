import { describe, expect, it } from 'vitest';
import base from '../../../../../../assets/tracks/kestrel-pines/base.layout.json';
import overrides from '../../../../../../assets/tracks/kestrel-pines/overrides.json';
import { TRACKGEN } from '../../config';
import { SURFACE, SURFACE_NAMES } from '../surfaces';
import { buildTrack } from '../tracks';
import { corridorChunks, corridorPhysicsMesh, wallHulls, type BandMesh } from './corridor';

const track = buildTrack(base, overrides);
const n = track.samples.length;

/** Positions of the band's vertices whose v (distance along the lap) equals `v`. */
function ring(mesh: BandMesh, v: number): number[][] {
  const out: number[][] = [];
  for (let k = 0; k < mesh.uvs.length / 2; k++) {
    if (Math.abs((mesh.uvs[k * 2 + 1] as number) - v) < 1e-3) {
      out.push(Array.from(mesh.positions.subarray(k * 3, k * 3 + 3)));
    }
  }
  return out.sort((a, b) => (a[0] as number) - (b[0] as number));
}

describe('corridor physics mesh', () => {
  const mesh = corridorPhysicsMesh(track);

  it('has one surface per triangle and all four surfaces', () => {
    expect(mesh.surfaceIds.length).toBe(mesh.indices.length / 3);
    const seen = new Set(mesh.surfaceIds);
    for (const name of SURFACE_NAMES) expect(seen.has(SURFACE[name])).toBe(true);
  });

  it('has no folded triangles (every face points up)', () => {
    const p = mesh.positions;
    let lowest = 1;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => (mesh.indices[t + k] as number) * 3) as [
        number,
        number,
        number,
      ];
      const e1 = [0, 1, 2].map((k) => (p[b + k] as number) - (p[a + k] as number));
      const e2 = [0, 1, 2].map((k) => (p[c + k] as number) - (p[a + k] as number));
      const nx = (e1[1] as number) * (e2[2] as number) - (e1[2] as number) * (e2[1] as number);
      const ny = (e1[2] as number) * (e2[0] as number) - (e1[0] as number) * (e2[2] as number);
      const nz = (e1[0] as number) * (e2[1] as number) - (e1[1] as number) * (e2[0] as number);
      lowest = Math.min(lowest, ny / Math.hypot(nx, ny, nz));
    }
    expect(lowest).toBeGreaterThan(0.7);
  });
});

describe('corridor chunks', () => {
  const chunks = corridorChunks(track);

  it('cuts the lap into 150 m chunks', () => {
    expect(chunks).toHaveLength(Math.ceil(n / TRACKGEN.chunkLength));
    expect(chunks[0]?.from).toBe(0);
    expect(chunks.at(-1)?.to).toBe(n);
    for (const chunk of chunks) {
      expect(chunk.radius).toBeGreaterThan(25);
      expect(chunk.bands.asphalt?.racingLine?.length).toBe(
        (chunk.bands.asphalt?.positions.length ?? 0) / 3,
      );
    }
  });

  it('shares boundary rings between neighbours, round the seam too', () => {
    for (let k = 0; k < chunks.length; k++) {
      const a = chunks[k];
      const b = chunks[(k + 1) % chunks.length];
      if (!a?.bands.asphalt || !b?.bands.asphalt) throw new Error('missing asphalt');
      const end = ring(a.bands.asphalt, a.to * track.spacing);
      const start = ring(b.bands.asphalt, b.from * track.spacing);
      expect(end).toHaveLength(2);
      expect(start).toHaveLength(2);
      for (let i = 0; i < 2; i++) {
        for (let c = 0; c < 3; c++) {
          expect(end[i]?.[c]).toBeCloseTo(start[i]?.[c] as number, 4);
        }
      }
    }
  });

  it('has kerbs, every run-off surface, armco and tyre walls somewhere', () => {
    const bands = new Set(chunks.flatMap((c) => Object.keys(c.bands)));
    for (const name of ['asphalt', 'kerb', 'grass', 'gravel', 'apron', 'lines', 'skirt', 'armco']) {
      expect(bands.has(name)).toBe(true);
    }
    expect(chunks.some((c) => c.tyreStacks.length > 0)).toBe(true);
    expect(chunks.some((c) => c.armcoPosts.length > 0)).toBe(true);
  });
});

describe('wall hulls', () => {
  it('cover every station on both sides with 8-point hulls', () => {
    const hulls = wallHulls(track);
    expect(hulls).toHaveLength(2 * Math.ceil(n / 4));
    for (const hull of hulls) expect(hull).toHaveLength(36);
  });
});
