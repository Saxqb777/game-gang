/**
 * Everything beside the corridor that tells you where you are: grandstands with a crowd, the team
 * compound, marshal posts, distance and corner boards, sponsor banners, TV towers, the footbridge
 * over the Meadow run, the stone Beck bridge, the watermill at T1, the fire lookout
 * on the ridge and the dead pine on the Kestrel knoll, plus flags that move.
 *
 * Each kind of surface is one merged mesh for the whole lap (a few thousand triangles each), so the
 * storytelling costs about six draw calls per view however many props there are. Every prop
 * stands on `Terrain.heightAt` or `Track.lateralPoint` with darker grime at its foot.
 */
import {
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { hash32, mulberry32, type Placement } from '../track/gen/placement';
import { BARRIER } from '../track/surfaces';
import type { Terrain } from '../track/terrain';
import type { Track } from '../track/track';
import { patchMaterial } from './materials';
import {
  MeshKit,
  crowdTexture,
  flagTexture,
  signAtlas,
  type AtlasRect,
  type SignAtlas,
} from './sceneryModels';

/** Kestrel Pines corners (DESIGN.md): turn-in distance from the line (m), for the corner boards. */
const CORNERS = [275, 437, 609, 1014, 1240, 1566, 1908, 2028, 2213, 2477, 2655, 3025] as const;
/** Landmarks along the lap (m from the line). */
const MAIN_STAND = { at: 5, length: 84, rows: 10 };
const CORNER_STANDS = [
  { at: 285, length: 40, rows: 7, side: 1 as const },
  { at: 3058, length: 40, rows: 7, side: 1 as const },
];
const FOOTBRIDGE_AT = 2610;
const BECK = { from: 2246, to: 2316 };
const MILL_AT = 318;
const LOOKOUT_AT = 1330;
const KNOLL_AT = 1745;
const TOWERS: readonly [number, -1 | 1][] = [
  [300, 1],
  [1760, 1],
  [2520, -1],
  [3075, 1],
];
/** Banners: one every this many metres (plus up to half again at random), both sides in turn. */
const BANNER_EVERY = 46;
const BANNER = { width: 4.5, height: 0.9, lift: 0.15, toe: 0.3 };
/** Grandstand rows: depth and rise (m), the front wall's height. */
const ROW_DEPTH = 0.85;
const ROW_RISE = 0.42;
const STAND_FRONT = 1.2;
const STAND_ROOF_CLEAR = 3.2;
/** Footbridge deck: clearance over the road and width (m). */
const BRIDGE_CLEARANCE = 6.5;
const BRIDGE_WIDTH = 4;

/** Palette (sRGB hex). */
const C = {
  concrete: new Color('#bdb9ae'),
  seats: new Color('#2e5a46'),
  roof: new Color('#8d9093'),
  roofUnder: new Color('#2a2c2e'),
  hut: new Color('#d9d7d0'),
  hutRoof: new Color('#2e4a3a'),
  steel: new Color('#2b2e31'),
  galvanised: new Color('#9ea3a6'),
  truss: new Color('#2e4a3a'),
  tarp: new Color('#161616'),
  marquee: new Color('#ecebe6'),
  cabin: new Color('#8a8f94'),
  timber: new Color('#6b4a2f'),
  stone: new Color('#8a857a'),
  slate: new Color('#3a3f44'),
  deadwood: new Color('#6e655a'),
  rock: new Color('#77746c'),
  yellow: new Color('#e3b81f'),
  green: new Color('#3a7d44'),
  pole: new Color('#c9cccf'),
  mud: new Color('#3b3022'),
  water: new Color('#16211e'),
} as const;

const UP = new Vector3(0, 1, 0);
const tmp = new Vector3();
const m = new Matrix4();
const m2 = new Matrix4();

interface Zone {
  x: number;
  z: number;
  ux: number;
  uz: number;
  halfL: number;
  halfW: number;
}

export class Scenery {
  readonly group = new Group();
  readonly stats: { meshes: number; triangles: number };
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: Texture[] = [];
  private readonly zones: Zone[] = [];
  private readonly props = new MeshKit();
  private readonly signs = new MeshKit();
  private readonly stands = new MeshKit();
  private readonly crowd = new MeshKit();
  private readonly flags = new MeshKit();
  private readonly flagInfo: number[] = [];
  private readonly decal = new MeshKit();
  private readonly waterInfo: number[] = [];
  private readonly atlas: SignAtlas;
  private readonly flagTime = { value: 0 };

  constructor(
    private readonly track: Track,
    private readonly terrain: Terrain,
    placements: readonly Placement[],
    anisotropy: number,
  ) {
    this.atlas = signAtlas(anisotropy);
    this.textures.push(this.atlas.texture);
    this.addGrandstand(MAIN_STAND.at, MAIN_STAND.length, MAIN_STAND.rows, 1, true);
    for (const stand of CORNER_STANDS) {
      this.addGrandstand(stand.at, stand.length, stand.rows, stand.side, false);
    }
    this.addCompound();
    this.addMarshals(placements.filter((p) => p.kind === 'marshal'));
    this.addBoards(placements);
    this.addCornerBoards();
    this.addBanners();
    this.addTowers();
    this.addFootbridge();
    this.addBeckBridge();
    this.addMill();
    this.addLookout();
    this.addKnoll();
    this.addGantryFlags();
    const before = this.group.children.length;
    this.buildMeshes();
    let triangles = 0;
    for (const kit of [this.props, this.signs, this.stands, this.crowd, this.flags, this.decal]) {
      triangles += kit.triangles;
    }
    this.stats = { meshes: this.group.children.length - before, triangles };
  }

  /** Ground no tree may stand on: buildings, stands, clearings and the stream. */
  blocked(x: number, z: number): boolean {
    for (const zone of this.zones) {
      const dx = x - zone.x;
      const dz = z - zone.z;
      const a = dx * zone.ux + dz * zone.uz;
      const b = -dx * zone.uz + dz * zone.ux;
      if (Math.abs(a) <= zone.halfL && Math.abs(b) <= zone.halfW) return true;
    }
    return false;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.group.removeFromParent();
  }

  // ------------------------------------------------------------------------------------------
  // Placement helpers.

  private station(distance: number): number {
    return this.track.indexAt(this.track.startLine.distance + distance);
  }

  /** World point `lateral` m from station `i` on the ground (terrain), sunk a little. */
  private ground(i: number, lateral: number, out = tmp): Vector3 {
    const s = this.track.sample(i);
    out.set(s.position.x + s.right.x * lateral, 0, s.position.z + s.right.z * lateral);
    out.y = this.terrain.heightAt(out.x, out.z) - 0.05;
    return out;
  }

  /** A frame at a world point, local +Z along (dx, dz), y up. */
  private frameAt(x: number, y: number, z: number, dx: number, dz: number, out = m): Matrix4 {
    const zAxis = new Vector3(dx, 0, dz).normalize();
    const xAxis = new Vector3().crossVectors(UP, zAxis).normalize();
    return out.makeBasis(xAxis, UP, zAxis).setPosition(x, y, z);
  }

  /** Frame beside station i, `lateral` m out, local +Z facing the road, on the terrain. */
  private facingRoad(i: number, lateral: number, out = m): Matrix4 {
    const s = this.track.sample(i);
    const side = lateral < 0 ? -1 : 1;
    const p = this.ground(i, lateral);
    return this.frameAt(p.x, p.y, p.z, -side * s.right.x, -side * s.right.z, out);
  }

  private zone(x: number, z: number, ux: number, uz: number, halfL: number, halfW: number) {
    const length = Math.hypot(ux, uz) || 1;
    this.zones.push({ x, z, ux: ux / length, uz: uz / length, halfL, halfW });
  }

  /** Lateral of the clear ground just behind the barrier on `side` at station i (m, signed). */
  private behindBarrier(i: number, side: -1 | 1, extra: number): number {
    const p = this.track.side(i, side);
    const depth = p.barrier === BARRIER.tyres ? 1.5 : p.barrier === BARRIER.none ? 0 : 0.6;
    return side * (p.wall + depth + extra);
  }

  // ------------------------------------------------------------------------------------------
  // Grandstands and the team compound.

  /**
   * A covered stand facing the track, `length` m long with `rows` rows, its front `gap` behind
   * the barrier. Local frame: x along the stand, z towards the road, y up; origin at the front
   * foot, centred.
   */
  private addGrandstand(at: number, length: number, rows: number, side: -1 | 1, main: boolean) {
    const i = this.station(at);
    const lateral = this.behindBarrier(i, side, main ? 5.4 : 4);
    const s = this.track.sample(i);
    // Stand on the lowest ground under the footprint so no corner floats.
    const depth = rows * ROW_DEPTH + 1;
    let y = Infinity;
    for (const a of [-0.5, 0.5]) {
      for (const d of [0, depth]) {
        const x = s.position.x + s.tangent.x * a * length + s.right.x * (lateral + side * d);
        const z = s.position.z + s.tangent.z * a * length + s.right.z * (lateral + side * d);
        y = Math.min(y, this.terrain.heightAt(x, z));
      }
    }
    const p = this.ground(i, lateral);
    const frame = this.frameAt(
      p.x,
      y - 0.3,
      p.z,
      -side * s.right.x,
      -side * s.right.z,
      new Matrix4(),
    );
    const local = (x: number, yy: number, z: number, out = m2) =>
      out.makeTranslation(x, yy, z).premultiply(frame);
    const k = this.stands;
    const roofY = STAND_FRONT + ROW_RISE * rows + STAND_ROOF_CLEAR;
    // Front wall, then one stepped row after another.
    k.box(local(0, 0, -0.2), length, STAND_FRONT, 0.4, C.concrete, { grime: true });
    for (let r = 0; r < rows; r++) {
      const top = STAND_FRONT + ROW_RISE * (r + 1);
      const z = -(r + 0.5) * ROW_DEPTH - 0.4;
      k.box(local(0, 0, z), length, top, ROW_DEPTH, C.concrete, { grime: true });
      // The crowd sits on each step, facing the track (crowd texture tiles every 8 m).
      this.crowd.panel(local(0, top, z + 0.2), length, 0.95, [0, 0, length / 8, 1]);
    }
    const backZ = -rows * ROW_DEPTH - 0.6;
    k.box(local(0, 0, backZ), length, roofY, 0.3, C.concrete, { grime: true });
    // End walls.
    for (const end of [-1, 1]) {
      k.box(local((end * (length + 0.3)) / 2, 0, -depth / 2), 0.3, roofY - 0.5, depth, C.concrete, {
        grime: true,
      });
    }
    // Cantilever roof: pale top, dark underside, rising towards the track.
    const roofDepth = depth + 2.2;
    for (const [dy, colour] of [
      [0.12, C.roof],
      [0, C.roofUnder],
    ] as const) {
      m2.makeRotationX(-0.07)
        .setPosition(0, roofY + dy, backZ + roofDepth / 2 - 0.3)
        .premultiply(frame);
      k.box(m2, length + 1.2, 0.12, roofDepth, colour, { bottom: true });
    }
    // Roof ribs over the top, columns at the back.
    for (let x = -length / 2; x <= length / 2 + 0.1; x += 12) {
      k.box(local(x, 0, backZ - 0.6), 0.45, roofY, 0.45, C.steel, { grime: true });
      const from = new Vector3(x, roofY + 2.2, backZ).applyMatrix4(frame);
      const to = new Vector3(x, roofY + 0.2, backZ + roofDepth - 0.5).applyMatrix4(frame);
      k.beam(from, to, 0.22, C.steel, m2);
      const mast = new Vector3(x, roofY, backZ).applyMatrix4(frame);
      k.beam(mast, from, 0.25, C.steel, m2);
    }
    if (main) {
      // Flags along the back of the roof.
      for (let f = 0; f < 6; f++) {
        const x = -length / 2 + 6 + f * ((length - 12) / 5);
        const base = new Vector3(x, roofY + 0.1, backZ).applyMatrix4(frame);
        const along = new Vector3(1, 0, 0).transformDirection(frame);
        this.addFlag(base, 4, along, f);
      }
    }
    const cx = s.position.x + s.right.x * (lateral + (side * depth) / 2);
    const cz = s.position.z + s.right.z * (lateral + (side * depth) / 2);
    this.zone(cx, cz, s.tangent.x, s.tangent.z, length / 2 + 4, depth / 2 + 5);
  }

  /** The team compound behind the main stand: marquees and cabins seen through the gaps. */
  private addCompound(): void {
    const i = this.station(MAIN_STAND.at);
    const s = this.track.sample(i);
    const behind = this.behindBarrier(i, 1, 5.4 + MAIN_STAND.rows * ROW_DEPTH + 16);
    const k = this.props;
    for (let n = 0; n < 6; n++) {
      const along = -30 + n * 12;
      const lateral = behind + (n % 2) * 3;
      const x = s.position.x + s.tangent.x * along + s.right.x * lateral;
      const z = s.position.z + s.tangent.z * along + s.right.z * lateral;
      const y = this.terrain.heightAt(x, z) - 0.05;
      this.frameAt(x, y, z, s.tangent.x, s.tangent.z);
      // Four legs and a white pyramid roof.
      for (const [lx, lz] of [
        [-2.9, -2.9],
        [2.9, -2.9],
        [2.9, 2.9],
        [-2.9, 2.9],
      ] as const) {
        k.box(m2.makeTranslation(lx, 0, lz).premultiply(m), 0.1, 2.5, 0.1, C.galvanised);
      }
      const apex = new Vector3(0, 4.3, 0);
      const corners = [
        new Vector3(-3, 2.5, -3),
        new Vector3(3, 2.5, -3),
        new Vector3(3, 2.5, 3),
        new Vector3(-3, 2.5, 3),
      ];
      for (let c = 0; c < 4; c++) {
        const a = corners[c] as Vector3;
        const b = corners[(c + 1) % 4] as Vector3;
        // Seen from outside, b is on the left of a.
        k.quad(m, [b, a, apex, apex], C.marquee);
      }
    }
    for (let n = 0; n < 4; n++) {
      const along = -24 + n * 15;
      const lateral = behind + 12;
      const x = s.position.x + s.tangent.x * along + s.right.x * lateral;
      const z = s.position.z + s.tangent.z * along + s.right.z * lateral;
      this.frameAt(x, this.terrain.heightAt(x, z) - 0.05, z, -s.right.x, -s.right.z);
      k.box(m, 6, 2.6, 2.5, C.cabin, { grime: true });
      k.box(m2.makeTranslation(0, 2.6, 0).premultiply(m), 6.2, 0.12, 2.7, C.roofUnder);
    }
    const lateral = behind + 6;
    this.zone(
      s.position.x + s.right.x * lateral,
      s.position.z + s.right.z * lateral,
      s.tangent.x,
      s.tangent.z,
      45,
      16,
    );
  }

  // ------------------------------------------------------------------------------------------
  // Marshals, boards and banners.

  private addMarshals(posts: readonly Placement[]): void {
    const sorted = [...posts].sort((a, b) => this.fromStart(a.station) - this.fromStart(b.station));
    sorted.forEach((post, n) => {
      const y = this.terrain.heightAt(post.x, post.z) - 0.05;
      this.frameAt(post.x, y, post.z, Math.sin(post.yaw), Math.cos(post.yaw));
      const hut = m.clone();
      this.props.box(hut, 2.4, 2.6, 1.8, C.hut, { grime: true });
      this.props.box(m2.makeTranslation(0, 2.6, 0.1).premultiply(hut), 2.8, 0.14, 2.3, C.hutRoof);
      // Orange post panel on the front, the extinguisher board on the side.
      this.signs.panel(
        m2.makeTranslation(0, 1.5, 0.91).premultiply(hut),
        0.8,
        0.6,
        this.atlas.marshal(n + 1),
      );
      m2.makeRotationY(Math.PI / 2)
        .setPosition(1.21, 1.1, 0.3)
        .premultiply(hut);
      this.signs.panel(m2, 0.45, 0.45, this.atlas.extinguisher);
      // Two rolled flags in a holder by the door.
      for (const [dx, colour] of [
        [-1.0, C.yellow],
        [-0.85, C.green],
      ] as const) {
        this.props.prism(
          m2.makeTranslation(dx, 0.9, 1.05).premultiply(hut),
          0.05,
          0.05,
          1.3,
          4,
          colour,
        );
      }
      this.zone(post.x, post.z, 1, 0, 4, 4);
    });
  }

  /** Signed metres from the start line to a station. */
  private fromStart(station: number): number {
    return this.track.ahead(this.track.startLine.distance, station * this.track.spacing);
  }

  private addBoards(placements: readonly Placement[]): void {
    const { swatch } = this.atlas;
    for (const p of placements) {
      if (p.kind !== 'board300' && p.kind !== 'board200' && p.kind !== 'board100') continue;
      const s = this.track.sample(p.station);
      const lateral = (p.x - s.position.x) * s.right.x + (p.z - s.position.z) * s.right.z;
      this.track.lateralPoint(p.station, lateral, tmp, -0.05);
      this.frameAt(tmp.x, tmp.y, tmp.z, Math.sin(p.yaw), Math.cos(p.yaw));
      const board = m.clone();
      for (const dx of [-0.42, 0.42]) {
        this.signs.box(
          m2.makeTranslation(dx, 0, -0.05).premultiply(board),
          0.08,
          1.3,
          0.08,
          WHITE,
          {
            uv: swatch.black,
            grime: true,
          },
        );
      }
      this.signs.box(
        m2.makeTranslation(0, 0.4, -0.03).premultiply(board),
        1.24,
        0.94,
        0.05,
        WHITE,
        {
          uv: swatch.green,
        },
      );
      this.signs.panel(
        m2.makeTranslation(0, 0.42, 0.001).premultiply(board),
        1.2,
        0.9,
        this.atlas.board[p.kind],
      );
    }
  }

  /** A small green number board at each corner's turn-in, on the outside. */
  private addCornerBoards(): void {
    const { swatch } = this.atlas;
    CORNERS.forEach((at, n) => {
      const i = this.station(at);
      // The outside of the corner it announces: where it is turning 40 m on.
      const side = this.track.sample(i + 40).curvature > 0 ? 1 : -1;
      const lateral = this.behindBarrier(i, side, 0.6);
      const s = this.track.sample(i);
      this.track.lateralPoint(i, lateral, tmp, -0.05);
      // Face the oncoming cars, toed in.
      const dx = -s.tangent.x * 0.9 - side * s.right.x * 0.45;
      const dz = -s.tangent.z * 0.9 - side * s.right.z * 0.45;
      this.frameAt(tmp.x, tmp.y, tmp.z, dx, dz);
      this.signs.box(m2.makeTranslation(0, 0, -0.04).premultiply(m), 0.07, 1.6, 0.07, WHITE, {
        uv: swatch.black,
        grime: true,
      });
      this.signs.panel(
        m2.makeTranslation(0, 1.0, 0).premultiply(m),
        0.6,
        0.6,
        this.atlas.corner(n + 1),
      );
    });
  }

  /** Sponsor boards behind the barriers on straights and braking zones, never the same twice running. */
  private addBanners(): void {
    const { track } = this;
    const rng = mulberry32(hash32(`${track.definition.id}:banners`));
    const banners = this.atlas.banners;
    let last = -1;
    let side: -1 | 1 = 1;
    const posts = this.atlas.swatch.black;
    for (let d = 20; d < track.length - 20; d += BANNER_EVERY + rng() * BANNER_EVERY * 0.5) {
      const i = this.station(d);
      side = side > 0 ? -1 : 1;
      if (Math.abs(track.sample(i).curvature) > 1 / 300) continue;
      const p = track.side(i, side);
      let brand = Math.floor(rng() * banners.length);
      if (brand === last) brand = (brand + 1) % banners.length;
      last = brand;
      const uv = banners[brand] as AtlasRect;
      const s = track.sample(i);
      if (p.barrier === BARRIER.wall || p.barrier === BARRIER.fence) {
        // Flush on the pit wall or the fence base, facing the road.
        track.lateralPoint(i, side * (p.wall - 0.01), tmp, 0.1);
        this.frameAt(tmp.x, tmp.y, tmp.z, -side * s.right.x, -side * s.right.z);
        this.signs.panel(m, BANNER.width, BANNER.height, uv);
        continue;
      }
      const lateral = this.behindBarrier(i, side, 0.4);
      const g = this.ground(i, lateral);
      // Toed in towards the oncoming cars.
      const dx = -side * s.right.x * Math.cos(BANNER.toe) - s.tangent.x * Math.sin(BANNER.toe);
      const dz = -side * s.right.z * Math.cos(BANNER.toe) - s.tangent.z * Math.sin(BANNER.toe);
      this.frameAt(g.x, g.y, g.z, dx, dz);
      const frame = m.clone();
      for (const lx of [-BANNER.width / 2 + 0.3, BANNER.width / 2 - 0.3]) {
        this.signs.box(
          m2.makeTranslation(lx, 0, -0.06).premultiply(frame),
          0.07,
          BANNER.lift + BANNER.height,
          0.07,
          WHITE,
          {
            uv: posts,
            grime: true,
          },
        );
      }
      this.signs.box(
        m2.makeTranslation(0, BANNER.lift, -0.03).premultiply(frame),
        BANNER.width,
        BANNER.height,
        0.04,
        WHITE,
        {
          uv: this.atlas.swatch.grey,
          bottom: true,
        },
      );
      this.signs.panel(
        m2.makeTranslation(0, BANNER.lift, 0.0).premultiply(frame),
        BANNER.width,
        BANNER.height,
        uv,
      );
    }
  }

  // ------------------------------------------------------------------------------------------
  // Structures.

  /** TV camera towers: scaffold, a platform and a black-tarped camera box. */
  private addTowers(): void {
    const k = this.props;
    for (const [at, side] of TOWERS) {
      const i = this.station(at);
      const lateral = this.behindBarrier(i, side, 7);
      const frame = this.facingRoad(i, lateral, new Matrix4());
      const legs = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const;
      const top = 7;
      const at3 = (x: number, y: number, z: number) => new Vector3(x, y, z).applyMatrix4(frame);
      for (const [lx, lz] of legs) {
        k.box(m2.makeTranslation(lx, 0, lz).premultiply(frame), 0.1, top + 1.1, 0.1, C.galvanised, {
          grime: true,
        });
      }
      for (let c = 0; c < 4; c++) {
        const [ax, az] = legs[c] as readonly [number, number];
        const [bx, bz] = legs[(c + 1) % 4] as readonly [number, number];
        for (const [y0, y1] of [
          [0.3, 3.6],
          [3.6, 6.9],
        ] as const) {
          k.beam(at3(ax, y0, az), at3(bx, y1, bz), 0.06, C.galvanised, m2);
          k.beam(at3(bx, y0, bz), at3(ax, y1, az), 0.06, C.galvanised, m2);
        }
      }
      k.box(m2.makeTranslation(0, top, 0).premultiply(frame), 2.4, 0.12, 2.4, C.timber, {
        bottom: true,
      });
      for (const [lx, lz] of legs) {
        k.beam(
          at3(lx * 1.2, top + 1.05, lz * 1.2),
          at3(-lz * 1.2, top + 1.05, lx * 1.2),
          0.05,
          C.galvanised,
          m2,
        );
      }
      k.box(m2.makeTranslation(0, top + 0.12, -0.2).premultiply(frame), 1.3, 1.3, 1.3, C.tarp);
      tmp.set(0, 0, 0).applyMatrix4(frame);
      this.zone(tmp.x, tmp.z, 1, 0, 4, 4);
    }
  }

  /** The timber-truss spectator footbridge over the Meadow run, with fascia banners on both faces. */
  private addFootbridge(): void {
    const { track } = this;
    const i = this.station(FOOTBRIDGE_AT);
    const s = track.sample(i);
    const reachL = track.side(i, -1).wall + 4;
    const reachR = track.side(i, 1).wall + 4;
    const deckY = s.position.y + BRIDGE_CLEARANCE;
    // Frame: x across the road (towards the right), z along the lap, origin over the centre line.
    const frame = new Matrix4()
      .makeBasis(s.right, UP, new Vector3().crossVectors(s.right, UP).normalize())
      .setPosition(s.position.x, deckY, s.position.z);
    const at3 = (x: number, y: number, z: number) => new Vector3(x, y, z).applyMatrix4(frame);
    const k = this.props;
    const span = reachL + reachR;
    const mid = (reachR - reachL) / 2;
    k.box(m2.makeTranslation(mid, -0.35, 0).premultiply(frame), span, 0.35, BRIDGE_WIDTH, C.truss, {
      bottom: true,
    });
    const halfW = BRIDGE_WIDTH / 2;
    for (const z of [-halfW, halfW]) {
      k.beam(at3(-reachL, 0, z), at3(reachR, 0, z), 0.18, C.truss, m2);
      k.beam(at3(-reachL, 1.8, z), at3(reachR, 1.8, z), 0.18, C.truss, m2);
      const panels = Math.round(span / 3);
      for (let p = 0; p <= panels; p++) {
        const x0 = -reachL + (p * span) / panels;
        k.beam(at3(x0, 0, z), at3(x0, 1.8, z), 0.12, C.truss, m2);
        if (p < panels) {
          const x1 = -reachL + ((p + 1) * span) / panels;
          const up = p % 2 === 0;
          k.beam(at3(x0, up ? 0 : 1.8, z), at3(x1, up ? 1.8 : 0, z), 0.09, C.truss, m2);
        }
      }
    }
    // Stair towers down to the ground at each end.
    for (const end of [-reachL - 1.5, reachR + 1.5]) {
      const foot = at3(end, 0, 0);
      const groundY = this.terrain.heightAt(foot.x, foot.z) - 0.05;
      for (const [dx, dz] of [
        [-1.4, -halfW],
        [1.4, -halfW],
        [1.4, halfW],
        [-1.4, halfW],
      ] as const) {
        const top = at3(end + dx, 0, dz);
        k.beam(new Vector3(top.x, groundY, top.z), top, 0.2, C.truss, m2);
      }
      k.box(m2.makeTranslation(end, -0.3, 0).premultiply(frame), 3.2, 0.3, BRIDGE_WIDTH, C.timber);
      const centre = at3(end, 0, 0);
      this.zone(centre.x, centre.z, 1, 0, 6, 6);
    }
    // Fascia banners along the bottom chord, facing the cars from both directions.
    const banners = this.atlas.banners;
    const brands = [1, 5, 7, 5];
    const panelW = 4.6;
    const count = Math.floor(span / panelW);
    for (const face of [-1, 1] as const) {
      for (let p = 0; p < count; p++) {
        const x = -reachL + panelW / 2 + p * panelW + (span - count * panelW) / 2;
        // Local +z of the panel looks along -face * lap direction.
        m2.makeRotationY(face < 0 ? Math.PI : 0)
          .setPosition(x, -0.05 - 1.15, face * (halfW + 0.12))
          .premultiply(frame);
        this.signs.panel(
          m2,
          panelW,
          1.15,
          banners[brands[p % brands.length] as number] as AtlasRect,
        );
      }
    }
  }

  /** The stone Beck bridge: rubble parapets with capping stones behind the barriers. */
  private addBeckBridge(): void {
    const { track } = this;
    const from = this.station(BECK.from);
    const to = this.station(BECK.to);
    for (const side of [-1, 1] as const) {
      for (let i = from; i < to; i += 2) {
        const p = track.side(i, side);
        const lateral = side * (p.wall + 0.75);
        const a = this.ground(i, lateral, new Vector3());
        const b = this.ground(i + 2, side * (track.side(i + 2, side).wall + 0.75), new Vector3());
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        this.frameAt((a.x + b.x) / 2, Math.min(a.y, b.y), (a.z + b.z) / 2, b.x - a.x, b.z - a.z);
        // A capping stone on a rubble wall.
        this.props.box(m, 0.6, 0.95, length + 0.05, C.stone, { grime: true });
        this.props.box(
          m2.makeTranslation(0, 0.95, 0).premultiply(m),
          0.72,
          0.12,
          length + 0.05,
          C.concrete,
        );
      }
    }
  }

  /** A stream or pond edge as a decal on the terrain: mud banks either side of water. */
  private ribbon(points: readonly Vector3[], mudWidth: number, waterWidth: number): void {
    const k = this.decal;
    const across = new Vector3();
    const rows: number[][] = [];
    const offsets = [-mudWidth / 2, -waterWidth / 2, 0, waterWidth / 2, mudWidth / 2];
    const wet = [0, 1, 1, 1, 0];
    points.forEach((p, n) => {
      const prev = points[Math.max(0, n - 1)] as Vector3;
      const next = points[Math.min(points.length - 1, n + 1)] as Vector3;
      across.set(next.z - prev.z, 0, prev.x - next.x).normalize();
      rows.push(
        offsets.map((o, c) => {
          const x = p.x + across.x * o;
          const z = p.z + across.z * o;
          const y = this.terrain.heightAt(x, z) + 0.03;
          k.positions.push(x, y, z);
          k.normals.push(0, 1, 0);
          k.uvs.push(0, 0);
          const colour = wet[c] ? C.water : C.mud;
          k.colours.push(colour.r, colour.g, colour.b);
          this.waterInfo.push(wet[c] as number);
          return k.positions.length / 3 - 1;
        }),
      );
    });
    for (let n = 0; n < rows.length - 1; n++) {
      const a = rows[n] as number[];
      const b = rows[n + 1] as number[];
      for (let c = 0; c < offsets.length - 1; c++) {
        // Both windings: the ribbon's direction decides which one faces up, and the other is culled.
        const i0 = a[c] as number;
        const i1 = a[c + 1] as number;
        const j0 = b[c] as number;
        const j1 = b[c + 1] as number;
        k.indices.push(i0, i1, j1, i0, j1, j0, i0, j1, i1, i0, j0, j1);
      }
    }
  }

  /** The old watermill on the inside of T1 Millrace, with its wheel and pond. */
  private addMill(): void {
    const i = this.station(MILL_AT);
    const lateral = this.behindBarrier(i, -1, 22);
    const frame = this.facingRoad(i, lateral, new Matrix4());
    const k = this.props;
    k.box(frame, 10, 5.5, 7, C.stone, { grime: true });
    // Pitched slate roof: two slopes and two gables.
    const eave = 5.5;
    const ridge = 8.2;
    const corners = (z: number) => [new Vector3(-5.3, eave, z), new Vector3(5.3, eave, z)] as const;
    const [fl, fr] = corners(3.8);
    const [bl, br] = corners(-3.8);
    const rl = new Vector3(-5.3, ridge, 0);
    const rr = new Vector3(5.3, ridge, 0);
    k.quad(frame, [fl, fr, rl, rr], C.slate);
    k.quad(frame, [br, bl, rr, rl], C.slate);
    k.quad(
      frame,
      [
        new Vector3(5, eave, 3.5),
        new Vector3(5, eave, -3.5),
        new Vector3(5, ridge - 0.2, 0),
        new Vector3(5, ridge - 0.2, 0),
      ],
      C.stone,
    );
    k.quad(
      frame,
      [
        new Vector3(-5, eave, -3.5),
        new Vector3(-5, eave, 3.5),
        new Vector3(-5, ridge - 0.2, 0),
        new Vector3(-5, ridge - 0.2, 0),
      ],
      C.stone,
    );
    // The wheel on the gable end, turned edge-on to the wall.
    m2.makeRotationZ(Math.PI / 2)
      .setPosition(5.6, 3, 0)
      .premultiply(frame);
    k.prism(m2, 2.6, 2.6, 0.7, 10, C.timber, { cap: true });
    m2.makeRotationZ(-Math.PI / 2)
      .setPosition(5.6, 3, 0)
      .premultiply(frame);
    k.prism(m2, 2.6, 2.6, 0.01, 10, C.timber, { cap: true });
    // The pond beside it.
    const pond: Vector3[] = [];
    for (let a = 0; a <= 8; a++) {
      tmp.set(12 + a * 2.5, 0, -6 + Math.sin(a * 0.9) * 2).applyMatrix4(frame);
      pond.push(new Vector3(tmp.x, this.terrain.heightAt(tmp.x, tmp.z), tmp.z));
    }
    this.ribbon(pond, 16, 11);
    tmp.set(6, 0, -2).applyMatrix4(frame);
    this.zone(tmp.x, tmp.z, 1, 0, 22, 22);
  }

  /** A timber fire lookout on the ridge beside the Windhover. */
  private addLookout(): void {
    const i = this.station(LOOKOUT_AT);
    const lateral = this.behindBarrier(i, -1, 26);
    const frame = this.facingRoad(i, lateral, new Matrix4());
    const at3 = (x: number, y: number, z: number) => new Vector3(x, y, z).applyMatrix4(frame);
    const k = this.props;
    const top = 15;
    for (const [lx, lz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      k.beam(at3(lx * 2.4, -0.3, lz * 2.4), at3(lx * 1.3, top, lz * 1.3), 0.25, C.timber, m2);
    }
    for (const y of [4, 8, 12]) {
      const r = 2.4 - (1.1 * y) / top;
      k.beam(at3(-r, y, -r), at3(r, y, r), 0.12, C.timber, m2);
      k.beam(at3(r, y, -r), at3(-r, y, r), 0.12, C.timber, m2);
    }
    k.box(m2.makeTranslation(0, top, 0).premultiply(frame), 3.4, 2.6, 3.4, C.timber, {
      bottom: true,
    });
    const apex = new Vector3(0, top + 4.2, 0);
    const eaves = [
      new Vector3(-2.2, top + 2.6, -2.2),
      new Vector3(2.2, top + 2.6, -2.2),
      new Vector3(2.2, top + 2.6, 2.2),
      new Vector3(-2.2, top + 2.6, 2.2),
    ];
    for (let c = 0; c < 4; c++) {
      k.quad(frame, [eaves[(c + 1) % 4] as Vector3, eaves[c] as Vector3, apex, apex], C.hutRoof);
    }
    tmp.set(0, 0, 0).applyMatrix4(frame);
    this.zone(tmp.x, tmp.z, 1, 0, 6, 6);
  }

  /** The rocky knoll inside the Kestrel: a lone dead pine with a nest box, among boulders. */
  private addKnoll(): void {
    const s = this.track.sample(this.station(KNOLL_AT));
    const radius = 1 / Math.max(1e-4, Math.abs(s.curvature));
    const inside = s.curvature > 0 ? -1 : 1;
    const x = s.position.x + s.right.x * inside * radius;
    const z = s.position.z + s.right.z * inside * radius;
    const y = this.terrain.heightAt(x, z) - 0.2;
    const k = this.props;
    const frame = this.frameAt(x, y, z, 0.3, 1, new Matrix4());
    k.prism(frame, 0.45, 0.08, 18, 6, C.deadwood, { grime: true });
    const rng = mulberry32(hash32('knoll'));
    const at3 = (lx: number, ly: number, lz: number) => new Vector3(lx, ly, lz).applyMatrix4(frame);
    for (let b = 0; b < 7; b++) {
      const h = 6 + b * 1.6;
      const a = rng() * Math.PI * 2;
      const reach = 3.2 - b * 0.3;
      k.beam(
        at3(0, h, 0),
        at3(Math.cos(a) * reach, h + 1.2 + rng(), Math.sin(a) * reach),
        0.12,
        C.deadwood,
        m2,
      );
    }
    k.box(m2.makeTranslation(0.25, 9, 0).premultiply(frame), 0.35, 0.45, 0.35, C.timber);
    for (let r = 0; r < 9; r++) {
      const a = rng() * Math.PI * 2;
      const d = 3 + rng() * 9;
      const bx = Math.cos(a) * d;
      const bz = Math.sin(a) * d;
      const wx = x + bx;
      const wz = z + bz;
      m2.makeRotationY(rng() * 3).setPosition(wx, this.terrain.heightAt(wx, wz) - 0.4, wz);
      const size = 0.9 + rng() * 1.8;
      k.prism(m2, size, size * 0.55, size * 0.9, 5, C.rock, { cap: true });
    }
    this.zone(x, z, 1, 0, 20, 20);
  }

  /** Two flag poles beside the start gantry. */
  private addGantryFlags(): void {
    const i = this.station(0);
    const s = this.track.sample(i);
    for (const side of [-1, 1] as const) {
      const lateral = this.behindBarrier(i, side, 3.5);
      const base = this.ground(i - 6, lateral, new Vector3());
      this.props.prism(m2.makeTranslation(base.x, base.y, base.z), 0.07, 0.05, 8, 5, C.pole, {
        grime: true,
      });
      this.addFlag(base.setY(base.y + 4), 4, s.tangent.clone().multiplyScalar(-1), side + 3);
    }
  }

  /** A pole from `base` up `height` m with a 1.5 x 1 m flag at the top streaming along `along`. */
  private addFlag(base: Vector3, height: number, along: Vector3, variant: number): void {
    this.props.prism(m2.makeTranslation(base.x, base.y, base.z), 0.05, 0.04, height, 5, C.pole);
    const w = 1.5;
    const h = 1;
    const u0 = (variant % 4) * 0.25;
    const dir = along.clone().setY(0).normalize();
    const normal = new Vector3(-dir.z, 0, dir.x);
    const k = this.flags;
    const columns = 6;
    const ids: number[][] = [];
    for (let c = 0; c <= columns; c++) {
      const x = (c / columns) * w;
      ids.push(
        [0, 1].map((r) => {
          const y = base.y + height - 0.05 - (1 - r) * h;
          k.positions.push(base.x + dir.x * (x + 0.05), y, base.z + dir.z * (x + 0.05));
          k.normals.push(normal.x, normal.y, normal.z);
          k.uvs.push(u0 + (c / columns) * 0.25, r);
          k.colours.push(1, 1, 1);
          this.flagInfo.push(x, normal.x, normal.z, variant * 1.7);
          return k.positions.length / 3 - 1;
        }),
      );
    }
    for (let c = 0; c < columns; c++) {
      const [a, b] = ids[c] as [number, number];
      const [d, e] = ids[c + 1] as [number, number];
      k.indices.push(a, d, e, a, e, b);
    }
  }

  // ------------------------------------------------------------------------------------------

  private buildMeshes(): void {
    const add = (kit: MeshKit, material: Material, cast: boolean, receive = true) => {
      if (kit.triangles === 0) {
        material.dispose();
        return null;
      }
      const geometry = kit.build();
      this.geometries.push(geometry);
      this.materials.push(material);
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      this.group.add(mesh);
      return mesh;
    };
    add(this.props, new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), true);
    add(this.stands, new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), true);
    const crowdMap = crowdTexture();
    this.textures.push(crowdMap);
    add(this.crowd, new MeshStandardMaterial({ map: crowdMap, roughness: 0.95 }), false);
    add(
      this.signs,
      new MeshStandardMaterial({ map: this.atlas.texture, vertexColors: true, roughness: 0.75 }),
      true,
    );
    // Flags wave: offset along the flag's normal, growing towards the free end.
    const flagMap = flagTexture();
    this.textures.push(flagMap);
    const flags = add(
      this.flags,
      patchMaterial(new MeshStandardMaterial({ map: flagMap, roughness: 0.8, side: DoubleSide }), {
        key: 'sw-flag-v1',
        uniforms: { swTime: this.flagTime },
        vertexHead: `attribute vec4 flag;\nuniform float swTime;`,
        vertex: /* glsl */ `
          float swWave = 0.25 * (flag.x / 1.5) * sin(2.2 * swTime + 1.5 * flag.x + flag.w);
          transformed.xz += flag.yz * swWave;
          transformed.y -= 0.06 * flag.x * (0.5 + 0.5 * sin(1.3 * swTime + flag.w));`,
      }),
      false,
      false,
    );
    if (flags) {
      flags.geometry.setAttribute('flag', new Float32BufferAttribute(this.flagInfo, 4));
      const time = this.flagTime;
      flags.onBeforeRender = () => {
        time.value = performance.now() / 1000;
      };
    }
    const decal = add(
      this.decal,
      patchMaterial(
        new MeshStandardMaterial({
          vertexColors: true,
          roughness: 1,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -8,
        }),
        {
          key: 'sw-water-v1',
          vertexHead: `attribute float water;\nvarying float vWater;`,
          vertex: `vWater = water;`,
          fragmentHead: `varying float vWater;`,
          afterRoughness: `roughnessFactor = mix(roughnessFactor, 0.06, vWater);`,
        },
      ),
      false,
    );
    decal?.geometry.setAttribute('water', new Float32BufferAttribute(this.waterInfo, 1));
  }
}

const WHITE = new Color(1, 1, 1);
