/**
 * The sea: one large plane with a standard PBR material (so it reflects the sky and the sun), plus
 * two layers of drifting ripples, turquoise shallows along the coast and foam at the waterline.
 */
import {
  DataTexture,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
} from 'three';
import { COAST, SEA_LEVEL } from '../track/terrain';

const NORMAL_MAP_SIZE = 256;
/** Ripple slope strength near the camera. */
const RIPPLE = 0.22;

/**
 * Tileable ripple normals from a fixed set of sine waves with whole-number frequencies (so the
 * texture wraps seamlessly). Small waves are weaker, like real water.
 */
function rippleNormals(): DataTexture {
  const waves: [number, number, number][] = [
    [1, 2, 0.4],
    [3, -1, 2.1],
    [-2, 3, 4.2],
    [5, 2, 1.3],
    [-4, -5, 5.5],
    [7, -3, 0.7],
    [-8, 5, 3.3],
    [9, 9, 2.6],
    [12, -7, 4.9],
    [-13, 2, 1.9],
    [16, 11, 0.2],
    [-17, -14, 3.8],
  ];
  const size = NORMAL_MAP_SIZE;
  const slopes = new Float32Array(size * size * 2);
  let maxSlope = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0;
      let dy = 0;
      for (const [kx, ky, phase] of waves) {
        const k = Math.hypot(kx, ky);
        const amplitude = 1 / k ** 1.5;
        const c = Math.cos(((kx * x + ky * y) / size) * Math.PI * 2 + phase) * amplitude;
        dx += c * kx;
        dy += c * ky;
      }
      const i = (y * size + x) * 2;
      slopes[i] = dx;
      slopes[i + 1] = dy;
      maxSlope = Math.max(maxSlope, Math.abs(dx), Math.abs(dy));
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const sx = (slopes[i * 2] ?? 0) / maxSlope;
    const sy = (slopes[i * 2 + 1] ?? 0) / maxSlope;
    data[i * 4] = Math.round((sx * 0.5 + 0.5) * 255);
    data[i * 4 + 1] = Math.round((sy * 0.5 + 0.5) * 255);
    // Blue: how flat the water is here; doubles as the foam pattern.
    data[i * 4 + 2] = Math.round((1 - Math.min(1, Math.hypot(sx, sy))) * 255);
    data[i * 4 + 3] = 255;
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

const coastGlsl = () =>
  COAST.base.toFixed(3) +
  COAST.waves
    .map(
      (w) =>
        ` + sin(x * ${w.frequency.toFixed(5)} + ${w.phase.toFixed(3)}) * ${w.amplitude.toFixed(3)}`,
    )
    .join('');

const FRAGMENT_PARS = () => /* glsl */ `
uniform float seaTime;
uniform sampler2D seaNormals;
varying vec3 vSeaWorld;
float seaCoast(float x) { return ${coastGlsl()}; }
`;

const FRAGMENT_COLOUR = /* glsl */ `
  // Metres out to sea from the shoreline (negative: over the beach slope).
  float offshore = vSeaWorld.z - seaCoast(vSeaWorld.x);
  float shallow = 1.0 - smoothstep(-6.0, 55.0, offshore);
  diffuseColor.rgb = mix(vec3(0.010, 0.045, 0.07), vec3(0.05, 0.30, 0.29), shallow * shallow);
  float swash = sin(seaTime * 0.8 + vSeaWorld.x * 0.07) * 1.2;
  float foamPattern = texture2D(seaNormals, vSeaWorld.xz * 0.12 + seaTime * 0.015).b;
  float seaFoam = (1.0 - smoothstep(0.0, 3.0, abs(offshore + 5.5 + swash)))
    * smoothstep(0.45, 0.85, foamPattern);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.83, 0.82), seaFoam);
`;

const FRAGMENT_NORMAL = /* glsl */ `
  vec2 seaUvA = vSeaWorld.xz * 0.035 + seaTime * vec2(0.010, 0.006);
  vec2 seaUvB = vSeaWorld.xz * 0.09 + seaTime * vec2(-0.007, 0.012);
  vec2 slope = (texture2D(seaNormals, seaUvA).xy * 2.0 - 1.0)
    + (texture2D(seaNormals, seaUvB).xy * 2.0 - 1.0) * 0.6;
  // Calmer in the distance, where ripples would only shimmer.
  slope *= ${RIPPLE.toFixed(3)} / (1.0 + distance(vSeaWorld, cameraPosition) * 0.003) * (1.0 - seaFoam);
  normal = normalize((viewMatrix * vec4(normalize(vec3(slope.x, 1.0, slope.y)), 0.0)).xyz);
`;

export class Sea {
  readonly mesh: Mesh<PlaneGeometry, MeshStandardMaterial>;
  private readonly normals = rippleNormals();
  private readonly time = { value: 0 };

  constructor() {
    const material = new MeshStandardMaterial({ roughness: 0.07, metalness: 0 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.seaTime = this.time;
      shader.uniforms.seaNormals = { value: this.normals };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSeaWorld;')
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvSeaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS()}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_COLOUR}`)
        .replace(
          '#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.85, seaFoam);',
        )
        .replace('#include <normal_fragment_maps>', FRAGMENT_NORMAL);
    };
    this.mesh = new Mesh(new PlaneGeometry(9000, 9000), material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = SEA_LEVEL;
  }

  update(dt: number): void {
    this.time.value += dt;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.normals.dispose();
  }
}
