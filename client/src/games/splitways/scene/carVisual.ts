/**
 * The cars you see: the runtime car files of spec 3.9 (`/cars/<id>/<id>.glb`, built by
 * `pnpm assets:cars`) with their own materials, three levels of detail and a shadow stand-in.
 *
 * Shared per car model: every geometry, texture and material except two. Per car on track: the
 * `paint` material of each level (the player's paint from `PAINTS`, with clearcoat and, on LOD0,
 * metallic flake) and the rear lamp material of each level (`light_tail`, brake lights).
 */
import type { CarId, ColourId } from '@gamergang/shared';
import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Texture,
  Vector3,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type PerspectiveCamera,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CAR_VISUAL, PAINTS } from '../config';
import { WHEEL_COUNT, type Car } from '../sim/car';
import { chooseLod, projectedDiameterPx, type CarLod } from './carLod';

/** Wheel order used everywhere: front left, front right, rear left, rear right. */
const WHEEL_SUFFIXES = ['fl', 'fr', 'rl', 'rr'] as const;
const LEVELS = [0, 1, 2] as const;
/** Car textures are seen at grazing angles (bonnet, flanks), so they get some anisotropic filtering. */
const TEXTURE_ANISOTROPY = 4;

const carUrl = (id: CarId) => `/cars/${id}/${id}.glb`;

/** Every texture a material samples. */
function texturesOf(material: Material): Texture[] {
  const found: Texture[] = [];
  for (const value of Object.values(material) as unknown[]) {
    if (value instanceof Texture) found.push(value as Texture);
  }
  return found;
}

function materialsOf(object: Object3D): Material[] {
  const material = (object as Mesh).material;
  return Array.isArray(material) ? material : [material];
}

/** The level of detail a node belongs to, from its own or an ancestor's `_lodN` name. */
function levelOf(object: Object3D): CarLod | null {
  for (let node: Object3D | null = object; node; node = node.parent) {
    const match = /_lod([012])$/.exec(node.name);
    if (match) return Number(match[1]) as CarLod;
  }
  return null;
}

function isTailLamp(material: Material): boolean {
  return material.name === 'light_tail' || material.userData.family === 'light_tail';
}

/** One car model as loaded, shared by every car of that model on track. */
interface CarTemplate {
  readonly scene: Object3D;
  /** Car-space centre and half diagonal of the body's bounding box (LOD selection). */
  readonly centre: Vector3;
  readonly radius: number;
  readonly shadow: BufferGeometry;
  /** Textures used at each level, so a preset can upload exactly the levels it may draw. */
  readonly texturesByLevel: readonly Set<Texture>[];
}

function prepareTemplate(carId: CarId, scene: Object3D): CarTemplate {
  const body0 = scene.getObjectByName('body_lod0');
  const shadowNode = scene.getObjectByName('shadow');
  if (!body0 || !(shadowNode instanceof Mesh)) {
    throw new Error(`Car file for ${carId} is missing body_lod0 or shadow`);
  }
  for (const name of ['body_lod1', 'body_lod2']) {
    if (!scene.getObjectByName(name)) throw new Error(`Car file for ${carId} is missing ${name}`);
  }
  for (const suffix of WHEEL_SUFFIXES) {
    if (!scene.getObjectByName(`wheel_${suffix}`)) {
      throw new Error(`Car file for ${carId} is missing wheel_${suffix}`);
    }
  }
  const texturesByLevel = LEVELS.map(() => new Set<Texture>());
  scene.traverse((object) => {
    if (!(object instanceof Mesh) || object === shadowNode) return;
    // The shadow stand-in casts the car's shadow (C5.3); the real meshes only receive.
    object.castShadow = false;
    object.receiveShadow = true;
    const level = levelOf(object) ?? 0;
    for (const material of materialsOf(object)) {
      for (const texture of texturesOf(material)) {
        texture.anisotropy = TEXTURE_ANISOTROPY;
        texturesByLevel[level]?.add(texture);
      }
    }
  });
  scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(body0);
  return {
    scene,
    centre: box.getCenter(new Vector3()),
    radius: box.getSize(new Vector3()).length() / 2,
    shadow: shadowNode.geometry as BufferGeometry,
    texturesByLevel,
  };
}

/** Loads the models of the cars in the race once and hands out per-player cars. */
export class CarModelLibrary {
  /**
   * The shadow stand-in's material: on the default layer (three culls shadow casters by the view
   * camera's layers), writing neither colour nor depth, so in the main pass it is invisible.
   */
  private readonly shadowMaterial = new MeshBasicMaterial({
    name: 'shadow',
    colorWrite: false,
    depthWrite: false,
  });

  private constructor(private readonly templates: ReadonlyMap<CarId, CarTemplate>) {}

  /** Fetches each car in the race once, in parallel. */
  static async load(carIds: readonly CarId[]): Promise<CarModelLibrary> {
    const loader = new GLTFLoader();
    const loaded = await Promise.all(
      [...new Set(carIds)].map(async (id) => {
        const gltf = await loader.loadAsync(carUrl(id));
        return [id, prepareTemplate(id, gltf.scene)] as const;
      }),
    );
    return new CarModelLibrary(new Map(loaded));
  }

  /** A car that was not loaded is a bug in the caller. */
  create(carId: CarId, paint: ColourId): CarVisual {
    const template = this.templates.get(carId);
    if (!template) throw new Error(`Car ${carId} was not loaded`);
    return new CarVisual(carId, template, paint, this.shadowMaterial);
  }

  /**
   * The textures of every loaded car at the levels a preset may draw (`floor` and coarser), so the
   * loading screen uploads them and the race never does. Low (floor 1) never uploads LOD0 maps.
   */
  textures(floor: 0 | 1): Texture[] {
    const all = new Set<Texture>();
    for (const template of this.templates.values()) {
      for (let level = floor; level < LEVELS.length; level++) {
        for (const texture of template.texturesByLevel[level] ?? []) all.add(texture);
      }
    }
    return [...all];
  }

  dispose(): void {
    this.shadowMaterial.dispose();
    const materials = new Set<Material>();
    for (const { scene } of this.templates.values()) {
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        (object.geometry as BufferGeometry).dispose();
        for (const material of materialsOf(object)) materials.add(material);
      });
    }
    for (const material of materials) {
      for (const texture of texturesOf(material)) texture.dispose();
      material.dispose();
    }
  }
}

/** Linear-light mean of a greyscale paint map, measured once per texture. */
const mapGains = new WeakMap<Texture, number>();

/**
 * How much to brighten a paint's greyscale detail map so its typical texel is white. Some source
 * cars keep a whole-car atlas under the paint at about 50-60% grey; multiplied straight onto the
 * paint colour that reads as a dull, dirty finish. Brightened (and clamped at white in the shader)
 * the map keeps its panel lines and occlusion but leaves the paint its own colour.
 */
function mapGain(texture: Texture): number {
  const known = mapGains.get(texture);
  if (known !== undefined) return known;
  let gain = 1;
  try {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(texture.image as CanvasImageSource, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        const srgb = ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)) / (3 * 255);
        sum += srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      }
      const mean = sum / (size * size);
      gain = Math.min(CAR_VISUAL.paintMapMaxGain, Math.max(1, 1 / Math.max(mean, 1e-3)));
    }
  } catch {
    // No canvas or an unreadable image: the map is used as it is.
  }
  mapGains.set(texture, gain);
  return gain;
}

/**
 * The LOD0 paint shader: the detail map brightened by `gain` (see `mapGain`) and metallic flake,
 * tiny facets under the clear coat, each tilted at random, so a metallic paint sparkles up close.
 * The clear coat keeps the smooth geometric normal. Flakes fade out once a cell is smaller than a
 * pixel, where they would only shimmer (the base metalness already carries the averaged look).
 * One program for every paint: the amounts are uniforms.
 */
function addPaintDetail(material: MeshPhysicalMaterial, flake: number, gain: number): void {
  const uniforms = {
    paintMapGain: { value: gain },
    flakeAmount: { value: flake * CAR_VISUAL.flakeTilt },
    flakeDensity: { value: CAR_VISUAL.flakeCellsPerMetre },
  };
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFlakePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlakePos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFlakePos;
uniform float paintMapGain;
uniform float flakeAmount;
uniform float flakeDensity;
vec3 swFlakeHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  diffuseColor *= vec4(min(sampledDiffuseColor.rgb * paintMapGain, vec3(1.0)), sampledDiffuseColor.a);
#endif`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  vec3 flakeCoord = vFlakePos * flakeDensity;
  vec3 flake = swFlakeHash(floor(flakeCoord)) * 2.0 - 1.0;
  float cellsPerPixel = length(fwidth(flakeCoord));
  float flakeFade = flakeAmount * (1.0 - smoothstep(0.35, 1.0, cellsPerPixel));
  normal = normalize(normal + flake * flakeFade);
  roughnessFactor *= 1.0 - 0.5 * flakeFade * step(0.6, flake.x * 0.5 + 0.5);
}`,
      );
  };
  material.customProgramCacheKey = () => 'sw-paint-lod0-v1';
}

/** The player's paint for one level: the template's greyscale detail maps under `PAINTS[paint]`. */
function paintMaterial(template: Material, paint: ColourId, level: CarLod): MeshPhysicalMaterial {
  const finish = PAINTS[paint];
  const source = template as MeshStandardMaterial;
  const material = new MeshPhysicalMaterial({
    name: 'paint',
    color: new Color(finish.hex),
    metalness: finish.metalness,
    roughness: finish.roughness,
    clearcoat: finish.clearcoat,
    clearcoatRoughness: finish.clearcoatRoughness,
    // Shading detail (panel lines, occlusion) stays; the finish is the paint's alone, so the
    // source's metal/roughness maps are left out.
    map: source.map,
    normalMap: source.normalMap,
    normalScale: source.normalScale.clone(),
    normalMapType: source.normalMapType,
    aoMap: source.aoMap,
    aoMapIntensity: source.aoMapIntensity,
    vertexColors: source.vertexColors,
    side: source.side,
  });
  if (level === 0) addPaintDetail(material, finish.flake, source.map ? mapGain(source.map) : 1);
  return material;
}

/** A rear lamp lens for one level: lit evenly in the brake light red, dim while rolling. */
function tailMaterial(template: Material): MeshStandardMaterial {
  const material = template.clone() as MeshStandardMaterial;
  material.emissive.setHex(CAR_VISUAL.tailColour);
  // The source emissive maps are mostly dark around the lenses; the lamp glows as a whole.
  material.emissiveMap = null;
  material.emissiveIntensity = CAR_VISUAL.tailRunning;
  return material;
}

const centre = new Vector3();

export class CarVisual {
  readonly root = new Group();
  /** The level of detail on show: 0 is the most detailed. */
  lod: CarLod = 1;
  /** Per-car materials (paint and rear lamps of every level), freed with the car. */
  private readonly own: Material[] = [];
  private readonly tailLamps: MeshStandardMaterial[] = [];
  /** Nodes drawn at each level. */
  private readonly levelNodes: Object3D[][] = [[], [], []];
  /** Steering and suspension pivots (rotate around Y) holding the spinning wheel nodes (X). */
  private readonly wheelPivots: Group[] = [];
  private readonly wheelNodes: Object3D[] = [];
  /** Hub height in the car file (at rest), per wheel. */
  private readonly restHeights = new Float32Array(WHEEL_COUNT);
  private readonly spin = new Float32Array(WHEEL_COUNT);
  /** The level last chosen in each viewport (LOD hysteresis is per view). */
  private readonly viewLevels: CarLod[] = [];

  constructor(
    readonly carId: CarId,
    private readonly template: CarTemplate,
    readonly paint: ColourId,
    shadowMaterial: Material,
  ) {
    const model = template.scene.clone(true);
    const paints = new Map<CarLod, MeshPhysicalMaterial>();
    const swap = (material: Material, level: CarLod): Material => {
      if (material.name === 'paint') {
        let mine = paints.get(level);
        if (!mine) {
          mine = paintMaterial(material, paint, level);
          paints.set(level, mine);
          this.own.push(mine);
        }
        return mine;
      }
      if (isTailLamp(material)) {
        const mine = tailMaterial(material);
        this.own.push(mine);
        this.tailLamps.push(mine);
        return mine;
      }
      return material;
    };
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (object.name === 'shadow') {
        object.material = shadowMaterial;
        object.castShadow = true;
        object.receiveShadow = false;
        return;
      }
      const level = levelOf(object) ?? 0;
      const swapped = materialsOf(object).map((m) => swap(m, level));
      object.material = swapped.length === 1 ? (swapped[0] as Material) : swapped;
    });

    for (const [i, suffix] of WHEEL_SUFFIXES.entries()) {
      const wheel = model.getObjectByName(`wheel_${suffix}`) as Object3D;
      const pivot = new Group();
      pivot.name = `pivot_${suffix}`;
      pivot.position.copy(wheel.position);
      model.add(pivot);
      pivot.add(wheel);
      wheel.position.set(0, 0, 0);
      // Front calipers steer with the wheel but never spin.
      const caliper = model.getObjectByName(`caliper_${suffix}`);
      if (caliper) {
        pivot.add(caliper);
        caliper.position.set(0, 0, 0);
      }
      this.wheelPivots.push(pivot);
      this.wheelNodes.push(wheel);
      this.restHeights[i] = pivot.position.y;
    }
    for (const level of LEVELS) {
      const nodes = this.levelNodes[level] as Object3D[];
      const body = model.getObjectByName(`body_lod${level}`);
      if (body) nodes.push(body);
      for (const suffix of WHEEL_SUFFIXES) {
        for (const kind of ['wheel', 'caliper']) {
          const node = model.getObjectByName(`${kind}_${suffix}_lod${level}`);
          if (node) nodes.push(node);
        }
      }
    }
    this.root.add(model);
    this.show(this.lod);
  }

  /** Interpolated pose plus wheel spin, steering, suspension travel and brake lights. */
  update(car: Car, alpha: number, dt: number): void {
    this.root.position.lerpVectors(car.prevPosition, car.position, alpha);
    this.root.quaternion.slerpQuaternions(car.prevQuaternion, car.quaternion, alpha);

    const rearLocked = car.input.handbrake;
    for (let i = 0; i < WHEEL_COUNT; i++) {
      const pivot = this.wheelPivots[i] as Group;
      const wheel = car.spec.wheels[i];
      if (!wheel) continue;
      // Suspension travel from rest, applied to the model's own hub height, so a wheel always sits
      // in its arch even where the physics hub and the model differ by a few millimetres.
      // Before the first physics step the suspension length is still 0: draw the wheel at rest.
      const suspension = car.wheelSuspension[i] ?? 0;
      const travel =
        suspension > 0 ? (car.mountHeights[i] ?? 0) - suspension - wheel.centreHeight : 0;
      pivot.position.y = (this.restHeights[i] ?? 0) + travel;
      if (i < 2) pivot.rotation.y = car.steerAngle;
      if (!(rearLocked && i >= 2)) {
        // Wrapped so the angle keeps its precision over a long race.
        const spin = ((this.spin[i] ?? 0) + (car.forwardSpeed * dt) / wheel.radius) % (Math.PI * 2);
        this.spin[i] = spin;
        (this.wheelNodes[i] as Object3D).rotation.x = spin;
      }
    }

    const braking =
      (car.input.brake > CAR_VISUAL.brakeThreshold &&
        car.forwardSpeed > CAR_VISUAL.brakeMinSpeed) ||
      car.input.handbrake;
    const glow = braking ? CAR_VISUAL.tailBrake : CAR_VISUAL.tailRunning;
    for (const lamp of this.tailLamps) lamp.emissiveIntensity = glow;
  }

  /**
   * Picks the level for one viewport from the car's projected size (spec 3.12) and shows it. Call
   * right before rendering that view; each view keeps its own level for the hysteresis.
   */
  selectLod(
    camera: PerspectiveCamera,
    viewHeightPx: number,
    floor: 0 | 1,
    viewIndex: number,
  ): void {
    this.root.updateWorldMatrix(true, false);
    centre.copy(this.template.centre).applyMatrix4(this.root.matrixWorld);
    const diameter = projectedDiameterPx(
      this.template.radius,
      centre.distanceTo(camera.position),
      camera.fov / camera.zoom,
      viewHeightPx,
    );
    const level = chooseLod(this.viewLevels[viewIndex] ?? this.lod, diameter, floor);
    this.viewLevels[viewIndex] = level;
    if (level !== this.lod) this.show(level);
  }

  /** The level this car last drew in a viewport (debug overlay). */
  lodInView(viewIndex: number): CarLod {
    return this.viewLevels[viewIndex] ?? this.lod;
  }

  /** Shows every level the preset may draw so the renderer compiles them all; returns the restore. */
  showAllForCompile(floor: 0 | 1): () => void {
    for (const level of LEVELS) {
      for (const node of this.levelNodes[level] ?? []) node.visible = level >= floor;
    }
    return () => {
      this.show(this.lod);
    };
  }

  dispose(): void {
    for (const material of this.own) material.dispose();
    this.root.removeFromParent();
  }

  private show(level: CarLod): void {
    this.lod = level;
    for (const l of LEVELS) {
      for (const node of this.levelNodes[l] ?? []) node.visible = l === level;
    }
  }
}
