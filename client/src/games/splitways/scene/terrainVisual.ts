/**
 * The land: one height grid sampled from Terrain, cut into chunks so the camera only draws what it
 * can see. Normals come from the shared grid, so chunk edges are seamless.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { SEA_LEVEL, type Terrain } from '../track/terrain';
import type { PbrSet } from './textures';

const SPACING = 5;
const CHUNK_CELLS = 24;
const SAND_TILE = 6;

export interface TerrainBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function createTerrainVisual(terrain: Terrain, sand: PbrSet, bounds: TerrainBounds): Group {
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

  for (const texture of [sand.map, sand.normalMap, sand.arm]) texture.repeat.set(1, 1);
  const material = new MeshStandardMaterial({
    color: 0xf0d9b0,
    map: sand.map,
    normalMap: sand.normalMap,
    aoMap: sand.arm,
    roughnessMap: sand.arm,
    metalnessMap: sand.arm,
    metalness: 1,
    roughness: 1,
    vertexColors: true,
  });

  const group = new Group();
  group.name = 'terrain';
  for (let r0 = 0; r0 < rows - 1; r0 += CHUNK_CELLS) {
    for (let c0 = 0; c0 < cols - 1; c0 += CHUNK_CELLS) {
      const r1 = Math.min(rows - 1, r0 + CHUNK_CELLS);
      const c1 = Math.min(cols - 1, c0 + CHUNK_CELLS);
      let highest = -Infinity;
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) highest = Math.max(highest, h(c, r));
      // Fully under the sea: nobody will ever see it.
      if (highest < SEA_LEVEL - 0.6) continue;

      const w = c1 - c0 + 1;
      const d = r1 - r0 + 1;
      const positions = new Float32Array(w * d * 3);
      const normals = new Float32Array(w * d * 3);
      const uvs = new Float32Array(w * d * 2);
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
          uvs.set([x / SAND_TILE, z / SAND_TILE], i * 2);
          // Wet, darker sand at the waterline; dune tops a touch lighter; large-scale variation.
          const wet = MathUtils.smoothstep(y, SEA_LEVEL - 0.2, SEA_LEVEL + 0.9);
          const crest = 1 + MathUtils.clamp(y / 25, 0, 1) * 0.07;
          const patch = 0.93 + 0.1 * (0.5 + 0.5 * Math.sin(x * 0.013 + Math.sin(z * 0.009) * 2));
          const shade = MathUtils.lerp(0.66, 1, wet) * crest * patch;
          colours.set(
            [shade, shade * MathUtils.lerp(0.93, 1, wet), shade * MathUtils.lerp(0.85, 1, wet)],
            i * 3,
          );
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
      geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
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
