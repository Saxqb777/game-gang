/**
 * Low-poly models and materials for the scenery: palm, street lamp, building facades (windows
 * that keep their size whatever the building's scale), grandstand crowd and trackside banners.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  MeshStandardMaterial,
  RepeatWrapping,
  Vector3,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture } from './textures';

/** Flat-shaded triangles with vertex colours. */
class FacetBuilder {
  private readonly positions: number[] = [];
  private readonly colours: number[] = [];

  triangle(a: Vector3, b: Vector3, c: Vector3, colour: Color): void {
    for (const p of [a, b, c]) {
      this.positions.push(p.x, p.y, p.z);
      this.colours.push(colour.r, colour.g, colour.b);
    }
  }

  /** Corners in counter-clockwise order seen from the front. */
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, colour: Color): void {
    this.triangle(a, b, c, colour);
    this.triangle(a, c, d, colour);
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colours), 3));
    geometry.computeVertexNormals();
    return geometry;
  }
}

const linear = (r: number, g: number, b: number) => new Color().setRGB(r, g, b);

export const PALM_HEIGHT = 8.5;

/** Curved six-sided trunk with bark rings, eleven arching fronds and three dead ones hanging. */
export function palmGeometry(): BufferGeometry {
  const b = new FacetBuilder();
  const sides = 6;
  const segments = 8;
  const barkDark = linear(0.2, 0.15, 0.1);
  const barkLight = linear(0.3, 0.23, 0.15);
  const ring = (t: number, k: number, out: Vector3) => {
    const radius = 0.3 - 0.13 * t;
    const angle = (k / sides) * Math.PI * 2 + t * 2.4;
    return out.set(
      0.9 * t * t + Math.cos(angle) * radius,
      PALM_HEIGHT * t,
      Math.sin(angle) * radius,
    );
  };
  const a = new Vector3();
  const c = new Vector3();
  const d = new Vector3();
  const e = new Vector3();
  for (let s = 0; s < segments; s++) {
    for (let k = 0; k < sides; k++) {
      ring(s / segments, k, a);
      ring(s / segments, k + 1, c);
      ring((s + 1) / segments, k + 1, d);
      ring((s + 1) / segments, k, e);
      b.quad(a, e, d, c, s % 2 === 0 ? barkDark : barkLight);
    }
  }

  const top = new Vector3(0.9, PALM_HEIGHT - 0.1, 0);
  const up = new Vector3(0, 1, 0);
  const frond = (
    yaw: number,
    liftBase: number,
    liftTip: number,
    length: number,
    base: Color,
    tip: Color,
  ) => {
    const steps = 7;
    const dir = new Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    const side = new Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
    const spine: Vector3[] = [top.clone()];
    for (let s = 1; s <= steps; s++) {
      const lift = liftBase + (liftTip - liftBase) * (s / steps);
      const prev = spine[s - 1] as Vector3;
      spine.push(
        prev
          .clone()
          .addScaledVector(dir, Math.cos(lift) * (length / steps))
          .addScaledVector(up, Math.sin(lift) * (length / steps)),
      );
    }
    for (let s = 0; s < steps; s++) {
      const w0 = 0.85 * Math.sin(Math.PI * (s / steps) ** 0.75);
      const w1 = 0.85 * Math.sin(Math.PI * ((s + 1) / steps) ** 0.75);
      const p0 = spine[s] as Vector3;
      const p1 = spine[s + 1] as Vector3;
      // Leaflets droop from the midrib: an upside-down V.
      const l0 = p0
        .clone()
        .addScaledVector(side, w0)
        .addScaledVector(up, -w0 * 0.35);
      const l1 = p1
        .clone()
        .addScaledVector(side, w1)
        .addScaledVector(up, -w1 * 0.35);
      const r0 = p0
        .clone()
        .addScaledVector(side, -w0)
        .addScaledVector(up, -w0 * 0.35);
      const r1 = p1
        .clone()
        .addScaledVector(side, -w1)
        .addScaledVector(up, -w1 * 0.35);
      const colour = base.clone().lerp(tip, s / steps);
      b.quad(p0, p1, l1, l0, colour);
      b.quad(p0, r0, r1, p1, colour);
    }
  };
  const green = linear(0.06, 0.15, 0.035);
  const greenTip = linear(0.16, 0.26, 0.05);
  for (let f = 0; f < 11; f++) {
    const yaw = (f / 11) * Math.PI * 2 + Math.sin(f * 7.3) * 0.2;
    frond(
      yaw,
      0.75 + Math.sin(f * 3.1) * 0.15,
      -0.95,
      4.6 + Math.sin(f * 5.7) * 0.5,
      green,
      greenTip,
    );
  }
  const dead = linear(0.26, 0.19, 0.1);
  for (let f = 0; f < 3; f++) {
    frond((f / 3) * Math.PI * 2 + 0.6, -1.2, -1.45, 3.2, dead, dead);
  }
  return b.build();
}

/** Street lamp: pole with an arm reaching over the road (+Z), and the lamp head separately. */
export function lampGeometries(): { pole: BufferGeometry; head: BufferGeometry } {
  const pole = new CylinderGeometry(0.08, 0.13, 9, 6);
  pole.translate(0, 4.5, 0);
  const arm = new BoxGeometry(0.1, 0.1, 2.6);
  arm.translate(0, 8.85, 1.25);
  const base = new CylinderGeometry(0.25, 0.3, 0.5, 6);
  base.translate(0, 0.25, 0);
  const head = new BoxGeometry(0.34, 0.12, 0.8);
  head.translate(0, 8.82, 2.5);
  const merged = mergeGeometries([pole, arm, base]);
  for (const g of [pole, arm, base]) g.dispose();
  return { pole: merged, head };
}

/** Unit box standing on y = 0. */
export function blockGeometry(): BufferGeometry {
  const box = new BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  return box;
}

/**
 * Standard material whose map tiles across each face in metres (`tileWidth` x `tileHeight` per
 * repeat) whatever the instance's scale, so windows keep their size. Roofs get the wall colour.
 */
export function facadeMaterial(
  map: Texture,
  tileWidth: number,
  tileHeight: number,
  roughness: number,
  metalness: number,
): MeshStandardMaterial {
  map.wrapS = map.wrapT = RepeatWrapping;
  const material = new MeshStandardMaterial({ map, roughness, metalness });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFacade;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
  vec3 facadeScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec3 facadePos = position * facadeScale;
  vFacade = abs(normal.y) > 0.5
    ? vec2(0.02)
    : vec2(abs(normal.x) > 0.5 ? facadePos.z : facadePos.x, facadePos.y) / vec2(${tileWidth.toFixed(2)}, ${tileHeight.toFixed(2)});`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFacade;')
      .replace('#include <map_fragment>', 'diffuseColor *= texture2D(map, vFacade);');
  };
  return material;
}

/** One floor, one window bay of a whitewashed low-rise block. */
export function lowRiseTexture(): Texture {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#ece6d8';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#d6cdbb';
    ctx.fillRect(0, 118, 128, 10);
    const glass = ctx.createLinearGradient(0, 26, 0, 100);
    glass.addColorStop(0, '#7d95a8');
    glass.addColorStop(1, '#2a3846');
    ctx.fillStyle = '#b5ad9c';
    ctx.fillRect(26, 24, 76, 80);
    ctx.fillStyle = glass;
    ctx.fillRect(29, 27, 70, 74);
    ctx.fillStyle = '#b5ad9c';
    ctx.fillRect(62, 27, 4, 74);
  });
}

/** Curtain-wall glass for the skyline towers: tinted panes and light mullions. */
export function towerTexture(): Texture {
  return canvasTexture(64, 128, (ctx) => {
    const glass = ctx.createLinearGradient(0, 0, 0, 128);
    glass.addColorStop(0, '#5d7a92');
    glass.addColorStop(1, '#22313f');
    ctx.fillStyle = glass;
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = '#a7b4bd';
    ctx.fillRect(0, 0, 3, 128);
    ctx.fillStyle = '#1a242e';
    ctx.fillRect(0, 112, 64, 16);
  });
}

/** A seated crowd seen from the track: rows of shirts and heads on dark seats. Tiles along x. */
export function crowdTexture(): Texture {
  const texture = canvasTexture(512, 64, (ctx) => {
    ctx.fillStyle = '#20232a';
    ctx.fillRect(0, 0, 512, 64);
    const shirts = [
      '#e8e4dc',
      '#ff3b3b',
      '#2f7bff',
      '#ffd60a',
      '#1fe0e6',
      '#ff8a1f',
      '#9b5cff',
      '#f2f2f2',
      '#3a3f48',
    ];
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let x = 4; x < 512; x += 9 + rand() * 4) {
      if (rand() < 0.12) continue;
      ctx.fillStyle = shirts[Math.floor(rand() * shirts.length)] ?? '#ffffff';
      ctx.fillRect(x, 30 + rand() * 6, 8, 26);
      ctx.fillStyle = rand() < 0.5 ? '#6b4a32' : '#c79a72';
      ctx.beginPath();
      ctx.arc(x + 4, 24 + rand() * 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  texture.wrapS = RepeatWrapping;
  return texture;
}

/** Trackside advertising board. */
export function bannerTexture(): Texture {
  return canvasTexture(512, 96, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 512, 0);
    gradient.addColorStop(0, '#ff8a1f');
    gradient.addColorStop(0.5, '#ff3b6b');
    gradient.addColorStop(1, '#7b2ff7');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 10, 512, 76);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 52px "Chakra Petch", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAMER GANG', 256, 50);
  });
}
