/**
 * What items and boosts look like: spinning mystery boxes, oil slicks, rockets and the bounty
 * drone, shield bubbles, shockwave rings, explosions, exhaust flames while boosting, drift sparks
 * and the glowing boost pads. Instanced or pooled, so a frame allocates nothing.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Material,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ITEMS } from '../config';
import type { Boosts } from '../race/boosts';
import type { Items } from '../race/items';
import type { Car } from '../sim/car';
import type { Track } from '../track/track';
import type { Dust } from './dust';
import { Particles } from './particles';
import { canvasTexture } from './textures';

const SPARK_COLOURS: readonly (readonly [number, number, number])[] = [
  [0.25, 0.65, 1],
  [1, 0.55, 0.12],
  [0.8, 0.3, 1],
];
const RING_SECONDS = 0.45;
const BLAST_SECONDS = 0.5;
const PAD_CURTAIN_HEIGHT = 0.9;
/** Sparkles rising off each boost pad per second. */
const PAD_SPARKLES = 10;
/** Exhaust tips in the car's own frame (it faces +Z). */
const EXHAUSTS = [new Vector3(0.42, 0.42, -2.3), new Vector3(-0.42, 0.42, -2.3)];

const dummy = new Object3D();
const colour = new Color();
const scratch = new Vector3();

const SHIELD_VERTEX = /* glsl */ `
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewDir = normalize(-view.xyz);
  gl_Position = projectionMatrix * view;
}`;

const SHIELD_FRAGMENT = /* glsl */ `
uniform vec3 colour;
uniform float strength;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  float rim = pow(1.0 - abs(dot(vNormalView, vViewDir)), 4.0);
  gl_FragColor = vec4(colour * rim * 0.55 * strength, 1.0);
}`;

/** Explosion flash: hot core, soft orange edge, so it reads as fire and not as a solid ball. */
const FIREBALL_VERTEX = /* glsl */ `
varying vec3 vNormalView;
varying vec3 vViewDir;
varying float vHeat;
void main() {
  vec4 view = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vNormalView = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vViewDir = normalize(-view.xyz);
  vHeat = instanceColor.r;
  gl_Position = projectionMatrix * view;
}`;

const FIREBALL_FRAGMENT = /* glsl */ `
varying vec3 vNormalView;
varying vec3 vViewDir;
varying float vHeat;
void main() {
  float facing = clamp(dot(normalize(vNormalView), normalize(vViewDir)), 0.0, 1.0);
  float core = facing * facing * facing;
  vec3 fire = mix(vec3(1.0, 0.3, 0.05), vec3(1.0, 0.8, 0.45), core);
  gl_FragColor = vec4(fire * vHeat * (0.15 + 0.85 * core) * facing, 1.0);
}`;

function questionTexture(): Texture {
  return canvasTexture(
    128,
    128,
    (ctx) => {
      const gradient = ctx.createLinearGradient(0, 0, 128, 128);
      gradient.addColorStop(0, '#1fe0e6');
      gradient.addColorStop(0.5, '#9b5cff');
      gradient.addColorStop(1, '#ff4fb0');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, 116, 116);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 92px "Chakra Petch", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 64, 70);
    },
    4,
  );
}

function oilTexture(): Texture {
  return canvasTexture(128, 128, (ctx) => {
    const blob = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    blob.addColorStop(0, 'rgba(10,12,16,0.95)');
    blob.addColorStop(0.75, 'rgba(14,16,22,0.9)');
    blob.addColorStop(1, 'rgba(14,16,22,0)');
    ctx.fillStyle = blob;
    ctx.fillRect(0, 0, 128, 128);
    // A rainbow sheen.
    const sheen = ctx.createLinearGradient(20, 30, 108, 100);
    sheen.addColorStop(0, 'rgba(120,80,255,0.35)');
    sheen.addColorStop(0.5, 'rgba(40,230,200,0.3)');
    sheen.addColorStop(1, 'rgba(255,200,60,0.25)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.ellipse(60, 58, 34, 22, -0.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function chevronTexture(): Texture {
  return canvasTexture(128, 128, (ctx) => {
    // A see-through panel with bright edges. Chevrons point up the canvas: forward along the road.
    ctx.fillStyle = 'rgba(20,150,255,0.34)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(150,245,255,0.95)';
    ctx.fillRect(0, 0, 9, 128);
    ctx.fillRect(119, 0, 9, 128);
    ctx.strokeStyle = '#d4fdff';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const y of [36, 92]) {
      ctx.beginPath();
      ctx.moveTo(26, y + 22);
      ctx.lineTo(64, y - 12);
      ctx.lineTo(102, y + 22);
      ctx.stroke();
    }
  });
}

interface PadStep {
  left: Vector3;
  right: Vector3;
  /** 0 at the start of the pad, 1 at the end. */
  along: number;
}

/** Both long edges of each pad, every metre along it, following the road. */
function padSteps(track: Track, boosts: Boosts): PadStep[][] {
  return boosts.pads.map((pad) => {
    const count = Math.round(pad.halfLength * 2);
    const steps: PadStep[] = [];
    for (let k = 0; k <= count; k++) {
      const s = track.sampleAt(pad.sample.distance - pad.halfLength + k);
      const at = (lateral: number) =>
        new Vector3(
          s.position.x + s.right.x * lateral,
          s.position.y + 0.03,
          s.position.z + s.right.z * lateral,
        );
      steps.push({
        left: at(pad.lateral - pad.halfWidth),
        right: at(pad.lateral + pad.halfWidth),
        along: k / count,
      });
    }
    return steps;
  });
}

/** The pads: a strip of quads on the road, facing up. */
function padGeometry(track: Track, boosts: Boosts): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const steps of padSteps(track, boosts)) {
    const base = positions.length / 3;
    steps.forEach(({ left, right, along }, k) => {
      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      uvs.push(0, along * 2, 1, along * 2);
      // Quad back to the previous step, counter-clockwise from above.
      const a = base + (k - 1) * 2;
      if (k > 0) indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    });
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * Light curtains on both long edges, fading upwards. From a low chase camera the flat panel is
 * foreshortened to a sliver; the curtains show where a pad is from far away.
 */
function padCurtainGeometry(track: Track, boosts: Boosts): BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  for (const steps of padSteps(track, boosts)) {
    for (const edge of ['left', 'right'] as const) {
      const base = positions.length / 3;
      steps.forEach((step, k) => {
        const p = step[edge];
        positions.push(p.x, p.y, p.z, p.x, p.y + PAD_CURTAIN_HEIGHT, p.z);
        // RGBA: bright at the road, fading out at the top. Double sided, so winding doesn't matter.
        colours.push(0.05, 0.8, 2.4, 0.85, 0.05, 0.8, 2.4, 0);
        const a = base + (k - 1) * 2;
        if (k > 0) indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      });
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 4));
  geometry.setIndex(indices);
  return geometry;
}

function rocketGeometry(): BufferGeometry {
  const body = new CylinderGeometry(0.17, 0.17, 1.1, 10);
  body.rotateX(Math.PI / 2);
  const nose = new ConeGeometry(0.17, 0.45, 10);
  nose.rotateX(Math.PI / 2);
  nose.translate(0, 0, 0.77);
  const finA = new BoxGeometry(0.75, 0.04, 0.3);
  finA.translate(0, 0, -0.42);
  const finB = new BoxGeometry(0.04, 0.75, 0.3);
  finB.translate(0, 0, -0.42);
  const merged = mergeGeometries([
    body.toNonIndexed(),
    nose.toNonIndexed(),
    finA.toNonIndexed(),
    finB.toNonIndexed(),
  ]);
  for (const g of [body, nose, finA, finB]) g.dispose();
  return merged;
}

function droneGeometry(): BufferGeometry {
  // Octahedrons are built without an index; the torus has one.
  const core = new OctahedronGeometry(0.6);
  const ring = new TorusGeometry(1.05, 0.07, 8, 32);
  ring.rotateX(Math.PI / 2);
  const merged = mergeGeometries([core, ring.toNonIndexed()]);
  core.dispose();
  ring.dispose();
  return merged;
}

interface Pulse {
  active: boolean;
  age: number;
  position: Vector3;
  /** Largest radius (m). */
  size: number;
}

export class ItemVisuals {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: Texture[] = [];
  private readonly sparks = new Particles({
    max: 600,
    additive: true,
    light: [3, 3, 3],
    hardness: 0.55,
  });
  private readonly padTexture: Texture;
  private readonly curtainMaterial: MeshBasicMaterial;
  private readonly flames: Mesh[][] = [];
  private readonly shields: Mesh<SphereGeometry, ShaderMaterial>[] = [];
  private readonly shieldFlash: number[] = [];
  private readonly boxMesh: InstancedMesh | null = null;
  private readonly boxScale: number[] = [];
  private readonly slickMesh: InstancedMesh | null = null;
  private readonly rocketMesh: InstancedMesh | null = null;
  private readonly glowMesh: InstancedMesh | null = null;
  private readonly droneMesh: InstancedMesh | null = null;
  private readonly ringMesh: InstancedMesh;
  private readonly blastMesh: InstancedMesh;
  private readonly rings: Pulse[] = [];
  private readonly blasts: Pulse[] = [];

  constructor(
    track: Track,
    private readonly boosts: Boosts,
    private readonly items: Items | null,
    private readonly cars: readonly Car[],
    roots: readonly Object3D[],
    colours: readonly string[],
    private readonly dust: Dust,
  ) {
    this.group.add(this.sparks.mesh);

    // Boost pads: one glowing mesh for all of them with chevrons scrolling forward, plus the
    // light curtains on their edges.
    this.padTexture = this.texture(chevronTexture());
    const padMaterial = this.material(
      new MeshBasicMaterial({
        map: this.padTexture,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    padMaterial.color.setRGB(2.2, 2.2, 2.2);
    this.group.add(new Mesh(this.geometry(padGeometry(track, boosts)), padMaterial));
    this.curtainMaterial = this.material(
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.group.add(
      new Mesh(this.geometry(padCurtainGeometry(track, boosts)), this.curtainMaterial),
    );

    // Exhaust flames and a shield bubble on every car.
    const flameGeometry = this.geometry(new ConeGeometry(0.17, 1, 10, 1, true));
    flameGeometry.rotateX(-Math.PI / 2);
    flameGeometry.translate(0, 0, -0.5);
    const flameMaterial = this.material(
      new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false }),
    );
    flameMaterial.color.setRGB(3, 1.3, 0.35);
    const shieldGeometry = this.geometry(new SphereGeometry(1, 24, 16));
    roots.forEach((root, i) => {
      const pair = EXHAUSTS.map((offset) => {
        const flame = new Mesh(flameGeometry, flameMaterial);
        flame.position.copy(offset);
        flame.visible = false;
        root.add(flame);
        return flame;
      });
      this.flames.push(pair);
      colour.set(colours[i] ?? '#ffffff');
      const shield = new Mesh(
        shieldGeometry,
        this.material(
          new ShaderMaterial({
            vertexShader: SHIELD_VERTEX,
            fragmentShader: SHIELD_FRAGMENT,
            uniforms: { colour: { value: colour.clone() }, strength: { value: 1 } },
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
          }),
        ),
      );
      shield.scale.set(1.3, 0.9, 2.6);
      shield.position.y = 0.7;
      shield.visible = false;
      root.add(shield);
      this.shields.push(shield);
      this.shieldFlash.push(0);
    });

    // Pulses: shockwave rings and explosion flashes.
    const ringGeometry = this.geometry(new RingGeometry(0.88, 1, 48));
    ringGeometry.rotateX(-Math.PI / 2);
    this.ringMesh = this.instanced(ringGeometry, this.glowMaterial(), 4);
    this.blastMesh = this.instanced(
      this.geometry(new IcosahedronGeometry(1, 3)),
      this.material(
        new ShaderMaterial({
          vertexShader: FIREBALL_VERTEX,
          fragmentShader: FIREBALL_FRAGMENT,
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ),
      6,
    );
    for (let k = 0; k < 4; k++)
      this.rings.push({ active: false, age: 0, position: new Vector3(), size: 1 });
    for (let k = 0; k < 6; k++)
      this.blasts.push({ active: false, age: 0, position: new Vector3(), size: 1 });

    if (!items) return;
    const boxTexture = this.texture(questionTexture());
    const boxMaterial = this.material(
      new MeshStandardMaterial({
        map: boxTexture,
        emissive: 0xffffff,
        emissiveMap: boxTexture,
        emissiveIntensity: 0.7,
        roughness: 0.3,
        metalness: 0.1,
      }),
    );
    this.boxMesh = this.instanced(
      this.geometry(new BoxGeometry(1.6, 1.6, 1.6)),
      boxMaterial,
      items.boxes.length,
    );
    this.boxMesh.castShadow = true;
    for (let k = 0; k < items.boxes.length; k++) this.boxScale.push(1);

    const oil = this.texture(oilTexture());
    const slickGeometry = this.geometry(new CircleGeometry(ITEMS.oilRadius, 24));
    slickGeometry.rotateX(-Math.PI / 2);
    this.slickMesh = this.instanced(
      slickGeometry,
      this.material(
        new MeshStandardMaterial({
          map: oil,
          transparent: true,
          depthWrite: false,
          roughness: 0.12,
          metalness: 0.5,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        }),
      ),
      items.slicks.length,
    );
    this.rocketMesh = this.instanced(
      this.geometry(rocketGeometry()),
      this.material(
        new MeshStandardMaterial({
          color: 0xdfe3e8,
          metalness: 0.6,
          roughness: 0.3,
          emissive: 0xff2a2a,
          emissiveIntensity: 0.4,
        }),
      ),
      items.missiles.length,
    );
    this.glowMesh = this.instanced(
      this.geometry(new IcosahedronGeometry(0.32, 1)),
      this.glowMaterial(),
      items.missiles.length,
    );
    const droneMaterial = this.material(
      new MeshStandardMaterial({
        color: 0x2a1640,
        emissive: 0xc45bff,
        emissiveIntensity: 2.5,
        roughness: 0.4,
      }),
    );
    this.droneMesh = this.instanced(
      this.geometry(droneGeometry()),
      droneMaterial,
      items.missiles.length,
    );
  }

  /** Once per frame. */
  update(dt: number, time: number): void {
    this.padTexture.offset.y -= dt * 1.6;
    this.curtainMaterial.opacity = 0.75 + 0.25 * Math.sin(time * 7);
    this.padSparkles(dt);
    for (let i = 0; i < this.cars.length; i++) this.updateCar(i, dt, time);
    this.updateBoxes(dt, time);
    this.updateSlicks();
    this.updateMissiles(time);
    this.updatePulses(dt);
    this.sparks.update(dt);
  }

  shockwave(position: Vector3): void {
    const ring = this.rings.find((r) => !r.active) ?? this.rings[0];
    if (!ring) return;
    ring.active = true;
    ring.age = 0;
    ring.position.copy(position).setY(position.y + 0.4);
  }

  explosion(position: Vector3, big: boolean): void {
    const blast = this.blasts.find((b) => !b.active) ?? this.blasts[0];
    if (blast) {
      blast.active = true;
      blast.age = big ? -0.15 : 0;
      blast.size = big ? 3.2 : 2.4;
      blast.position.copy(position).setY(position.y + 0.6);
    }
    // Licks of fire rolling outwards and up, then sparks and smoke.
    for (let k = 0; k < (big ? 28 : 18); k++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.sparks.emit(
        position.x,
        position.y + 0.6,
        position.z,
        Math.cos(angle) * speed,
        1 + Math.random() * 3,
        Math.sin(angle) * speed,
        1,
        0.35 + Math.random() * 0.3,
        0.06,
        0.5,
        0.35 + Math.random() * 0.3,
        0.45,
        1.6,
        -3,
        3,
      );
    }
    this.burst(position, big ? 60 : 36, 1, 0.6, 0.15);
    this.dust.burst(position, big ? 18 : 10, big ? 1.4 : 1);
  }

  /** The shield took a hit: flash it. */
  blocked(index: number): void {
    this.shieldFlash[index] = 0.5;
    const car = this.cars[index];
    if (car) this.burst(car.position, 30, 0.3, 0.9, 1);
  }

  dispose(): void {
    this.sparks.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    for (const pair of this.flames) for (const flame of pair) flame.removeFromParent();
    for (const shield of this.shields) shield.removeFromParent();
    this.group.removeFromParent();
  }

  /** Motes of light floating up off the pads. */
  private padSparkles(dt: number): void {
    for (const pad of this.boosts.pads) {
      if (Math.random() > dt * PAD_SPARKLES) continue;
      const along = (Math.random() * 2 - 1) * pad.halfLength;
      const across = (Math.random() * 2 - 1) * pad.halfWidth;
      const { tangent, right } = pad.sample;
      this.sparks.emit(
        pad.centre.x + tangent.x * along + right.x * across,
        pad.centre.y + 0.1,
        pad.centre.z + tangent.z * along + right.z * across,
        0,
        1.2 + Math.random() * 1.4,
        0,
        0.35,
        0.9,
        1,
        0.9,
        0.6 + Math.random() * 0.4,
        0.09,
        0,
        -0.5,
        0.6,
      );
    }
  }

  private updateCar(i: number, dt: number, time: number): void {
    const car = this.cars[i] as Car;
    const state = this.boosts.states[i];
    // Exhaust flames while boosting, flickering.
    const pair = this.flames[i];
    if (pair) {
      for (let k = 0; k < pair.length; k++) {
        const flame = pair[k] as Mesh;
        flame.visible = car.boost > 0.02;
        if (flame.visible) {
          const flicker = 0.75 + 0.25 * Math.sin(time * 61 + k * 2.3 + i);
          flame.scale.set(1, 1, (0.5 + car.boost * 1.1) * flicker);
        }
      }
    }
    // Drift sparks from the rear wheels, coloured by charge level.
    if (state && state.level > 0 && state.grace === 0) {
      const tint = SPARK_COLOURS[state.level - 1] ?? SPARK_COLOURS[0];
      for (let w = 2; w < 4; w++) {
        if (car.wheelInContact[w] !== 1) continue;
        const contact = car.wheelContact[w] as Vector3;
        for (let s = 0; s < 2; s++) {
          this.sparks.emit(
            contact.x,
            contact.y + 0.08,
            contact.z,
            -car.velocity.x * 0.15 + (Math.random() - 0.5) * 3,
            1.5 + Math.random() * 2.5,
            -car.velocity.z * 0.15 + (Math.random() - 0.5) * 3,
            tint?.[0] ?? 1,
            tint?.[1] ?? 1,
            tint?.[2] ?? 1,
            1,
            0.22 + Math.random() * 0.2,
            0.12,
            0,
            14,
            1,
          );
        }
      }
    }
    // Shield bubble.
    const shield = this.shields[i];
    const holder = this.items?.holders[i];
    if (shield) {
      const flash = Math.max(0, (this.shieldFlash[i] ?? 0) - dt);
      this.shieldFlash[i] = flash;
      const on = (holder?.shield ?? 0) > 0;
      shield.visible = on || flash > 0;
      const ending = on && (holder?.shield ?? 0) < 2 ? 0.5 + 0.5 * Math.sin(time * 18) : 1;
      (shield.material.uniforms.strength as { value: number }).value =
        flash > 0 ? 1 + flash * 4 : (0.8 + 0.2 * Math.sin(time * 4)) * ending;
    }
  }

  private updateBoxes(dt: number, time: number): void {
    const mesh = this.boxMesh;
    if (!mesh || !this.items) return;
    const boxes = this.items.boxes;
    for (let k = 0; k < boxes.length; k++) {
      const box = boxes[k];
      if (!box) continue;
      const there = box.respawnAt === 0;
      let scale = this.boxScale[k] ?? 1;
      if (!there && scale > 0) {
        // Just taken: sparkle where it was.
        this.burst(box.position, 24, 0.5, 1, 1);
        scale = 0;
      } else if (there && scale < 1) {
        scale = Math.min(1, scale + dt * 4);
      }
      this.boxScale[k] = scale;
      dummy.position.copy(box.position);
      dummy.position.y += Math.sin(time * 2.2 + k) * 0.15;
      dummy.rotation.set(0.45, time * 1.6 + k, 0.3);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
      colour.setHSL((time * 0.15 + k * 0.08) % 1, 0.6, 0.6);
      mesh.setColorAt(k, colour);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private updateSlicks(): void {
    const mesh = this.slickMesh;
    if (!mesh || !this.items) return;
    const slicks = this.items.slicks;
    for (let k = 0; k < slicks.length; k++) {
      const slick = slicks[k];
      if (!slick) continue;
      dummy.position.copy(slick.position);
      dummy.position.y += 0.03;
      dummy.rotation.set(0, k * 1.7, 0);
      dummy.scale.setScalar(slick.active ? 1 : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  private updateMissiles(time: number): void {
    const { rocketMesh, glowMesh, droneMesh, items } = this;
    if (!rocketMesh || !glowMesh || !droneMesh || !items) return;
    for (let k = 0; k < items.missiles.length; k++) {
      const missile = items.missiles[k];
      if (!missile) continue;
      const rocket = missile.active && missile.kind === 'rocket';
      const drone = missile.active && missile.kind === 'bounty';
      const yaw = Math.atan2(missile.heading.x, missile.heading.z);
      dummy.position.copy(missile.position);
      dummy.rotation.set(0, yaw, rocket ? time * 9 : 0);
      dummy.scale.setScalar(rocket ? 1 : 0);
      dummy.updateMatrix();
      rocketMesh.setMatrixAt(k, dummy.matrix);
      // Glow at the rocket's tail.
      scratch.copy(missile.heading).multiplyScalar(-0.75);
      dummy.position.copy(missile.position).add(scratch);
      dummy.scale.setScalar(rocket ? 0.9 + 0.3 * Math.sin(time * 40 + k) : 0);
      dummy.updateMatrix();
      glowMesh.setMatrixAt(k, dummy.matrix);
      colour.setRGB(3, 1.2, 0.3);
      glowMesh.setColorAt(k, colour);
      dummy.position.copy(missile.position);
      dummy.rotation.set(0, time * 5, Math.sin(time * 3) * 0.2);
      dummy.scale.setScalar(drone ? 1 : 0);
      dummy.updateMatrix();
      droneMesh.setMatrixAt(k, dummy.matrix);
      if (rocket || drone) this.dust.trail(scratch.copy(missile.position));
    }
    rocketMesh.instanceMatrix.needsUpdate = true;
    glowMesh.instanceMatrix.needsUpdate = true;
    if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
    droneMesh.instanceMatrix.needsUpdate = true;
  }

  private updatePulses(dt: number): void {
    for (let k = 0; k < this.rings.length; k++) {
      const ring = this.rings[k] as Pulse;
      if (ring.active) ring.age += dt;
      if (ring.age >= RING_SECONDS) ring.active = false;
      const t = ring.age / RING_SECONDS;
      dummy.position.copy(ring.position);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(ring.active ? ITEMS.shockwaveRadius * (0.15 + 0.85 * Math.sqrt(t)) : 0);
      dummy.updateMatrix();
      this.ringMesh.setMatrixAt(k, dummy.matrix);
      colour.setRGB(2.4, 2.2, 0.8).multiplyScalar(ring.active ? 1 - t : 0);
      this.ringMesh.setColorAt(k, colour);
    }
    for (let k = 0; k < this.blasts.length; k++) {
      const blast = this.blasts[k] as Pulse;
      if (blast.active) blast.age += dt;
      if (blast.age >= BLAST_SECONDS) blast.active = false;
      const t = Math.max(0, blast.age) / BLAST_SECONDS;
      dummy.position.copy(blast.position);
      dummy.scale.setScalar(blast.active ? blast.size * (0.25 + 0.75 * Math.sqrt(t)) : 0);
      dummy.updateMatrix();
      this.blastMesh.setMatrixAt(k, dummy.matrix);
      // Only red is read: the fireball's heat.
      colour.setScalar(blast.active ? 3.2 * (1 - t) * (1 - t) : 0);
      this.blastMesh.setColorAt(k, colour);
    }
    this.ringMesh.instanceMatrix.needsUpdate = true;
    this.blastMesh.instanceMatrix.needsUpdate = true;
    if (this.ringMesh.instanceColor) this.ringMesh.instanceColor.needsUpdate = true;
    if (this.blastMesh.instanceColor) this.blastMesh.instanceColor.needsUpdate = true;
  }

  /** Bright sparks flying out from a point. */
  private burst(position: Vector3, count: number, r: number, g: number, b: number): void {
    for (let k = 0; k < count; k++) {
      this.sparks.emit(
        position.x,
        position.y,
        position.z,
        (Math.random() - 0.5) * 14,
        Math.random() * 9,
        (Math.random() - 0.5) * 14,
        r,
        g,
        b,
        1,
        0.35 + Math.random() * 0.35,
        0.16,
        0,
        12,
        1.2,
      );
    }
  }

  private glowMaterial(): MeshBasicMaterial {
    return this.material(
      new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false }),
    );
  }

  private instanced(geometry: BufferGeometry, material: Material, count: number): InstancedMesh {
    const mesh = new InstancedMesh(geometry, material, Math.max(1, count));
    mesh.frustumCulled = false;
    dummy.position.set(0, -1000, 0);
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let k = 0; k < mesh.count; k++) {
      mesh.setMatrixAt(k, dummy.matrix);
      mesh.setColorAt(k, colour.setRGB(1, 1, 1));
    }
    this.group.add(mesh);
    return mesh;
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private material<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  private texture(texture: Texture): Texture {
    this.textures.push(texture);
    return texture;
  }
}
