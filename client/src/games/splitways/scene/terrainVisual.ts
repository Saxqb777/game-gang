/**
 * The land: the terrain heightfield as a mesh in chunks of 64 x 64 cells (320 m), so the camera
 * only draws what it can see. Normals come from the shared grid, so chunk edges are seamless, and
 * every cell is split along the same diagonal `Terrain.heightAt` uses, so props placed with it
 * neither float nor sink. A two-layer splat blends mown grass near the corridor into the forest
 * floor further out, darkened under the canopy.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Texture,
} from 'three';
import { SCENERY } from '../config';
import type { Terrain } from '../track/terrain';
import { linear, patchMaterial, tiled } from './materials';
import type { PbrSet } from './textures';

const CHUNK_CELLS = 64;

export interface TerrainVisual {
  group: Group;
  stats: { chunks: number };
  dispose(): void;
}

const v3 = (c: readonly [number, number, number]) =>
  `vec3(${c.map((n) => n.toFixed(3)).join(', ')})`;

function splatMaterial(grass: PbrSet, forest: PbrSet, owned: Texture[]): MeshStandardMaterial {
  const map = tiled(grass.map, SCENERY.terrainGrassTile);
  const normalMap = tiled(grass.normalMap, SCENERY.terrainGrassTile);
  const arm = tiled(grass.arm, SCENERY.terrainGrassTile);
  owned.push(map, normalMap, arm);
  const ratio = (SCENERY.terrainGrassTile / SCENERY.forestTile).toFixed(4);
  const grassTint = linear(SCENERY.terrainGrassColour);
  const forestTint = linear(SCENERY.forestFloorColour);
  const material = new MeshStandardMaterial({
    map,
    normalMap,
    roughnessMap: arm,
    aoMap: arm,
    roughness: 1,
    metalness: 0,
  });
  material.normalScale.set(0.8, 0.8);
  return patchMaterial(material, {
    key: 'sw-terrain-splat-v1',
    uniforms: {
      swForestMap: { value: forest.map },
      swForestNormal: { value: forest.normalMap },
      swForestArm: { value: forest.arm },
    },
    vertexHead: `attribute float wildness;\nvarying float vWild;`,
    vertex: `vWild = wildness;`,
    fragmentHead: /* glsl */ `
      uniform sampler2D swForestMap;
      uniform sampler2D swForestNormal;
      uniform sampler2D swForestArm;
      varying float vWild;`,
    afterMap: /* glsl */ `
      // Grass near the corridor, forest floor beyond the shoulder, a noisy edge between them.
      float swW = smoothstep(0.2, 0.8, vWild + (swNoise(vSwWorld.xz * 0.045) - 0.5) * 0.6);
      vec2 swForestUv = vMapUv * ${ratio};
      vec4 swForestArmTexel = texture2D(swForestArm, swForestUv);
      vec3 swGrassC = diffuseColor.rgb * ${v3([grassTint.r, grassTint.g, grassTint.b])};
      vec3 swForestC = texture2D(swForestMap, swForestUv).rgb * ${v3([forestTint.r, forestTint.g, forestTint.b])};
      // Moss in the forest, and broad light and dark patches everywhere so no tile repeats show.
      float swMoss = smoothstep(0.55, 0.75, swNoise(vSwWorld.xz * 0.06 + 31.0));
      swForestC *= mix(vec3(1.0), vec3(0.8, 1.05, 0.8), swMoss);
      float swMacro = 0.88 + 0.24 * swNoise(vSwWorld.xz * 0.02) ;
      diffuseColor.rgb = mix(swGrassC, swForestC, swW) * swMacro
        * (1.0 - ${SCENERY.canopyDarkening.toFixed(3)} * vWild);`,
    afterRoughness: `roughnessFactor = mix(roughnessFactor, swForestArmTexel.g, swW);`,
    normalMaps: /* glsl */ `
      vec3 mapN = mix(texture2D(normalMap, vNormalMapUv).xyz,
                      texture2D(swForestNormal, swForestUv).xyz, swW) * 2.0 - 1.0;
      mapN.xy *= normalScale;
      normal = normalize(tbn * mapN);`,
    aoMap: /* glsl */ `
      // The grass AO is the roughness texel's red channel (one packed texture), so no extra fetch.
      float ambientOcclusion = mix(texelRoughness.r, swForestArmTexel.r, swW);
      reflectedLight.indirectDiffuse *= ambientOcclusion;
      #if defined( USE_ENVMAP ) && defined( STANDARD )
        float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
        reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
      #endif
      // Grass and leaf litter are matte: little sheen into the low sun.
      reflectedLight.directSpecular *= 0.3;
      reflectedLight.indirectSpecular *= 0.5;`,
  });
}

/** The PBR sets are owned by the caller. */
export function createTerrainVisual(
  terrain: Terrain,
  textures: { grass: PbrSet; forest: PbrSet },
): TerrainVisual {
  const { minX, minZ, spacing, cols, rows, heights, wildness } = terrain.field;
  const h = (c: number, r: number) =>
    heights[
      Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))
    ] as number;
  const owned: Texture[] = [];
  const material = splatMaterial(textures.grass, textures.forest, owned);
  const geometries: BufferGeometry[] = [];
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
      const uvs = new Float32Array(w * d * 2);
      const wild = new Float32Array(w * d);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const i = (r - r0) * w + (c - c0);
          const x = minX + c * spacing;
          const z = minZ + r * spacing;
          positions[i * 3] = x;
          positions[i * 3 + 1] = h(c, r);
          positions[i * 3 + 2] = z;
          // Central differences on the shared grid.
          const nx = h(c - 1, r) - h(c + 1, r);
          const nz = h(c, r - 1) - h(c, r + 1);
          const ny = 2 * spacing;
          const length = Math.hypot(nx, ny, nz);
          normals[i * 3] = nx / length;
          normals[i * 3 + 1] = ny / length;
          normals[i * 3 + 2] = nz / length;
          // uv in metres; the material tiles it.
          uvs[i * 2] = x;
          uvs[i * 2 + 1] = z;
          wild[i] = wildness[r * cols + c] as number;
        }
      }
      // Each cell splits along its (col, row + 1)-(col + 1, row) diagonal, like Terrain.heightAt:
      // triangles (00, 01, 10) and (01, 11, 10), counter-clockwise seen from above.
      const indices = new Uint32Array((w - 1) * (d - 1) * 6);
      let k = 0;
      for (let r = 0; r < d - 1; r++) {
        for (let c = 0; c < w - 1; c++) {
          const i00 = r * w + c;
          const i10 = i00 + 1;
          const i01 = i00 + w;
          const i11 = i01 + 1;
          indices.set([i00, i01, i10, i01, i11, i10], k);
          k += 6;
        }
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
      geometry.setAttribute('wildness', new BufferAttribute(wild, 1));
      geometry.setIndex(new BufferAttribute(indices, 1));
      geometry.computeBoundingSphere();
      geometries.push(geometry);
      const mesh = new Mesh(geometry, material);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      group.add(mesh);
    }
  }
  return {
    group,
    stats: { chunks: geometries.length },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      material.dispose();
      for (const texture of owned) texture.dispose();
      group.removeFromParent();
    },
  };
}
