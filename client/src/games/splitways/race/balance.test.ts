/**
 * Balance (spec §5.6): each car alone on grid slot 0 of Kestrel Pines, two laps on the debug
 * autopilot at its own speed profile. All five must finish both laps without a respawn, and the
 * flying laps (lap 2) must be within 1.5% of each other (tuning target 1.0%).
 */
import { CAR_IDS, type CarId } from '@gamergang/shared';
import { describe, expect, it } from 'vitest';
import base from '../../../../../assets/tracks/kestrel-pines/base.layout.json';
import overrides from '../../../../../assets/tracks/kestrel-pines/overrides.json';
import { resolveCarSpec } from '../sim/carSpec';
import { buildTrack } from '../track/tracks';
import { runBalance, type BalanceRun } from './balance';

const kestrelPines = buildTrack(base, overrides);
/** Pass line; the tuning target is 1.0%. */
const MAX_SPREAD = 0.015;

describe('balance (Kestrel Pines)', () => {
  // About 6 s of Node time per car (two laps of physics), run one after the other.
  it('gives every car a flying lap within 1.5% of the fastest', async () => {
    const runs = new Map<CarId, BalanceRun>();
    for (const id of CAR_IDS) {
      const run = await runBalance(kestrelPines, resolveCarSpec(id));
      runs.set(id, run);
      console.info('[balance]', id, run.lap1Ms, run.lap2Ms, Math.round(run.topKph));
    }
    const flying: number[] = [];
    for (const [id, run] of runs) {
      expect(run.lap1Ms, `${id} lap 1`).not.toBeNull();
      expect(run.lap2Ms, `${id} lap 2`).not.toBeNull();
      expect(run.respawns, `${id} respawns`).toBe(0);
      flying.push(run.lap2Ms ?? Infinity);
    }
    const fastest = Math.min(...flying);
    const slowest = Math.max(...flying);
    const spread = (slowest - fastest) / fastest;
    console.info('[balance] spread', `${(spread * 100).toFixed(2)}%`);
    expect(spread).toBeLessThanOrEqual(MAX_SPREAD);
  }, 120_000);
});
