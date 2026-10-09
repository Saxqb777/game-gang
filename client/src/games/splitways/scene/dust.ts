/**
 * Sand dust off the wheels on the shoulders and tyre smoke from slides: a fixed pool of soft,
 * camera-facing puffs drawn as one instanced mesh. No allocation after construction.
 */
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { Car } from '../sim/car';

const MAX_PUFFS = 700;
/** Puffs per second per wheel: sand at speed, smoke per metre/second of sideways slide. */
const SAND_RATE = 0.9;
const SMOKE_RATE = 2.2;
const SAND_COLOUR = [0.62, 0.5, 0.36] as const;
const SMOKE_COLOUR = [0.78, 0.78, 0.78] as const;

const VERTEX = /* glsl */ `
attribute vec4 puff;      // xyz position, w size
attribute vec4 puffLook;  // rgb colour, a opacity
varying vec2 vUv;
varying vec4 vLook;
void main() {
  vec4 view = modelViewMatrix * vec4(puff.xyz, 1.0);
  view.xy += position.xy * puff.w;
  gl_Position = projectionMatrix * view;
  vUv = uv;
  vLook = puffLook;
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 light;
varying vec2 vUv;
varying vec4 vLook;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float alpha = (1.0 - smoothstep(0.2, 1.0, r)) * vLook.a;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(vLook.rgb * light, alpha);
}`;

const velocity = new Vector3();

export class Dust {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private readonly puff: InstancedBufferAttribute;
  private readonly look: InstancedBufferAttribute;
  private readonly velocities = new Float32Array(MAX_PUFFS * 3);
  private readonly ages = new Float32Array(MAX_PUFFS);
  private readonly lives = new Float32Array(MAX_PUFFS);
  private readonly growth = new Float32Array(MAX_PUFFS);
  private readonly opacity = new Float32Array(MAX_PUFFS);
  /** Fractional puffs owed per car wheel, so low rates still emit. */
  private readonly owed = new Map<Car, Float32Array>();
  private next = 0;
  private alive = 0;

  constructor() {
    const quad = new PlaneGeometry(1, 1);
    const geometry = new InstancedBufferGeometry();
    geometry.setIndex(quad.getIndex());
    geometry.setAttribute('position', quad.getAttribute('position'));
    geometry.setAttribute('uv', quad.getAttribute('uv'));
    this.puff = new InstancedBufferAttribute(new Float32Array(MAX_PUFFS * 4), 4);
    this.look = new InstancedBufferAttribute(new Float32Array(MAX_PUFFS * 4), 4);
    this.puff.setUsage(DynamicDrawUsage);
    this.look.setUsage(DynamicDrawUsage);
    geometry.setAttribute('puff', this.puff);
    geometry.setAttribute('puffLook', this.look);
    geometry.instanceCount = MAX_PUFFS;
    this.mesh = new Mesh(
      geometry,
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { light: { value: new Vector3(1.6, 1.45, 1.3) } },
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  addCar(car: Car): void {
    this.owed.set(car, new Float32Array(4));
  }

  /** After each physics step: emit from the wheels. */
  emit(car: Car, onSand: boolean, dt: number): void {
    const owed = this.owed.get(car);
    if (!owed) return;
    const speed = Math.abs(car.forwardSpeed);
    for (let i = 0; i < 4; i++) {
      if (car.wheelInContact[i] !== 1) continue;
      const slide = car.wheelSlide[i] ?? 0;
      const sand = onSand && speed > 4;
      const smoke = !onSand && car.wheelSkidding[i] === 1 && slide > 3;
      // Front wheels only throw sand; smoke comes from the rear.
      if (!sand && !(smoke && i >= 2)) continue;
      const rate = sand ? SAND_RATE * speed * (i >= 2 ? 1 : 0.4) : SMOKE_RATE * slide;
      let pending = (owed[i] ?? 0) + rate * dt;
      while (pending >= 1) {
        this.spawn(car, i, sand);
        pending -= 1;
      }
      owed[i] = pending;
    }
  }

  /** Once per frame. */
  update(dt: number): void {
    if (this.alive === 0) return;
    const p = this.puff.array as Float32Array;
    const l = this.look.array as Float32Array;
    const drag = Math.exp(-dt * 2.2);
    let alive = 0;
    for (let i = 0; i < MAX_PUFFS; i++) {
      const life = this.lives[i] ?? 0;
      if (life <= 0) continue;
      const age = (this.ages[i] ?? 0) + dt;
      if (age >= life) {
        this.lives[i] = 0;
        l[i * 4 + 3] = 0;
        p[i * 4 + 3] = 0;
        continue;
      }
      alive++;
      this.ages[i] = age;
      const v = i * 3;
      const vx = (this.velocities[v] ?? 0) * drag;
      const vy = (this.velocities[v + 1] ?? 0) * drag + dt * 0.6;
      const vz = (this.velocities[v + 2] ?? 0) * drag;
      this.velocities[v] = vx;
      this.velocities[v + 1] = vy;
      this.velocities[v + 2] = vz;
      p[i * 4] = (p[i * 4] ?? 0) + vx * dt;
      p[i * 4 + 1] = (p[i * 4 + 1] ?? 0) + vy * dt;
      p[i * 4 + 2] = (p[i * 4 + 2] ?? 0) + vz * dt;
      const t = age / life;
      p[i * 4 + 3] = 0.5 + (this.growth[i] ?? 0) * Math.sqrt(t);
      // Quick fade in, long fade out.
      l[i * 4 + 3] = (this.opacity[i] ?? 0) * Math.min(1, t * 8) * (1 - t) * (1 - t);
    }
    this.alive = alive;
    this.mesh.visible = alive > 0;
    this.puff.needsUpdate = true;
    this.look.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }

  private spawn(car: Car, wheel: number, sand: boolean): void {
    const i = this.next;
    this.next = (i + 1) % MAX_PUFFS;
    const contact = car.wheelContact[wheel] as Vector3;
    const p = this.puff.array as Float32Array;
    const l = this.look.array as Float32Array;
    p[i * 4] = contact.x + (Math.random() - 0.5) * 0.3;
    p[i * 4 + 1] = contact.y + 0.15;
    p[i * 4 + 2] = contact.z + (Math.random() - 0.5) * 0.3;
    p[i * 4 + 3] = 0.5;
    // Thrown up and back, carrying some of the car's speed.
    velocity.copy(car.velocity).multiplyScalar(sand ? 0.25 : 0.12);
    this.velocities[i * 3] = velocity.x + (Math.random() - 0.5) * 2.4;
    this.velocities[i * 3 + 1] = (sand ? 1.2 : 0.6) + Math.random() * 1.2;
    this.velocities[i * 3 + 2] = velocity.z + (Math.random() - 0.5) * 2.4;
    const colour = sand ? SAND_COLOUR : SMOKE_COLOUR;
    l[i * 4] = colour[0];
    l[i * 4 + 1] = colour[1];
    l[i * 4 + 2] = colour[2];
    l[i * 4 + 3] = 0;
    this.ages[i] = 0;
    this.lives[i] = (sand ? 1.1 : 1.6) + Math.random() * 0.8;
    this.growth[i] = (sand ? 2.4 : 3.2) + Math.random() * 1.2;
    this.opacity[i] = sand ? 0.42 : 0.3;
    this.alive++;
    this.mesh.visible = true;
  }
}
