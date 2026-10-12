/**
 * The track seam: game code, tests and the results screen get Track 1 from here. The track data is
 * content with its own licence fields, so the game always fetches it at runtime and never bundles
 * it (tests import the JSON directly and call `buildTrack`).
 */
import type { TrackId } from '@gamergang/shared';
import { generateTrack } from './gen/generate';
import { trackLayoutSchema, trackOverridesSchema } from './gen/layout';
import { Track } from './track';

/** The one track M8 ships. Its files live in `assets/tracks/kestrel-pines/`. */
export const TRACK_1 = {
  id: 'kestrel-pines',
  name: 'Kestrel Pines',
  url: '/tracks/kestrel-pines/', // base.layout.json, overrides.json
} as const satisfies { id: TrackId; name: string; url: string };

/** Node-safe: validates both JSON values with zod and returns the Track. */
export function buildTrack(base: unknown, overrides: unknown): Track {
  return new Track(
    generateTrack(trackLayoutSchema.parse(base), trackOverridesSchema.parse(overrides)),
  );
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return response.json() as Promise<unknown>;
}

/** Browser: fetches both JSON files under TRACK_1.url, then builds the track. */
export async function loadTrack1(): Promise<Track> {
  const [base, overrides] = await Promise.all([
    fetchJson(`${TRACK_1.url}base.layout.json`),
    fetchJson(`${TRACK_1.url}overrides.json`),
  ]);
  return buildTrack(base, overrides);
}
