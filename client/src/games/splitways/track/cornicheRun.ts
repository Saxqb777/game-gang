import type { TrackDefinition } from './track';

/**
 * Corniche Run: Abu Dhabi coastal highway at golden hour. +X is east, +Z is south (the sea).
 * Start/finish sits on the long coastal straight heading east; a fast left sweeper climbs inland to
 * the hairpin, then the inland straight runs back west into the fast S and the city corners that
 * drop you back onto the seafront.
 */
export const CORNICHE_RUN: TrackDefinition = {
  id: 'corniche-run',
  name: 'Corniche Run',
  points: [
    // Coastal straight, heading east (start/finish here).
    [-112, 0.6, 141],
    [-19, 0.6, 141],
    [74, 0.6, 141],
    [140, 0.6, 138],
    // T1-T2: fast left sweeper climbing inland.
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
    // T5: right onto the inland straight.
    [164, 3, -65],
    [121, 2.6, -63],
    // Inland straight, heading west.
    [37, 2.4, -69],
    [-46, 2.2, -73],
    // T6-T8: the fast S.
    [-95, 2, -61],
    [-121, 1.8, -33],
    [-140, 1.5, -7],
    [-169, 1.2, 4],
    // T9-T10: city corners back down to the sea.
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
};
