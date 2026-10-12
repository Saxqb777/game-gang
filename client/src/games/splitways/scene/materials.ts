/**
 * Small shader patches on three's standard material for the track dressing: a world-position
 * varying, a cheap value noise, and code spliced in after the colour map, the roughness map or
 * the normal map. Each patched material gets its own program cache key, or three would share one
 * program between materials whose patch closures look the same (`Material.js` customProgramCacheKey).
 */
import type { MeshStandardMaterial } from 'three';
import {
  Color,
  LinearSRGBColorSpace,
  type IUniform,
  type MeshStandardMaterialParameters,
  type Texture,
} from 'three';
import type { PbrSet } from './textures';

/** Value noise in [0, 1] and a hash; GLSL, for the fragment shaders. */
export const GLSL_NOISE = /* glsl */ `
float swHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float swNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(swHash(i), swHash(i + vec2(1.0, 0.0)), f.x),
             mix(swHash(i + vec2(0.0, 1.0)), swHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

export interface ShaderPatch {
  /** Unique per patch: three caches programs by it. */
  key: string;
  uniforms?: Record<string, IUniform>;
  /** Vertex declarations (attributes, varyings). `vSwWorld` (world position) is always there. */
  vertexHead?: string;
  /** Vertex code after `begin_vertex` (`transformed` is the local position). */
  vertex?: string;
  /** Fragment declarations (uniforms, varyings, functions). */
  fragmentHead?: string;
  /** After `map_fragment`: change `diffuseColor`. */
  afterMap?: string;
  /** After `roughnessmap_fragment`: change `roughnessFactor`. */
  afterRoughness?: string;
  /** Replaces `normal_fragment_maps` (only with a normal map). */
  normalMaps?: string;
  /** Replaces `aomap_fragment` (only with an AO map). */
  aoMap?: string;
  /** After `aomap_fragment`: change `reflectedLight` before it is summed. */
  afterAo?: string;
}

/** Applies a patch to a standard material through onBeforeCompile. */
export function patchMaterial<T extends MeshStandardMaterial>(material: T, patch: ShaderPatch): T {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, patch.uniforms ?? {});
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vSwWorld;\n${patch.vertexHead ?? ''}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 swWorld = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            swWorld = instanceMatrix * swWorld;
          #endif
          vSwWorld = (modelMatrix * swWorld).xyz;
        }
        ${patch.vertex ?? ''}`,
      );
    let fragment = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\nvarying vec3 vSwWorld;\n${GLSL_NOISE}\n${patch.fragmentHead ?? ''}`,
    );
    if (patch.afterMap) {
      fragment = fragment.replace(
        '#include <map_fragment>',
        `#include <map_fragment>\n${patch.afterMap}`,
      );
    }
    if (patch.afterRoughness) {
      fragment = fragment.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>\n${patch.afterRoughness}`,
      );
    }
    if (patch.normalMaps)
      fragment = fragment.replace('#include <normal_fragment_maps>', patch.normalMaps);
    if (patch.aoMap) fragment = fragment.replace('#include <aomap_fragment>', patch.aoMap);
    if (patch.afterAo) {
      fragment = fragment.replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>\n${patch.afterAo}`,
      );
    }
    shader.fragmentShader = fragment;
  };
  material.customProgramCacheKey = () => patch.key;
  return material;
}

/** A texture sharing the original's image (one GPU upload) with its own repeat. */
export function tiled(texture: Texture, metres: number): Texture {
  const copy = texture.clone();
  copy.repeat.set(1 / metres, 1 / metres);
  return copy;
}

/** A PBR set as standard-material maps, tiled to `metres` (uv in metres); the clones are listed in `owned`. */
export function pbrMaps(
  set: PbrSet,
  metres: number,
  owned: Texture[],
): Pick<MeshStandardMaterialParameters, 'map' | 'normalMap' | 'roughnessMap' | 'aoMap'> {
  const map = tiled(set.map, metres);
  const normalMap = tiled(set.normalMap, metres);
  const arm = tiled(set.arm, metres);
  owned.push(map, normalMap, arm);
  return { map, normalMap, roughnessMap: arm, aoMap: arm };
}

/** A colour from linear RGB (multipliers above 1 are allowed: texture albedo corrections). */
export function linear(rgb: readonly [number, number, number]): Color {
  return new Color().setRGB(rgb[0], rgb[1], rgb[2], LinearSRGBColorSpace);
}
