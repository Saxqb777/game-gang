import { describe, expect, it } from 'vitest';
import base from '../../../../../assets/tracks/kestrel-pines/base.layout.json';
import overrides from '../../../../../assets/tracks/kestrel-pines/overrides.json';
import { Terrain } from './terrain';
import { buildTrack } from './tracks';

const track = buildTrack(base, overrides);
const started = performance.now();
const terrain = new Terrain(track);
const buildMs = performance.now() - started;
const n = track.samples.length;

describe('terrain', () => {
  it('builds the Kestrel Pines field quickly', () => {
    console.info(
      `[terrain] ${terrain.field.cols} x ${terrain.field.rows} field in ${buildMs.toFixed(0)} ms`,
    );
    expect(buildMs).toBeLessThan(2000);
  });

  it('meets the wall foot on both sides', () => {
    let worst = 0;
    for (let i = 0; i < n; i += 10) {
      const s = track.sample(i);
      for (const side of [-1, 1] as const) {
        const lateral = side * track.side(i, side).wall;
        const x = s.position.x + s.right.x * lateral;
        const z = s.position.z + s.right.z * lateral;
        const foot = s.position.y + track.crossSectionY(i, lateral) - 0.05;
        worst = Math.max(worst, Math.abs(terrain.heightAt(x, z) - foot));
      }
    }
    expect(worst).toBeLessThan(0.1);
  });

  it('stays under the corridor surface inside the walls', () => {
    let highest = -Infinity;
    for (let i = 0; i < n; i += 10) {
      const s = track.sample(i);
      for (const side of [-1, 1] as const) {
        const limit = track.side(i, side).wall - 0.5;
        for (let a = 0; a <= limit; a += 1) {
          const lateral = side * a;
          const x = s.position.x + s.right.x * lateral;
          const z = s.position.z + s.right.z * lateral;
          const surface = s.position.y + track.crossSectionY(i, lateral);
          highest = Math.max(highest, terrain.heightAt(x, z) - surface);
        }
      }
    }
    expect(highest).toBeLessThan(-0.01);
  });

  it('interpolates on the mesh triangles', () => {
    const { minX, minZ, spacing, cols, heights } = terrain.field;
    const col = 120;
    const row = 140;
    const h = (c: number, r: number) => heights[r * cols + c] as number;
    expect(terrain.heightAt(minX + col * spacing, minZ + row * spacing)).toBeCloseTo(
      h(col, row),
      5,
    );
    // The cell centre lies on the (col, row + 1)-(col + 1, row) diagonal.
    const centre = terrain.heightAt(minX + (col + 0.5) * spacing, minZ + (row + 0.5) * spacing);
    expect(centre).toBeCloseTo((h(col, row + 1) + h(col + 1, row)) / 2, 5);
  });

  it('is natural ground far from the track, with wildness 1 there and 0 on the corridor', () => {
    const { wildness, cols } = terrain.field;
    expect(wildness[0]).toBe(1);
    const s = track.sample(0);
    const { minX, minZ, spacing } = terrain.field;
    const col = Math.round((s.position.x - minX) / spacing);
    const row = Math.round((s.position.z - minZ) / spacing);
    expect(wildness[row * cols + col]).toBe(0);
  });
});
