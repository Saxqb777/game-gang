/**
 * Height of the land around a track: flat under the road, then rolling forest floor that grows
 * into low hills further from the circuit. Node-safe; the terrain mesh and the scenery placement
 * both use it.
 */
import { MathUtils } from 'three';
import { fbm } from './noise';
import type { Track } from './track';
import { TrackProximity } from './trackGeometry';

export interface RoadProximity {
  /** Distance to the centre line (m), capped at the search reach. */
  distance: number;
  /** Road height at the nearest point. */
  roadY: number;
  /**
   * True inside the loop (the track runs anticlockwise, so the infield is on the driver's left).
   * Only a hint for scenery placement; it does not change the height.
   */
  infield: boolean;
}

export class Terrain {
  private readonly proximity: TrackProximity;

  constructor(readonly track: Track) {
    this.proximity = new TrackProximity(track);
  }

  /** Where a point sits relative to the road. Points beyond `reach` count as outside the loop. */
  nearRoad(x: number, z: number, reach = 160): RoadProximity {
    const nearest = this.proximity.nearest(x, z, reach);
    if (nearest.index < 0) return { distance: reach, roadY: 0, infield: false };
    const sample = this.track.sample(nearest.index);
    const lateral =
      (x - sample.position.x) * sample.right.x + (z - sample.position.z) * sample.right.z;
    return {
      distance: Math.min(nearest.distance, reach),
      roadY: sample.position.y,
      infield: lateral < 0,
    };
  }

  heightAt(x: number, z: number): number {
    const { distance, roadY } = this.nearRoad(x, z);
    const edge = this.track.halfDrivable + 1.4;
    const underRoad = roadY - 0.15;
    if (distance <= edge) return underRoad;
    // Gentle forest floor near the circuit, rising into low hills further out.
    const growth = MathUtils.smoothstep(distance, edge + 10, edge + 160);
    const natural = 0.3 + growth * fbm(x * 0.006, z * 0.006, 4) * 10;
    const blend = MathUtils.smoothstep(distance, edge, edge + 26);
    return MathUtils.lerp(underRoad, natural, blend);
  }
}
