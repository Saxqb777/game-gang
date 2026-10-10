/**
 * The static world around the race: track surfaces and barriers, the land, the scenery and the
 * start gantry. Loads the asphalt textures once for the track.
 */
import { Group, Mesh, type BufferGeometry, type MeshStandardMaterial } from 'three';
import type { QualityPreset } from '../render/quality';
import type { Terrain } from '../track/terrain';
import type { Track } from '../track/track';
import { Gantry } from './gantry';
import { Scenery } from './scenery';
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
  private readonly scenery: Scenery;
  /** The preset last applied with setQuality. */
  quality: QualityPreset | null = null;

  private constructor(
    track: Track,
    terrain: Terrain,
    private readonly textures: { asphalt: PbrSet },
    anisotropy: number,
  ) {
    this.trackVisual = createTrackVisual(track, textures, anisotropy);
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
    this.terrainGroup = createTerrainVisual(terrain, {
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
      this.gantry.group,
      this.scenery.group,
    );
  }

  static async create(track: Track, terrain: Terrain, anisotropy: number): Promise<WorldVisual> {
    const asphalt = await loadPbrSet('/textures/asphalt/asphalt_02', anisotropy);
    return new WorldVisual(track, terrain, { asphalt }, anisotropy);
  }

  /**
   * Applies a quality preset's world settings (pine density and pine shadows). The forest arrives
   * with Track 1's dressing; until then there is nothing to thin.
   */
  setQuality(preset: QualityPreset): void {
    this.quality = preset;
  }

  dispose(): void {
    this.trackVisual.dispose();
    // Every terrain chunk shares one material, so dispose it once.
    let material: MeshStandardMaterial | null = null;
    this.terrainGroup.traverse((object) => {
      if (object instanceof Mesh) {
        (object.geometry as BufferGeometry).dispose();
        material = object.material as MeshStandardMaterial;
      }
    });
    (material as MeshStandardMaterial | null)?.dispose();
    this.scenery.dispose();
    this.gantry.dispose();
    disposePbrSet(this.textures.asphalt);
    this.group.removeFromParent();
  }
}
