import type { BenchMode } from '../game';

export interface BenchFlags {
  /** `?bench=auto|matrix` runs the fly-through after loading, `?bench=soak` the 30-minute soak. */
  bench: BenchMode | null;
  /** `?bots=1`: K also adds two driverless bots, for 4-viewport tests with one keyboard. */
  bots: boolean;
  /** `?light=1` forces light mode, `?light=0` forces normal mode and forgets a remembered light. */
  light: boolean | null;
}

const MODES: readonly BenchMode[] = ['auto', 'matrix', 'soak'];

export function readBenchFlags(search: string): BenchFlags {
  const params = new URLSearchParams(search);
  const bench = params.get('bench');
  return {
    bench: MODES.find((mode) => mode === bench) ?? null,
    bots: params.get('bots') === '1',
    light: params.get('light') === '1' ? true : params.get('light') === '0' ? false : null,
  };
}
