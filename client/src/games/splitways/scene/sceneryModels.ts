/**
 * Low-poly building blocks and runtime-drawn textures for the trackside: a mesh kit (boxes,
 * prisms and quads with vertex colours and contact grime), the signage atlas with the fictional
 * brand kit, distance boards, marshal panels and corner numbers, the grandstand crowd, and flags.
 * Every brand here is invented for Kestrel Pines.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix3,
  RepeatWrapping,
  Vector3,
  type CanvasTexture,
  type Matrix4,
} from 'three';
import { canvasTexture } from './textures';

/** Contact grime: x0.6 at the foot, clean by 0.4 m (or 15% of a small prop's height). */
const GRIME = 0.6;
const GRIME_HEIGHT = 0.4;

const UP = new Vector3(0, 1, 0);
const p = new Vector3();
const n = new Vector3();
const t1 = new Vector3();
const t2 = new Vector3();
const centre = new Vector3();
const normalMatrix = new Matrix3();
const shaded = new Color();

/** Accumulates vertex-coloured (optionally textured) triangles in world space. */
export class MeshKit {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly colours: number[] = [];
  readonly indices: number[] = [];

  get triangles(): number {
    return this.indices.length / 3;
  }

  private vertex(m: Matrix4, local: Vector3, normal: Vector3, u: number, v: number, c: Color) {
    p.copy(local).applyMatrix4(m);
    n.copy(normal).applyMatrix3(normalMatrix).normalize();
    this.positions.push(p.x, p.y, p.z);
    this.normals.push(n.x, n.y, n.z);
    this.uvs.push(u, v);
    this.colours.push(c.r, c.g, c.b);
    return this.positions.length / 3 - 1;
  }

  /**
   * A flat face, local to `m`: centre `c`, outward normal `normal`, `right` and `up` in its plane
   * (right x up = normal), half sizes, uv rectangle, and a colour per row from the `shade` of its
   * local height. Counter-clockwise seen from the front.
   */
  private face(
    m: Matrix4,
    c: Vector3,
    normal: Vector3,
    right: Vector3,
    up: Vector3,
    halfW: number,
    halfH: number,
    uv: readonly [number, number, number, number],
    colour: Color,
    shade: (y: number) => number,
  ) {
    const [u0, v0, u1, v1] = uv;
    const corner = (sx: number, sy: number, u: number, v: number) => {
      centre
        .copy(c)
        .addScaledVector(right, sx * halfW)
        .addScaledVector(up, sy * halfH);
      shaded.copy(colour).multiplyScalar(shade(centre.y));
      return this.vertex(m, centre, normal, u, v, shaded);
    };
    const bl = corner(-1, -1, u0, v0);
    const br = corner(1, -1, u1, v0);
    const tl = corner(-1, 1, u0, v1);
    const tr = corner(1, 1, u1, v1);
    this.indices.push(bl, br, tr, bl, tr, tl);
  }

  /**
   * A box standing on y = 0 of `m` (x across, z depth). With `grime`, its sides get a darker
   * band at the foot. `uv` points every face at one texel (for atlas-mapped kits).
   */
  box(
    m: Matrix4,
    sx: number,
    sy: number,
    sz: number,
    colour: Color,
    options: { grime?: boolean; bottom?: boolean; uv?: readonly [number, number] } = {},
  ): void {
    normalMatrix.getNormalMatrix(m);
    const gh = Math.min(GRIME_HEIGHT, 0.15 * sy);
    const shade = options.grime
      ? (y: number) => GRIME + (1 - GRIME) * Math.min(1, Math.max(0, y / gh))
      : () => 1;
    const [u, v] = options.uv ?? [0, 0];
    const uv = [u, v, u, v] as const;
    const sides: [number, number, number, number][] = [
      [1, 0, 0, sx / 2],
      [-1, 0, 0, sx / 2],
      [0, 0, 1, sz / 2],
      [0, 0, -1, sz / 2],
    ];
    for (const [nx, , nz, d] of sides) {
      const normal = new Vector3(nx, 0, nz);
      const right = new Vector3().crossVectors(UP, normal);
      const halfW = nx !== 0 ? sz / 2 : sx / 2;
      // With grime, split the side at the grime height so the gradient stays at the foot.
      const rows = options.grime ? [0, gh, sy] : [0, sy];
      for (let r = 0; r < rows.length - 1; r++) {
        const y0 = rows[r] as number;
        const y1 = rows[r + 1] as number;
        const c = new Vector3(nx * d, (y0 + y1) / 2, nz * d);
        this.face(m, c, normal, right, UP, halfW, (y1 - y0) / 2, uv, colour, shade);
      }
    }
    this.face(
      m,
      new Vector3(0, sy, 0),
      UP,
      new Vector3(1, 0, 0),
      new Vector3(0, 0, -1),
      sx / 2,
      sz / 2,
      uv,
      colour,
      () => 1,
    );
    if (options.bottom) {
      this.face(
        m,
        new Vector3(0, 0, 0),
        new Vector3(0, -1, 0),
        new Vector3(1, 0, 0),
        new Vector3(0, 0, 1),
        sx / 2,
        sz / 2,
        uv,
        colour,
        () => 1,
      );
    }
  }

  /** A textured quad facing local +z (x right, y up), `w` x `h`, its bottom edge on y = 0. */
  panel(
    m: Matrix4,
    w: number,
    h: number,
    uv: readonly [number, number, number, number],
    colour: Color = WHITE,
  ): void {
    normalMatrix.getNormalMatrix(m);
    this.face(
      m,
      new Vector3(0, h / 2, 0),
      new Vector3(0, 0, 1),
      new Vector3(1, 0, 0),
      UP,
      w / 2,
      h / 2,
      uv,
      colour,
      () => 1,
    );
  }

  /** An upright prism (a cylinder with few sides) standing on y = 0, with smooth sides. */
  prism(
    m: Matrix4,
    radiusBottom: number,
    radiusTop: number,
    height: number,
    sides: number,
    colour: Color,
    options: { grime?: boolean; cap?: boolean; topColour?: Color } = {},
  ): void {
    normalMatrix.getNormalMatrix(m);
    const gh = Math.min(GRIME_HEIGHT, 0.15 * height);
    const rows = options.grime ? [0, gh, height] : [0, height];
    const top = options.topColour ?? colour;
    const ring: number[][] = rows.map((y) => {
      const t = y / height;
      const r = radiusBottom + (radiusTop - radiusBottom) * t;
      const grime = options.grime ? GRIME + (1 - GRIME) * Math.min(1, y / gh) : 1;
      shaded.copy(colour).lerp(top, t).multiplyScalar(grime);
      const ids: number[] = [];
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const normal = new Vector3(Math.cos(a), (radiusBottom - radiusTop) / height, Math.sin(a));
        ids.push(
          this.vertex(m, new Vector3(Math.cos(a) * r, y, Math.sin(a) * r), normal, 0, 0, shaded),
        );
      }
      return ids;
    });
    for (let r = 0; r < ring.length - 1; r++) {
      const lo = ring[r] as number[];
      const hi = ring[r + 1] as number[];
      for (let k = 0; k < sides; k++) {
        // Angle grows clockwise seen from above in three's axes, so k + 1 is on the left from outside.
        const a = lo[k] as number;
        const b = lo[k + 1] as number;
        const c = hi[k] as number;
        const d = hi[k + 1] as number;
        this.indices.push(b, a, c, b, c, d);
      }
    }
    if (options.cap && radiusTop > 0) {
      shaded.copy(top);
      const middle = this.vertex(m, new Vector3(0, height, 0), UP, 0, 0, shaded);
      const rim: number[] = [];
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        rim.push(
          this.vertex(
            m,
            new Vector3(Math.cos(a) * radiusTop, height, Math.sin(a) * radiusTop),
            UP,
            0,
            0,
            shaded,
          ),
        );
      }
      for (let k = 0; k < sides; k++)
        this.indices.push(middle, rim[k + 1] as number, rim[k] as number);
    }
  }

  /** A sloped roof plane (or any quad) from four local corners: bl, br, tl, tr seen from its front. */
  quad(
    m: Matrix4,
    corners: readonly [Vector3, Vector3, Vector3, Vector3],
    colour: Color,
    uv: readonly [number, number, number, number] = [0, 0, 0, 0],
  ): void {
    normalMatrix.getNormalMatrix(m);
    const [bl, br, tl, tr] = corners;
    t1.subVectors(br, bl);
    t2.subVectors(tl, bl);
    const normal = new Vector3().crossVectors(t1, t2).normalize();
    const [u0, v0, u1, v1] = uv;
    const a = this.vertex(m, bl, normal, u0, v0, colour);
    const b = this.vertex(m, br, normal, u1, v0, colour);
    const c = this.vertex(m, tl, normal, u0, v1, colour);
    const d = this.vertex(m, tr, normal, u1, v1, colour);
    this.indices.push(a, b, d, a, d, c);
  }

  /** A thin beam between two world points (truss members, braces), square section `size`. */
  beam(from: Vector3, to: Vector3, size: number, colour: Color, m: Matrix4): void {
    const dir = new Vector3().subVectors(to, from);
    const length = dir.length();
    if (length < 1e-4) return;
    dir.divideScalar(length);
    // Local frame: y along the beam, so `box` (standing on y = 0) runs from `from` to `to`.
    const x =
      Math.abs(dir.y) < 0.99
        ? new Vector3().crossVectors(UP, dir).normalize()
        : new Vector3(1, 0, 0);
    const z = new Vector3().crossVectors(x, dir).normalize();
    m.makeBasis(x, dir, z).setPosition(from);
    this.box(m, size, length, size, colour);
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(this.normals), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(this.uvs), 2));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colours), 3));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    return geometry;
  }
}

const WHITE = new Color(1, 1, 1);

/** Board lettering: a condensed bold grotesque where one is installed, squeezed Arial otherwise. */
const FONT =
  '"Barlow Condensed", "Arial Narrow", "Liberation Sans Narrow", "Helvetica Neue", Arial, sans-serif';

function lettering(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  px: number,
  colour: string,
  maxWidth: number,
  align: CanvasTextAlign = 'center',
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.82, 1);
  ctx.font = `700 ${px}px ${FONT}`;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0, maxWidth / 0.82);
  ctx.restore();
}

/** The circuit's mark: a kestrel wing as a chevron. */
function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, colour: string) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x - s, y - s * 0.35);
  ctx.lineTo(x, y + s * 0.25);
  ctx.lineTo(x + s, y - s * 0.35);
  ctx.lineTo(x + s, y - s * 0.05);
  ctx.lineTo(x, y + s * 0.55);
  ctx.lineTo(x - s, y - s * 0.05);
  ctx.closePath();
  ctx.fill();
}

export type AtlasRect = readonly [number, number, number, number];

export interface SignAtlas {
  texture: CanvasTexture;
  /** Trackside banners (brand kit), in a fixed order. */
  banners: readonly AtlasRect[];
  board: Record<'board300' | 'board200' | 'board100', AtlasRect>;
  /** Marshal post panels by post number (1-based). */
  marshal: (post: number) => AtlasRect;
  /** Corner number boards (1-based). */
  corner: (turn: number) => AtlasRect;
  extinguisher: AtlasRect;
  /** One-texel swatches for posts, backs and frames: [u, v]. */
  swatch: Record<
    'green' | 'grey' | 'black' | 'white' | 'cream' | 'rust',
    readonly [number, number]
  >;
}

const ATLAS = 1024;
/** Atlas pixels to uv (canvas y runs down, uv v runs up). */
const rect = (x: number, y: number, w: number, h: number): AtlasRect => [
  x / ATLAS,
  1 - (y + h) / ATLAS,
  (x + w) / ATLAS,
  1 - y / ATLAS,
];

/**
 * The signage atlas (1024 x 1024): 8 banners, distance boards, marshal panels, corner numbers,
 * the extinguisher board and colour swatches. Flat colours, about 10% sun-faded, with a little
 * dirt along the bottom of each board.
 */
export function signAtlas(anisotropy: number): SignAtlas {
  const banners: AtlasRect[] = [];
  const texture = canvasTexture(
    ATLAS,
    ATLAS,
    (ctx) => {
      ctx.fillStyle = '#2a2c2e';
      ctx.fillRect(0, 0, ATLAS, ATLAS);
      const kit: [string, (x: number, y: number) => void][] = [
        [
          'FENNIK',
          (x, y) => {
            ctx.fillStyle = '#1f3b2d';
            ctx.fillRect(x, y, 512, 102);
            lettering(ctx, 'FENNIK', x + 256, y + 48, 74, '#f2f0ea', 470);
            ctx.fillStyle = '#b8c24a';
            ctx.fillRect(x + 150, y + 86, 212, 5);
          },
        ],
        [
          'SOLVANE',
          (x, y) => {
            ctx.fillStyle = '#a8462a';
            ctx.fillRect(x, y, 512, 102);
            lettering(ctx, 'SOLVANE', x + 256, y + 52, 78, '#efe9dc', 470);
          },
        ],
        [
          'VAELTO',
          (x, y) => {
            ctx.fillStyle = '#161616';
            ctx.fillRect(x, y, 512, 102);
            lettering(ctx, 'VAELTO', x + 200, y + 52, 70, '#c9cccf', 300);
            lettering(ctx, 'TIMING', x + 400, y + 54, 40, '#8f9396', 150);
          },
        ],
        [
          'HOLMRIDGE',
          (x, y) => {
            ctx.fillStyle = '#6b4a2f';
            ctx.fillRect(x, y, 512, 102);
            lettering(ctx, 'HOLMRIDGE', x + 256, y + 44, 62, '#efe9dc', 470);
            lettering(ctx, 'TIMBER SINCE 1931', x + 256, y + 84, 22, '#d8cdb6', 300);
          },
        ],
        [
          'QUENNA',
          (x, y) => {
            ctx.fillStyle = '#ecebe6';
            ctx.fillRect(x, y, 512, 102);
            lettering(ctx, 'QUENNA', x + 220, y + 52, 74, '#2f5d8a', 340);
            ctx.fillStyle = '#2f5d8a';
            ctx.beginPath();
            ctx.arc(x + 430, y + 52, 22, 0, Math.PI * 2);
            ctx.fill();
          },
        ],
        [
          'KESTREL PINES',
          (x, y) => {
            ctx.fillStyle = '#1f3b2d';
            ctx.fillRect(x, y, 512, 102);
            chevron(ctx, x + 70, y + 46, 36, '#b5562c');
            lettering(ctx, 'KESTREL PINES', x + 290, y + 52, 58, '#efe9dc', 380);
          },
        ],
        [
          'FENNIK TYRES',
          (x, y) => {
            ctx.fillStyle = '#efe9dc';
            ctx.fillRect(x, y, 512, 102);
            lettering(ctx, 'FENNIK', x + 190, y + 52, 70, '#1f3b2d', 280);
            lettering(ctx, 'TYRES', x + 400, y + 54, 44, '#1f3b2d', 160);
            ctx.fillStyle = '#b8c24a';
            ctx.fillRect(x, y + 94, 512, 8);
          },
        ],
        [
          'SOLVANE FUEL',
          (x, y) => {
            ctx.fillStyle = '#efe9dc';
            ctx.fillRect(x, y, 512, 102);
            ctx.fillStyle = '#a8462a';
            ctx.fillRect(x, y, 120, 102);
            lettering(ctx, 'S', x + 60, y + 52, 80, '#efe9dc', 100);
            lettering(ctx, 'SOLVANE FUEL', x + 316, y + 52, 52, '#a8462a', 370);
          },
        ],
      ];
      kit.forEach(([, draw], i) => {
        const x = (i % 2) * 512;
        const y = Math.floor(i / 2) * 128 + 13;
        draw(x, y);
        banners.push(rect(x, y, 512, 102));
      });
      // Distance boards: white, black numerals.
      ['300', '200', '100'].forEach((text, i) => {
        const x = i * 256;
        ctx.fillStyle = '#e8e6e0';
        ctx.fillRect(x + 4, 516, 248, 184);
        lettering(ctx, text, x + 128, 612, 150, '#161616', 230);
      });
      const swatches: [number, string][] = [
        [768, '#1f3b2d'],
        [800, '#2a2c2e'],
        [832, '#161616'],
        [864, '#e8e6e0'],
        [896, '#efe9dc'],
        [928, '#b5562c'],
      ];
      for (const [x, colour] of swatches) {
        ctx.fillStyle = colour;
        ctx.fillRect(x, 512, 32, 64);
      }
      // Marshal post panels: orange with the white post number.
      for (let k = 0; k < 16; k++) {
        const x = (k % 8) * 128;
        const y = 704 + Math.floor(k / 8) * 96;
        ctx.fillStyle = '#e8601c';
        ctx.fillRect(x + 2, y + 2, 124, 92);
        lettering(ctx, String(k + 1), x + 64, y + 50, 70, '#ffffff', 110);
      }
      // Corner numbers: circuit green with cream numerals.
      for (let k = 0; k < 12; k++) {
        const x = k * 64;
        ctx.fillStyle = '#1f3b2d';
        ctx.fillRect(x + 2, 898, 60, 60);
        lettering(ctx, String(k + 1), x + 32, 930, 44, '#efe9dc', 56);
      }
      // Extinguisher board.
      ctx.fillStyle = '#e8e6e0';
      ctx.fillRect(770, 898, 60, 60);
      lettering(ctx, 'F', 800, 930, 46, '#b81c2b', 50);
      fadeAndDirt(ctx, banners);
    },
    anisotropy,
  );
  const swatchUv = (x: number): readonly [number, number] => [(x + 16) / ATLAS, 1 - 544 / ATLAS];
  return {
    texture,
    banners,
    board: {
      board300: rect(4, 516, 248, 184),
      board200: rect(260, 516, 248, 184),
      board100: rect(516, 516, 248, 184),
    },
    marshal: (post) => {
      const k = (Math.max(1, post) - 1) % 16;
      return rect((k % 8) * 128 + 2, 704 + Math.floor(k / 8) * 96 + 2, 124, 92);
    },
    corner: (turn) => rect(((Math.max(1, turn) - 1) % 12) * 64 + 2, 898, 60, 60),
    extinguisher: rect(770, 898, 60, 60),
    swatch: {
      green: swatchUv(768),
      grey: swatchUv(800),
      black: swatchUv(832),
      white: swatchUv(864),
      cream: swatchUv(896),
      rust: swatchUv(928),
    },
  };
}

/** About 10% sun fade over the whole atlas, and a faint band of road dirt along each banner's foot. */
function fadeAndDirt(ctx: CanvasRenderingContext2D, banners: readonly AtlasRect[]): void {
  const image = ctx.getImageData(0, 0, ATLAS, ATLAS);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] as number;
    const g = d[i + 1] as number;
    const b = d[i + 2] as number;
    const grey = 0.3 * r + 0.59 * g + 0.11 * b;
    d[i] = r + (grey - r) * 0.1;
    d[i + 1] = g + (grey - g) * 0.1;
    d[i + 2] = b + (grey - b) * 0.1;
  }
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (const [u0, v0, u1] of banners) {
    const x0 = Math.round(u0 * ATLAS);
    const x1 = Math.round(u1 * ATLAS);
    const yBottom = Math.round((1 - v0) * ATLAS);
    for (let y = yBottom - 14; y < yBottom; y++) {
      const fade = (y - (yBottom - 14)) / 14;
      for (let x = x0; x < x1; x++) {
        const i = (y * ATLAS + x) * 4;
        const k = 1 - 0.25 * fade * (0.5 + rand());
        d[i] = (d[i] as number) * k;
        d[i + 1] = (d[i + 1] as number) * k;
        d[i + 2] = (d[i + 2] as number) * k * 0.95;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * A seated crowd seen from the track, tiling along x (one tile = 8 m of a row, 16 seats): muted
 * clothes on circuit-green seats, about three in four seats taken.
 */
export function crowdTexture(): CanvasTexture {
  const texture = canvasTexture(512, 64, (ctx) => {
    ctx.fillStyle = '#2e5a46';
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = '#244a39';
    ctx.fillRect(0, 44, 512, 20);
    const shirts = [
      '#e6e2d8',
      '#2b3a55',
      '#5a6b80',
      '#3a3a3a',
      '#8a8f94',
      '#a33a32',
      '#c9b27a',
      '#e6e2d8',
      '#2b3a55',
      '#3a3a3a',
    ];
    const groups = ['#2f5a46', '#b5562c'];
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let s = 0; s < 16; s++) {
      const x = s * 32 + 6 + rand() * 4;
      if (rand() < 0.25) continue;
      // Fan groups in circuit green and rust sit together.
      const group = s >= 10 && s < 13;
      ctx.fillStyle = group
        ? (groups[s % 2] ?? '#2f5a46')
        : (shirts[Math.floor(rand() * shirts.length)] ?? '#3a3a3a');
      ctx.fillRect(x, 26 + rand() * 6, 20, 34);
      ctx.fillStyle = rand() < 0.5 ? '#6b4a32' : '#c79a72';
      ctx.beginPath();
      ctx.arc(x + 10, 20 + rand() * 5, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  texture.wrapS = RepeatWrapping;
  return texture;
}

/** Four 1.5 x 1 m flags in a row (u 0-0.25 each): the circuit, FENNIK, SOLVANE, QUENNA. */
export function flagTexture(): CanvasTexture {
  return canvasTexture(512, 96, (ctx) => {
    const flags: [string, (x: number) => void][] = [
      [
        '#1f3b2d',
        (x) => {
          chevron(ctx, x + 64, 42, 34, '#b5562c');
        },
      ],
      ['#1f3b2d', (x) => lettering(ctx, 'FENNIK', x + 64, 48, 38, '#f2f0ea', 116)],
      ['#a8462a', (x) => lettering(ctx, 'SOLVANE', x + 64, 48, 36, '#efe9dc', 116)],
      ['#ecebe6', (x) => lettering(ctx, 'QUENNA', x + 64, 48, 36, '#2f5d8a', 116)],
    ];
    flags.forEach(([ground, draw], i) => {
      ctx.fillStyle = ground;
      ctx.fillRect(i * 128, 0, 128, 96);
      draw(i * 128);
    });
  });
}
