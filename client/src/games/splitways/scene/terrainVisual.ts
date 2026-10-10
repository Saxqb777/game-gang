/**
 * The land: one height grid sampled from Terrain, cut into chunks so the camera only draws what it
 * can see. Normals come from the shared grid, so chunk edges are seamless. Untextured for now:
 * vertex colours blend forest grass and pine-needle litter in large noisy patches.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { fbm } from '../track/noise';
import type { Terrain } from '../track/terrain';

const SPACING = 5;
const CHUNK_CELLS = 24;
/** Forest floor colours (sRGB hex; Color converts them to linear for the vertex colours). */
const GRASS = new Color('#3f5f2a');
const NEEDLES = new Color('#5a4a32');

export interface TerrainBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function createTerrainVisual(terrain: Terrain, bounds: TerrainBounds): Group {
  const cols = Math.ceil((bounds.maxX - bounds.minX) / SPACING) + 1;
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / SPACING) + 1;
  const heights = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      heights[r * cols + c] = terrain.heightAt(
        bounds.minX + c * SPACING,
        bounds.minZ + r * SPACING,
      );
    }
  }
  const h = (c: number, r: number) =>
    heights[MathUtils.clamp(r, 0, rows - 1) * cols + MathUtils.clamp(c, 0, cols - 1)] as number;

  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const colour = new Color();

  const group = new Group();
  group.name = 'terrain';
  for (let r0 = 0; r0 < rows - 1; r0 += CHUNK_CELLS) {
    for (let c0 = 0; c0 < cols - 1; c0 += CHUNK_CELLS) {
      const r1 = Math.min(rows - 1, r0 + CHUNK_CELLS);
      const c1 = Math.min(cols - 1, c0 + CHUNK_CELLS);
      const w = c1 - c0 + 1;
      const d = r1 - r0 + 1;
      const positions = new Float32Array(w * d * 3);
      const normals = new Float32Array(w * d * 3);
      const colours = new Float32Array(w * d * 3);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const i = (r - r0) * w + (c - c0);
          const x = bounds.minX + c * SPACING;
          const z = bounds.minZ + r * SPACING;
          const y = h(c, r);
          positions.set([x, y, z], i * 3);
          // Central differences on the shared grid.
          const nx = h(c - 1, r) - h(c + 1, r);
          const nz = h(c, r - 1) - h(c, r + 1);
          const ny = 2 * SPACING;
          const length = Math.hypot(nx, ny, nz);
          normals.set([nx / length, ny / length, nz / length], i * 3);
          // Big patches of grass and needle litter, with a finer mottle so it never looks flat.
          const litter = MathUtils.smoothstep(fbm(x * 0.012, z * 0.012, 3), 0.38, 0.62);
          const mottle = 0.88 + 0.24 * fbm(x * 0.09 + 17, z * 0.09 - 5, 2);
          colour.lerpColors(GRASS, NEEDLES, litter).multiplyScalar(mottle);
          colours.set([colour.r, colour.g, colour.b], i * 3);
        }
      }
      const indices: number[] = [];
      for (let r = 0; r < d - 1; r++) {
        for (let c = 0; c < w - 1; c++) {
          const a = r * w + c;
          const b = a + 1;
          const e = a + w;
          const f = e + 1;
          indices.push(a, e, b, b, e, f);
        }
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new BufferAttribute(normals, 3));
      geometry.setAttribute('color', new BufferAttribute(colours, 3));
      geometry.setIndex(indices);
      geometry.computeBoundingSphere();
      const mesh = new Mesh(geometry, material);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  return group;
}
