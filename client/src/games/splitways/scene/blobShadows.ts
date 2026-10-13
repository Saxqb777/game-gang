/**
 * Blob ambient occlusion under each car: a soft dark quad lying on the road under the body, so cars
 * sit on the track even where the sun's shadow is thin or (Low preset, far away) absent. One
 * instanced quad per car, one draw call. It fades as wheels leave the ground.
 */
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';
import { SCENERY } from '../config';
import type { Car } from '../sim/car';
import { canvasTexture } from './textures';

/** Height above the averaged wheel contacts (m), on top of the polygon offset. */
const LIFT = 0.02;

const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();
const matrix = new Matrix4();
const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

export class BlobShadows {
  readonly mesh: InstancedMesh;
  private readonly opacity: InstancedBufferAttribute;

  constructor(count: number) {
    // Two falloffs in one texture: the wide body shadow and a tighter core under the tyres.
    const texture = canvasTexture(128, 64, (ctx) => {
      const image = ctx.createImageData(128, 64);
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 128; x++) {
          const u = (x + 0.5) / 64 - 1;
          const v = (y + 0.5) / 32 - 1;
          const r = Math.min(1, Math.hypot(u, v));
          const wide = Math.pow(1 - r, 1.6);
          // Core: 1.8 x 0.9 m inside the 4.4 x 2.2 m quad.
          const rc = Math.min(1, Math.hypot(u / (1.8 / 4.4), v / (0.9 / 2.2)));
          const core = Math.pow(1 - rc, 1.2) * (0.35 / SCENERY.blobOpacity);
          const a = Math.min(1, wide + core * (1 - wide));
          const i = (y * 128 + x) * 4;
          image.data[i] = 0;
          image.data[i + 1] = 0;
          image.data[i + 2] = 0;
          image.data[i + 3] = Math.round(a * 255);
        }
      }
      ctx.putImageData(image, 0, 0);
    });
    const geometry = new PlaneGeometry(SCENERY.blobWidth, SCENERY.blobLength);
    geometry.applyQuaternion(flat);
    this.opacity = new InstancedBufferAttribute(new Float32Array(count).fill(1), 1);
    this.opacity.setUsage(DynamicDrawUsage);
    geometry.setAttribute('blobOpacity', this.opacity);
    const material = new MeshBasicMaterial({
      map: texture,
      color: 0x000000,
      transparent: true,
      opacity: SCENERY.blobOpacity,
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
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vBlob;');
    };
    material.customProgramCacheKey = () => 'sw-blob-v1';
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
      scale.set(1, 1, 1);
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
    material.map?.dispose();
    material.dispose();
    this.mesh.dispose();
  }
}
