/**
 * Ground surfaces and trackside barriers. The ids are small integers so per-station, per-triangle
 * and per-wheel arrays can store them in a Uint8Array. Node-safe.
 */

export const SURFACE = { asphalt: 0, kerb: 1, grass: 2, gravel: 3 } as const;
export type SurfaceName = keyof typeof SURFACE;
export type SurfaceId = (typeof SURFACE)[SurfaceName];
/** Index = SurfaceId. */
export const SURFACE_NAMES: readonly SurfaceName[] = ['asphalt', 'kerb', 'grass', 'gravel'];

/** Visible barrier along the wall line; `none` still has an invisible collision wall.
 *  `fence` is a catch fence (Kestrel Pines: right side of the start straights); visuals treat it
 *  like `wall`. */
export const BARRIER = { none: 0, armco: 1, tyres: 2, wall: 3, fence: 4 } as const;
export type BarrierName = keyof typeof BARRIER;
export type BarrierId = (typeof BARRIER)[BarrierName];
/** Index = BarrierId. */
export const BARRIER_NAMES: readonly BarrierName[] = ['none', 'armco', 'tyres', 'wall', 'fence'];
