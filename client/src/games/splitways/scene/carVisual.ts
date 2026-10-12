/**
 * The car you see: the CC0 sports car model (see assets/ASSETS.md) with our own PBR materials.
 * Paint and tail lights are per car (player colour, brake lights); everything else is shared.
 */
import {
  Color,
  Group,
  type BufferGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Car, WHEEL_COUNT } from '../sim/car';
import { WHEELS } from '../config';

const MODEL_URL = '/models/sports-car.glb';
const WHEEL_NODE_NAMES = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'] as const;
/** The whole model as one position-only geometry, wheels at rest. */
function mergedSilhouette(model: Object3D): BufferGeometry {
  model.updateMatrixWorld(true);
  const toRoot = new Matrix4().copy(model.matrixWorld).invert();
  const parts: BufferGeometry[] = [];
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const part = (object.geometry as BufferGeometry).clone();
    for (const name of Object.keys(part.attributes))
      if (name !== 'position') part.deleteAttribute(name);
    part.clearGroups();
    part.applyMatrix4(new Matrix4().multiplyMatrices(toRoot, object.matrixWorld));
    parts.push(part.index ? part.toNonIndexed() : part);
  });
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

interface SharedMaterials {
  trim: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  glass: MeshPhysicalMaterial;
  headlight: MeshStandardMaterial;
  rim: MeshStandardMaterial;
  tyre: MeshStandardMaterial;
}

function createSharedMaterials(): SharedMaterials {
  return {
    trim: new MeshStandardMaterial({
      name: 'trim',
      color: 0x0d0e11,
      roughness: 0.45,
      metalness: 0.3,
    }),
    accent: new MeshStandardMaterial({
      name: 'accent',
      color: 0xe8e9ee,
      roughness: 0.3,
      metalness: 0.1,
    }),
    glass: new MeshPhysicalMaterial({
      name: 'glass',
      color: 0x06080d,
      roughness: 0.04,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.4,
    }),
    headlight: new MeshStandardMaterial({
      name: 'headlight',
      color: 0xffffff,
      emissive: 0xfff1d6,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    }),
    rim: new MeshStandardMaterial({ name: 'rim', color: 0xc3c7cf, roughness: 0.22, metalness: 1 }),
    tyre: new MeshStandardMaterial({
      name: 'tyre',
      color: 0x121212,
      roughness: 0.92,
      metalness: 0,
    }),
  };
}

/** Loads the model once and hands out per-player cars. */
export class CarModelLibrary {
  private readonly silhouette: BufferGeometry;
  /**
   * The shadow-only stand-in: the whole car merged into one mesh, so each shadow pass draws one call
   * per car instead of fourteen. It sits on the default layer (three culls shadow casters by the
   * view camera's layers) and writes neither colour nor depth, so in the main pass it is invisible.
   */
  private readonly silhouetteMaterial = new MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
  });

  private constructor(
    private readonly template: Object3D,
    private readonly shared: SharedMaterials,
  ) {
    this.silhouette = mergedSilhouette(template);
  }

  static async load(): Promise<CarModelLibrary> {
    const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    return new CarModelLibrary(gltf.scene, createSharedMaterials());
  }

  create(colourHex: string): CarVisual {
    const visual = new CarVisual(this.template.clone(true), this.shared, colourHex);
    const proxy = new Mesh(this.silhouette, this.silhouetteMaterial);
    proxy.castShadow = true;
    visual.root.add(proxy);
    return visual;
  }

  dispose(): void {
    const { trim, accent, glass, headlight, rim, tyre } = this.shared;
    for (const material of [trim, accent, glass, headlight, rim, tyre]) material.dispose();
    this.silhouette.dispose();
    this.silhouetteMaterial.dispose();
    this.template.traverse((object) => {
      if (object instanceof Mesh) (object.geometry as BufferGeometry).dispose();
    });
  }
}

export class CarVisual {
  readonly root = new Group();
  readonly paint: MeshPhysicalMaterial;
  private readonly tailLight: MeshStandardMaterial;
  /** Steering pivots (rotate around Y) holding the spinning wheel meshes (rotate around X). */
  private readonly wheelPivots: Group[] = [];
  private readonly wheelMeshes: Object3D[] = [];
  private spin = 0;

  constructor(model: Object3D, shared: SharedMaterials, colourHex: string) {
    this.paint = new MeshPhysicalMaterial({
      name: 'paint',
      color: new Color(colourHex),
      metalness: 0.55,
      roughness: 0.34,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    });
    this.tailLight = new MeshStandardMaterial({
      name: 'taillight',
      color: 0x3a0000,
      emissive: 0xff1418,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    const byName: Record<string, Material> = {
      ...shared,
      paint: this.paint,
      taillight: this.tailLight,
    };

    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      // The merged stand-in casts the shadow (see CarModelLibrary.silhouetteMaterial).
      object.castShadow = false;
      object.receiveShadow = true;
      const materials = (
        Array.isArray(object.material) ? object.material : [object.material]
      ) as Material[];
      const mapped = materials.map((m) => byName[m.name] ?? shared.trim);
      object.material = mapped.length === 1 ? (mapped[0] as Material) : mapped;
    });

    this.root.add(model);
    for (const name of WHEEL_NODE_NAMES) {
      const wheel = model.getObjectByName(name);
      if (!wheel) throw new Error(`Car model is missing ${name}`);
      const pivot = new Group();
      pivot.position.copy(wheel.position);
      wheel.parent?.add(pivot);
      wheel.position.set(0, 0, 0);
      pivot.add(wheel);
      this.wheelPivots.push(pivot);
      this.wheelMeshes.push(wheel);
    }
  }

  /** Interpolated pose plus wheel spin, steering and suspension travel. */
  update(car: Car, alpha: number, dt: number): void {
    this.root.position.lerpVectors(car.prevPosition, car.position, alpha);
    this.root.quaternion.slerpQuaternions(car.prevQuaternion, car.quaternion, alpha);

    this.spin += (car.forwardSpeed * dt) / WHEELS.radius;
    const rearLocked = car.input.handbrake;
    for (let i = 0; i < WHEEL_COUNT; i++) {
      const pivot = this.wheelPivots[i] as Group;
      const mesh = this.wheelMeshes[i] as Object3D;
      pivot.position.y = Car.mountHeight - (car.wheelSuspension[i] ?? WHEELS.suspensionRestLength);
      if (i < 2) pivot.rotation.y = car.steerAngle;
      if (!(rearLocked && i >= 2)) mesh.rotation.x = this.spin;
    }

    const braking = car.input.brake > 0.05 && car.forwardSpeed > 0.5;
    this.tailLight.emissiveIntensity = braking || car.input.handbrake ? 5 : 1.2;
  }

  dispose(): void {
    this.paint.dispose();
    this.tailLight.dispose();
    this.root.removeFromParent();
  }
}
