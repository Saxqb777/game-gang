/**
 * The static world around the race: track surfaces and barriers, the land, the sea and the start
 * gantry. Loads its textures once and shares them between the track and the terrain.
 */
import { Group, Mesh, type MeshStandardMaterial, type PlaneGeometry } from 'three';
import type { Terrain } from '../track/terrain';
import type { Track } from '../track/track';
import { Gantry } from './gantry';
import { Scenery } from './scenery';
import { Sea } from './sea';
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
  private readonly sea = new Sea();
  private readonly scenery: Scenery;

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
    this.gantry = new Gantry(track);
    this.scenery = new Scenery(track, terrain);
    this.group.add(
      this.trackVisual.group,
      this.terrainGroup,
      this.sea.mesh,
      this.gantry.group,
      this.scenery.group,
    );
  }

  static async create(track: Track, terrain: Terrain, anisotropy: number): Promise<WorldVisual> {
    const [asphalt, sand] = await Promise.all([
      loadPbrSet('/textures/asphalt/asphalt_02', anisotropy),
      loadPbrSet('/textures/sand/sand_01', anisotropy),
    ]);
    return new WorldVisual(track, terrain, { asphalt, sand }, anisotropy);
  }

  /** Animates the water. */
  update(dt: number): void {
    this.sea.update(dt);
  }

  dispose(): void {
    this.trackVisual.dispose();
    this.terrainGroup.traverse((object) => {
      if (object instanceof Mesh) {
        (object.geometry as PlaneGeometry).dispose();
        (object.material as MeshStandardMaterial).dispose();
      }
    });
    this.sea.dispose();
    this.scenery.dispose();
    this.gantry.dispose();
    disposePbrSet(this.textures.asphalt);
    disposePbrSet(this.textures.sand);
    this.group.removeFromParent();
  }
}
