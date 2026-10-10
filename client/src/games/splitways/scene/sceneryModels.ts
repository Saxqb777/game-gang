/**
 * Low-poly models and textures for the scenery: a flat-shaded geometry builder, blocks, the
 * grandstand crowd and trackside banners.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  RepeatWrapping,
  type Color,
  type Texture,
  type Vector3,
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
