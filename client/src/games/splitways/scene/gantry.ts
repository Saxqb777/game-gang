import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Track } from '../track/track';
import { MeshKit } from './sceneryModels';
import { canvasTexture } from './textures';

/** Beam height above the road centre (m), and how far each leg stands outside its wall (m). */
const HEIGHT = 7.2;
const LEG_OUTSIDE = 1.6;
/** Start lights: pairs of lamps (two rows) over the road, and how bright a lit lamp glows (HDR). */
const PAIRS = 5;
const LIT_RED = new Color(8, 0.35, 0.25);
const LIT_GREEN = new Color(0.4, 6, 1.2);
const OFF = new Color(0.03, 0.03, 0.03);
const STEEL = new Color('#2b2e31');
/** The sign board across the beam: width and height (m). */
const SIGN = { width: 15, height: 1.9 };

/**
 * Start/finish gantry spanning the walls over the line: a dark steel beam on two legs, a black
 * name board with the track name, the timing sponsor's clock and the Gamer Gang mark, and five
 * pairs of start lights: red pairs come on through the countdown, then all turn green.
 */
export class Gantry {
  readonly group = new Group();
  private readonly lamps: InstancedMesh;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private lit = -1;
  private green = false;

  constructor(track: Track) {
    const start = track.startLine.sample;
    const index = track.indexAt(track.startLine.distance);
    const kit = new MeshKit();
    const right = start.right;
    // Frame: x across the road to the right, z against the direction of travel (the sign faces
    // the oncoming cars along +z), origin on the centre line.
    const frame = new Matrix4()
      .makeBasis(right, new Vector3(0, 1, 0), new Vector3().copy(start.tangent).negate())
      .setPosition(start.position);
    const at = (x: number, y: number, z: number) => new Vector3(x, y, z).applyMatrix4(frame);
    const m = new Matrix4();
    const legs = [-1, 1].map(
      (side) => side * (track.side(index, side as -1 | 1).wall + LEG_OUTSIDE),
    );
    const [left, rightLeg] = legs as [number, number];
    for (const x of legs) {
      // Each leg stands on the corridor surface beside its wall.
      const foot = track.lateralPoint(index, x, new Vector3());
      m.makeTranslation(x, foot.y - start.position.y - 0.1, 0).premultiply(frame);
      kit.box(m, 0.9, HEIGHT + 1.2 - (foot.y - start.position.y), 0.9, STEEL, { grime: true });
    }
    // A box-truss beam: top and bottom chords with a web between them.
    const span = rightLeg - left;
    for (const [y, z] of [
      [HEIGHT - 0.8, 0.45],
      [HEIGHT - 0.8, -0.45],
      [HEIGHT + 0.8, 0.45],
      [HEIGHT + 0.8, -0.45],
    ] as const) {
      kit.beam(at(left, y, z), at(rightLeg, y, z), 0.22, STEEL, m);
    }
    const bays = Math.round(span / 2.5);
    for (let b = 0; b < bays; b++) {
      const x0 = left + (b * span) / bays;
      const x1 = left + ((b + 1) * span) / bays;
      for (const z of [0.45, -0.45]) {
        kit.beam(at(x0, HEIGHT - 0.8, z), at(x1, HEIGHT + 0.8, z), 0.1, STEEL, m);
        kit.beam(at(x0, HEIGHT - 0.8, z), at(x0, HEIGHT + 0.8, z), 0.1, STEEL, m);
      }
    }
    // Lamp housing over the road centre.
    m.makeTranslation(0, HEIGHT - 2.5, 0.1).premultiply(frame);
    kit.box(m, PAIRS * 0.9 + 0.6, 1.7, 0.5, new Color('#121314'));
    const structure = new Mesh(
      kit.build(),
      this.material(
        new MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.45 }),
      ),
    );
    this.geometries.push(structure.geometry);
    structure.castShadow = true;
    structure.receiveShadow = true;
    this.group.add(structure);

    // The sign: track name on black, the timing clock and the Gamer Gang mark (solid, once).
    const name = track.definition.name.toUpperCase();
    const sign = canvasTexture(2048, 256, (ctx) => {
      ctx.fillStyle = '#0f1011';
      ctx.fillRect(0, 0, 2048, 256);
      ctx.fillStyle = '#1f3b2d';
      ctx.fillRect(0, 0, 360, 256);
      ctx.save();
      ctx.scale(0.82, 1);
      const font =
        '"Barlow Condensed", "Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif';
      ctx.font = `700 64px ${font}`;
      ctx.fillStyle = '#efe9dc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAMER', 180 / 0.82, 100, 300 / 0.82);
      ctx.fillText('GANG', 180 / 0.82, 164, 300 / 0.82);
      ctx.font = `700 150px ${font}`;
      ctx.fillText(name, 1100 / 0.82, 134, 1180 / 0.82);
      ctx.font = `700 54px ${font}`;
      ctx.fillStyle = '#c9cccf';
      ctx.fillText('VAELTO', 1880 / 0.82, 92, 260 / 0.82);
      ctx.font = `700 70px ${font}`;
      ctx.fillStyle = '#e8601c';
      ctx.fillText('00:00.0', 1880 / 0.82, 170, 300 / 0.82);
      ctx.restore();
      // The kestrel-wing chevron before the name.
      ctx.fillStyle = '#b5562c';
      ctx.beginPath();
      ctx.moveTo(430, 96);
      ctx.lineTo(480, 136);
      ctx.lineTo(530, 96);
      ctx.lineTo(530, 116);
      ctx.lineTo(480, 160);
      ctx.lineTo(430, 116);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a2c2e';
      ctx.fillRect(1740, 30, 4, 196);
    });
    const signMaterial = this.material(
      new MeshStandardMaterial({
        map: sign,
        emissive: 0xffffff,
        emissiveMap: sign,
        emissiveIntensity: 0.35,
        roughness: 0.6,
      }),
    );
    const plane = new PlaneGeometry(SIGN.width, SIGN.height);
    this.geometries.push(plane);
    for (const facing of [1, -1]) {
      const panel = new Mesh(plane, signMaterial);
      // Facing the oncoming cars (+z of the frame) and, on the back, the cars leaving.
      m.makeRotationY(facing > 0 ? 0 : Math.PI)
        .setPosition(0, HEIGHT, facing * 0.62)
        .premultiply(frame);
      m.decompose(panel.position, panel.quaternion, panel.scale);
      this.group.add(panel);
    }

    // Lamps: one instance each, two rows of PAIRS, glowing through their instance colour.
    const lens = new PlaneGeometry(0.42, 0.42);
    this.geometries.push(lens);
    this.lamps = new InstancedMesh(lens, this.material(new MeshBasicMaterial()), PAIRS * 2);
    for (let p = 0; p < PAIRS; p++) {
      for (let row = 0; row < 2; row++) {
        m.makeTranslation(
          (p - (PAIRS - 1) / 2) * 0.9,
          HEIGHT - 2.05 - row * 0.75,
          0.36,
        ).premultiply(frame);
        this.lamps.setMatrixAt(p * 2 + row, m);
        this.lamps.setColorAt(p * 2 + row, OFF);
      }
    }
    // A handful of lamps under one fixed gantry: the sphere from the matrices never changes.
    this.lamps.computeBoundingSphere();
    this.group.add(this.lamps);
  }

  /** `lit` red steps of the countdown (0..3) over five pairs, or every pair green once the race is on. */
  setLights(lit: number, green: boolean): void {
    if (lit === this.lit && green === this.green) return;
    this.lit = lit;
    this.green = green;
    const pairs = green ? PAIRS : Math.round((Math.max(0, Math.min(3, lit)) * PAIRS) / 3);
    for (let p = 0; p < PAIRS; p++) {
      const colour = green ? LIT_GREEN : p < pairs ? LIT_RED : OFF;
      for (let row = 0; row < 2; row++) this.lamps.setColorAt(p * 2 + row, colour);
    }
    if (this.lamps.instanceColor) this.lamps.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) {
      if (material instanceof MeshStandardMaterial) material.map?.dispose();
      material.dispose();
    }
    this.lamps.dispose();
    this.group.removeFromParent();
  }

  private material<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }
}
