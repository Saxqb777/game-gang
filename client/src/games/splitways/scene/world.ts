/**
 * The static world around the race: track surfaces and barriers, the land, the sea and the start
 * gantry. Loads its textures once and shares them between the track and the terrain.
 */
import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { SEA_LEVEL, type Terrain } from '../track/terrain';
import type { Track } from '../track/track';
import { Gantry } from './gantry';
import { createTerrainVisual } from './terrainVisual';
import { disposePbrSet, loadPbrSet, type PbrSet } from './textures';
import { createTrackVisual, type TrackVisual } from './trackVisual';

/** How far the land reaches beyond the track in every direction (m). */
const LAND_MARGIN = 380;

export class WorldVisual {
  readonly group = new Group();
  readonly gantry: Gantry;
  private readonly trackVisual: TrackVisual;
  private readonly terrainGroup: Group;
  private readonly sea: Mesh<PlaneGeometry, MeshStandardMaterial>;

  private constructor(
    track: Track,
    terrain: Terrain,
    private readonly textures: { asphalt: PbrSet; sand: PbrSet },
    anisotropy: number,
  ) {
    this.trackVisual = createTrackVisual(track, terrain, textures, anisotropy);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const s of track.samples) {
      minX = Math.min(minX, s.position.x);
      maxX = Math.max(maxX, s.position.x);
      minZ = Math.min(minZ, s.position.z);
      maxZ = Math.max(maxZ, s.position.z);
    }
    this.terrainGroup = createTerrainVisual(terrain, textures.sand, {
      minX: minX - LAND_MARGIN,
      maxX: maxX + LAND_MARGIN,
      minZ: minZ - LAND_MARGIN,
      maxZ: maxZ + LAND_MARGIN,
    });
    this.sea = new Mesh(
      new PlaneGeometry(9000, 9000),
      new MeshStandardMaterial({ color: 0x0f5a6e, roughness: 0.08, metalness: 0 }),
    );
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.position.y = SEA_LEVEL;
    this.sea.receiveShadow = true;
    this.gantry = new Gantry(track);
    this.group.add(this.trackVisual.group, this.terrainGroup, this.sea, this.gantry.group);
  }

  static async create(track: Track, terrain: Terrain, anisotropy: number): Promise<WorldVisual> {
    const [asphalt, sand] = await Promise.all([
      loadPbrSet('/textures/asphalt/asphalt_02', anisotropy),
      loadPbrSet('/textures/sand/sand_01', anisotropy),
    ]);
    return new WorldVisual(track, terrain, { asphalt, sand }, anisotropy);
  }

  dispose(): void {
    this.trackVisual.dispose();
    this.terrainGroup.traverse((object) => {
      if (object instanceof Mesh) {
        (object.geometry as PlaneGeometry).dispose();
        (object.material as MeshStandardMaterial).dispose();
      }
    });
    this.sea.geometry.dispose();
    this.sea.material.dispose();
    this.gantry.dispose();
    disposePbrSet(this.textures.asphalt);
    disposePbrSet(this.textures.sand);
    this.group.removeFromParent();
  }
}
