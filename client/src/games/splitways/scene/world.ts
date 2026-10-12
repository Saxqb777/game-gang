/**
 * The static world around the race: the corridor (road, kerbs, run-off, barriers), the land, the
 * forest and its treeline ring, the trackside scenery and the start gantry, plus a neutral sky and
 * ground fill light. Loads the four CC0 texture sets once.
 */
import { Color, Group, HemisphereLight, type Euler, type Texture } from 'three';
import { LIGHTING } from '../config';
import type { QualityPreset } from '../render/quality';
import { placeTrackside } from '../track/gen/placement';
import type { Terrain } from '../track/terrain';
import type { Track } from '../track/track';
import { Forest } from './forest';
import { Gantry } from './gantry';
import { Scenery } from './scenery';
import { createTerrainVisual, type TerrainVisual } from './terrainVisual';
import { disposePbrSet, loadPbrSet, type PbrSet } from './textures';
import { createTrackVisual, type TrackVisual } from './trackVisual';

interface WorldTextures {
  asphalt: PbrSet;
  grass: PbrSet;
  gravel: PbrSet;
  forest: PbrSet;
}

export interface WorldStats {
  corridorChunks: number;
  corridorMeshes: number;
  terrainChunks: number;
  pineTiles: number;
  pines: number;
  pinesDrawn: number;
  sceneryMeshes: number;
  sceneryTriangles: number;
}

export class WorldVisual {
  readonly group = new Group();
  readonly gantry: Gantry;
  private readonly trackVisual: TrackVisual;
  private readonly terrainVisual: TerrainVisual;
  private readonly forest: Forest;
  private readonly scenery: Scenery;

  private constructor(
    track: Track,
    terrain: Terrain,
    private readonly textures: WorldTextures,
    preset: QualityPreset,
  ) {
    this.trackVisual = createTrackVisual(track, textures, preset.anisotropy);
    this.terrainVisual = createTerrainVisual(terrain, textures);
    this.gantry = new Gantry(track);
    const placements = placeTrackside(track, terrain);
    this.scenery = new Scenery(track, terrain, placements, preset.anisotropy);
    this.forest = new Forest(track, terrain, placements, (x, z) => this.scenery.blocked(x, z));
    // A neutral fill so shadows keep detail instead of turning sky-blue (changes programs, so it
    // is in the scene before the loading screen compiles them).
    const { sky, ground, intensity } = LIGHTING.hemisphere;
    const fill = new HemisphereLight(new Color(sky), new Color(ground), intensity);
    this.group.add(
      this.trackVisual.group,
      this.terrainVisual.group,
      this.forest.group,
      this.scenery.group,
      this.gantry.group,
      fill,
    );
    this.setQuality(preset);
  }

  static async create(track: Track, terrain: Terrain, preset: QualityPreset): Promise<WorldVisual> {
    const anisotropy = preset.anisotropy;
    const [asphalt, grass, gravel, forest] = await Promise.all([
      loadPbrSet('/textures/asphalt/asphalt_track', anisotropy),
      loadPbrSet('/textures/grass/grass004', anisotropy),
      loadPbrSet('/textures/gravel/gravel022', anisotropy),
      loadPbrSet('/textures/forest/forest_leaves_04', anisotropy),
    ]);
    return new WorldVisual(track, terrain, { asphalt, grass, gravel, forest }, preset);
  }

  /** What the world is made of, for profiling. */
  get stats(): WorldStats {
    return {
      corridorChunks: this.trackVisual.stats.chunks,
      corridorMeshes: this.trackVisual.stats.meshes,
      terrainChunks: this.terrainVisual.stats.chunks,
      pineTiles: this.forest.stats.tiles,
      pines: this.forest.stats.pines,
      pinesDrawn: this.forest.stats.drawn,
      sceneryMeshes: this.scenery.stats.meshes,
      sceneryTriangles: this.scenery.stats.triangles,
    };
  }

  /**
   * A preset's world settings: the share of pines drawn (from each tile's pre-ordered instances)
   * and whether they cast shadows. Never rebuilds geometry.
   */
  setQuality(preset: QualityPreset): void {
    this.forest.setDensity(preset.vegetationDensity, preset.pineShadows);
  }

  /** The sky's pre-filtered environment: the forest catches sky light through its own copy. */
  setEnvironment(environment: Texture, rotation: Euler): void {
    this.forest.setEnvironment(environment, rotation);
  }

  dispose(): void {
    this.trackVisual.dispose();
    this.terrainVisual.dispose();
    this.forest.dispose();
    this.scenery.dispose();
    this.gantry.dispose();
    for (const set of Object.values<PbrSet>({ ...this.textures })) disposePbrSet(set);
    this.group.removeFromParent();
  }
}
