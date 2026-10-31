/**
 * Blob ambient occlusion under each car: a soft dark quad lying on the road under the body, so cars
 * sit on the track even where the sun's shadow is thin or (Low preset, far away) absent. One
 * instanced quad per car, one draw call. It fades as wheels leave the ground.
 */
import {
  DataTexture,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  RGBAFormat,
  Vector3,
} from 'three';
import { CAR_VISUAL } from '../config';
import type { Car } from '../sim/car';
import { REFERENCE_SPEC } from '../sim/carSpec';

/** Height above the averaged wheel contacts (m), on top of the polygon offset. */
const LIFT = 0.02;

const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();
const matrix = new Matrix4();
const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

/**
 * The contact shadow's quad, lying flat and sized for the reference car (scale it to a car's
 * footprint), and its shade.
 */
function contactShadowParts(): { geometry: PlaneGeometry; texture: DataTexture } {
  // A rounded rectangle the size of the reference car's footprint, fully dark inside (it shows
  // between the wheels and under the sills) and fading out over `contactSpread` around it, so
  // the car sits on the road from every side, not only where the sun's shadow falls.
  const { width, length } = REFERENCE_SPEC.geometry;
  const spread = CAR_VISUAL.contactSpread;
  const halfX = width / 2 + spread;
  const halfZ = length / 2 + spread;
  const innerX = width / 2 - 0.05;
  const innerZ = length / 2 - 0.05;
  const corner = 0.3;
  const fade = spread + 0.05;
  const TX = 64;
  const TZ = 128;
  // Built as data, not on a canvas: drawn on a canvas, the black texels came back fully
  // transparent in our browser tests, so the shadow never showed. The shade is read as an alpha
  // map (its green channel).
  const data = new Uint8Array(TX * TZ * 4);
  for (let iz = 0; iz < TZ; iz++) {
    for (let ix = 0; ix < TX; ix++) {
      const x = Math.abs(((ix + 0.5) / TX - 0.5) * 2 * halfX);
      const z = Math.abs(((iz + 0.5) / TZ - 0.5) * 2 * halfZ);
      const qx = Math.max(x - (innerX - corner), 0);
      const qz = Math.max(z - (innerZ - corner), 0);
      const d = Math.hypot(qx, qz) - corner;
      const a = Math.round((d <= 0 ? 1 : Math.pow(1 - Math.min(1, d / fade), 1.25)) * 255);
      data.fill(a, (iz * TX + ix) * 4, (iz * TX + ix) * 4 + 4);
    }
  }
  const texture = new DataTexture(data, TX, TZ, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  const geometry = new PlaneGeometry(halfX * 2, halfZ * 2);
  geometry.applyQuaternion(flat);
  return { geometry, texture };
}

/** One contact shadow under a parked car (the podium), scaled to its footprint. */
export function createContactShadow(footprint: {
  width: number;
  length: number;
}): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const { geometry, texture } = contactShadowParts();
  const material = new MeshBasicMaterial({
    alphaMap: texture,
    color: 0x000000,
    transparent: true,
    opacity: CAR_VISUAL.contactOpacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -16,
  });
  const mesh = new Mesh(geometry, material);
  mesh.scale.set(
    footprint.width / REFERENCE_SPEC.geometry.width,
    1,
    footprint.length / REFERENCE_SPEC.geometry.length,
  );
  mesh.renderOrder = 1;
  return mesh;
}

export class BlobShadows {
  readonly mesh: InstancedMesh;
  private readonly opacity: InstancedBufferAttribute;

  constructor(count: number) {
    const { geometry, texture } = contactShadowParts();
    this.opacity = new InstancedBufferAttribute(new Float32Array(count).fill(1), 1);
    this.opacity.setUsage(DynamicDrawUsage);
    geometry.setAttribute('blobOpacity', this.opacity);
    const material = new MeshBasicMaterial({
      alphaMap: texture,
      color: 0x000000,
      transparent: true,
      opacity: CAR_VISUAL.contactOpacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -16,
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float blobOpacity;\nvarying float vBlob;',
        )
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlob = blobOpacity;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vBlob;')
        .replace(
          '#include <alphamap_fragment>',
          '#include <alphamap_fragment>\ndiffuseColor.a *= vBlob;',
        );
    };
    material.customProgramCacheKey = () => 'sw-blob-v2';
    this.mesh = new InstancedMesh(geometry, material, count);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    // The instances move all race, and three keeps an instanced mesh's first bounding sphere.
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
  }

  /** Each frame: under each car, lying along its body, at the average of its wheel contacts. */
  update(cars: readonly Car[], alpha: number): void {
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i] as Car;
      position.lerpVectors(car.prevPosition, car.position, alpha);
      quaternion.slerpQuaternions(car.prevQuaternion, car.quaternion, alpha);
      // Only grounded wheels have fresh contacts; the others keep stale ones (zero at spawn).
      // With none grounded the blob is invisible anyway, so its height does not matter.
      let y = 0;
      let grounded = 0;
      for (let k = 0; k < car.wheelContact.length; k++) {
        if (!car.wheelInContact[k]) continue;
        y += (car.wheelContact[k] as Vector3).y;
        grounded++;
      }
      if (grounded) position.y = y / grounded + LIFT;
      // The quad is sized for the reference car; each car's blob follows its own footprint.
      const { length, width } = car.spec.geometry;
      scale.set(width / REFERENCE_SPEC.geometry.width, 1, length / REFERENCE_SPEC.geometry.length);
      matrix.compose(position, quaternion, scale);
      this.mesh.setMatrixAt(i, matrix);
      this.opacity.setX(i, grounded ? car.groundedWheels / 4 : 0);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.opacity.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    const material = this.mesh.material as MeshBasicMaterial;
    material.alphaMap?.dispose();
    material.dispose();
    this.mesh.dispose();
  }
}
