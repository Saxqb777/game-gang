/**
 * Low-poly models and textures for the scenery: an interim pine, blocks, the grandstand crowd and
 * trackside banners.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  RepeatWrapping,
  Vector3,
  type Texture,
} from 'three';
import { canvasTexture } from './textures';

/** Flat-shaded triangles with vertex colours. */
export class FacetBuilder {
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

/** Height of an interim pine at scale 1 (m). */
const PINE_HEIGHT = 14;

/**
 * Interim low-poly pine (about 80 flat-shaded triangles): a six-sided trunk and four stacked
 * eight-sided cones, darker at the bottom. Origin at the foot of the trunk.
 */
export function pineGeometry(): BufferGeometry {
  const b = new FacetBuilder();
  const a = new Vector3();
  const c = new Vector3();
  const d = new Vector3();
  const e = new Vector3();
  const around = (k: number, sides: number, radius: number, y: number, out: Vector3) => {
    const angle = (k / sides) * Math.PI * 2;
    return out.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  };

  const bark = linear(0.09, 0.06, 0.04);
  for (let k = 0; k < 6; k++) {
    around(k, 6, 0.3, 0, a);
    around(k + 1, 6, 0.3, 0, c);
    around(k + 1, 6, 0.18, 4, d);
    around(k, 6, 0.18, 4, e);
    b.quad(a, e, d, c, bark);
  }

  // [base height, base radius, apex height] per cone, bottom to top.
  const cones: [number, number, number][] = [
    [2.8, 3.3, 8.2],
    [5.6, 2.7, 10.6],
    [8.2, 2.05, 12.6],
    [10.6, 1.35, PINE_HEIGHT],
  ];
  const sides = 8;
  cones.forEach(([base, radius, apex], level) => {
    const t = level / (cones.length - 1);
    const needles = linear(0.025 + 0.02 * t, 0.06 + 0.035 * t, 0.03 + 0.012 * t);
    const shade = linear(0.012, 0.03, 0.016);
    const tip = new Vector3(0, apex, 0);
    const hub = new Vector3(0, base + 0.25, 0);
    for (let k = 0; k < sides; k++) {
      // A slightly ragged hem so the silhouette isn't a perfect cone.
      const r0 = radius * (k % 2 === 0 ? 1 : 0.86);
      const r1 = radius * ((k + 1) % 2 === 0 ? 1 : 0.86);
      around(k, sides, r0, base, a);
      around(k + 1, sides, r1, base, c);
      b.triangle(a, tip, c, needles);
      b.triangle(a, c, hub, shade);
    }
  });
  return b.build();
}

/** Unit box standing on y = 0. */
export function blockGeometry(): BufferGeometry {
  const box = new BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  return box;
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
