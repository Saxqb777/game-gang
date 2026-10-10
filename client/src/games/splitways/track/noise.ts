/**
 * Cheap deterministic 2D noise for terrain and ground colour. Node-safe and import-free, so track
 * generation, tests and scene code all share it.
 */

/** Pseudo-random 0..1 per integer lattice point. */
export function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth value noise in 0..1. */
export function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

/** Fractal value noise: `octaves` layers, each twice as fine and half as strong. Roughly 0..1. */
export function fbm(x: number, z: number, octaves: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise(x * frequency, z * frequency);
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return sum;
}
