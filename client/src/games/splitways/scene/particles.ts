/**
 * A fixed pool of camera-facing particles drawn as one instanced mesh: soft puffs (dust, smoke)
 * with normal blending, or bright sparks with additive blending. No allocation after construction.
 */
import {
  AdditiveBlending,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';

const VERTEX = /* glsl */ `
attribute vec4 particle;      // xyz position, w size
attribute vec4 particleLook;  // rgb colour, a opacity
varying vec2 vUv;
varying vec4 vLook;
void main() {
  vec4 view = modelViewMatrix * vec4(particle.xyz, 1.0);
  view.xy += position.xy * particle.w;
  gl_Position = projectionMatrix * view;
  vUv = uv;
  vLook = particleLook;
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 light;
uniform float hardness;
varying vec2 vUv;
varying vec4 vLook;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float alpha = (1.0 - smoothstep(hardness, 1.0, r)) * vLook.a;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(vLook.rgb * light, alpha);
}`;

export interface ParticleOptions {
  max: number;
  /** Sparks add light; puffs cover what is behind them. */
  additive: boolean;
  /** Colour multiplier (linear): lighting for puffs, brightness (bloom) for sparks. */
  light: readonly [number, number, number];
  /** 0 = soft round blob, close to 1 = crisp dot. */
  hardness: number;
}

export class Particles {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private readonly position: InstancedBufferAttribute;
  private readonly look: InstancedBufferAttribute;
  private readonly velocities: Float32Array;
  private readonly ages: Float32Array;
  private readonly lives: Float32Array;
  private readonly sizes: Float32Array;
  private readonly growth: Float32Array;
  private readonly opacity: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private next = 0;
  private alive = 0;

  constructor(private readonly options: ParticleOptions) {
    const { max } = options;
    this.velocities = new Float32Array(max * 3);
    this.ages = new Float32Array(max);
    this.lives = new Float32Array(max);
    this.sizes = new Float32Array(max);
    this.growth = new Float32Array(max);
    this.opacity = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    const quad = new PlaneGeometry(1, 1);
    const geometry = new InstancedBufferGeometry();
    geometry.setIndex(quad.getIndex());
    geometry.setAttribute('position', quad.getAttribute('position'));
    geometry.setAttribute('uv', quad.getAttribute('uv'));
    this.position = new InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.look = new InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.position.setUsage(DynamicDrawUsage);
    this.look.setUsage(DynamicDrawUsage);
    geometry.setAttribute('particle', this.position);
    geometry.setAttribute('particleLook', this.look);
    geometry.instanceCount = max;
    const [r, g, b] = options.light;
    this.mesh = new Mesh(
      geometry,
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { light: { value: new Vector3(r, g, b) }, hardness: { value: options.hardness } },
        transparent: true,
        depthWrite: false,
        blending: options.additive ? AdditiveBlending : NormalBlending,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = options.additive ? 3 : 2;
    this.mesh.visible = false;
  }

  /**
   * One particle. Size grows from `size` by `growth` over its life (square-root curve); `gravity`
   * pulls down (m/s^2, negative floats up); `drag` slows it (1/s).
   */
  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    r: number,
    g: number,
    b: number,
    opacity: number,
    life: number,
    size: number,
    growth: number,
    gravity: number,
    drag: number,
  ): void {
    const i = this.next;
    this.next = (i + 1) % this.options.max;
    const p = this.position.array as Float32Array;
    const l = this.look.array as Float32Array;
    p[i * 4] = x;
    p[i * 4 + 1] = y;
    p[i * 4 + 2] = z;
    p[i * 4 + 3] = size;
    l[i * 4] = r;
    l[i * 4 + 1] = g;
    l[i * 4 + 2] = b;
    l[i * 4 + 3] = 0;
    this.velocities[i * 3] = vx;
    this.velocities[i * 3 + 1] = vy;
    this.velocities[i * 3 + 2] = vz;
    this.ages[i] = 0;
    this.lives[i] = life;
    this.sizes[i] = size;
    this.growth[i] = growth;
    this.opacity[i] = opacity;
    this.gravity[i] = gravity;
    this.drag[i] = drag;
    this.alive++;
    this.mesh.visible = true;
  }

  /** Once per frame. */
  update(dt: number): void {
    if (this.alive === 0) return;
    const p = this.position.array as Float32Array;
    const l = this.look.array as Float32Array;
    let alive = 0;
    for (let i = 0; i < this.options.max; i++) {
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
      const keep = Math.exp(-dt * (this.drag[i] ?? 0));
      const vx = (this.velocities[v] ?? 0) * keep;
      const vy = (this.velocities[v + 1] ?? 0) * keep - (this.gravity[i] ?? 0) * dt;
      const vz = (this.velocities[v + 2] ?? 0) * keep;
      this.velocities[v] = vx;
      this.velocities[v + 1] = vy;
      this.velocities[v + 2] = vz;
      p[i * 4] = (p[i * 4] ?? 0) + vx * dt;
      p[i * 4 + 1] = (p[i * 4 + 1] ?? 0) + vy * dt;
      p[i * 4 + 2] = (p[i * 4 + 2] ?? 0) + vz * dt;
      const t = age / life;
      p[i * 4 + 3] = (this.sizes[i] ?? 0) + (this.growth[i] ?? 0) * Math.sqrt(t);
      // Quick fade in, long fade out.
      l[i * 4 + 3] = (this.opacity[i] ?? 0) * Math.min(1, t * 8) * (1 - t) * (1 - t);
    }
    this.alive = alive;
    this.mesh.visible = alive > 0;
    this.position.needsUpdate = true;
    this.look.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
