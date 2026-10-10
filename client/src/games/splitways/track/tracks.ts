/**
 * The track seam: game code, tests and the results screen get Track 1 from here, so swapping the
 * interim loop for generated data touches nothing else.
 */
import type { TrackId } from '@gamergang/shared';
import { Track } from './track';

/** The one track M8 ships. P2 replaces the interim loop below with generated Kestrel Pines data. */
export const TRACK_1 = { id: 'kestrel-pines', name: 'Kestrel Pines' } as const satisfies {
  id: TrackId;
  name: string;
};

/**
 * Interim test loop (the M3 control points) until trackgen lands: a long start straight, a fast
 * left sweeper up to a hairpin, a back straight, a fast S and two slower corners home.
 */
export function createPlaceholderTrack(): Track {
  return new Track({
    ...TRACK_1,
    points: [
      // Start/finish straight.
      [-112, 0.6, 141],
      [-19, 0.6, 141],
      [74, 0.6, 141],
      [140, 0.6, 138],
      // T1-T2: fast left sweeper, climbing.
      [182, 1, 119],
      [205, 1.6, 86],
      [210, 2.4, 45],
      // T3: kink right.
      [205, 3, 7],
      [216, 3.4, -30],
      // T4: the hairpin.
      [234, 3.6, -65],
      [236, 3.6, -93],
      [219, 3.6, -110],
      [197, 3.6, -102],
      [184, 3.4, -82],
      // T5: right onto the back straight.
      [164, 3, -65],
      [121, 2.6, -63],
      // Back straight.
      [37, 2.4, -69],
      [-46, 2.2, -73],
      // T6-T8: the fast S.
      [-95, 2, -61],
      [-121, 1.8, -33],
      [-140, 1.5, -7],
      [-169, 1.2, 4],
      // T9-T10: two slower corners, dropping back to the start straight.
      [-199, 1, 26],
      [-203, 0.8, 69],
      [-192, 0.7, 108],
      [-164, 0.6, 136],
    ],
    roadWidth: 14,
    shoulderWidth: 3.5,
    checkpointCount: 8,
    startDistance: 60,
    laps: 3,
  });
}

// Not `async`: an async function without `await` fails @typescript-eslint/require-await.
export function loadTrack1(): Promise<Track> {
  return Promise.resolve(createPlaceholderTrack());
}
