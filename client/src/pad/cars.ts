/**
 * Car pictures for the phone and the TV lobby, without three.js: pre-rendered thumbnails (D-C7)
 * and a drawn side silhouette that stands in while a thumbnail loads or when it is missing.
 */
import type { CarId, ColourId } from '@gamergang/shared';

/** The pre-rendered picture of `car` in `colour`'s paint, served from `assets/cars/`. */
export function thumbUrl(car: CarId, colour: ColourId): string {
  return `/cars/${car}/thumb-${colour}.webp`;
}

/**
 * Thumbnails that failed to load in this page. A missing file is not asked for again on every
 * swipe, so the card shows the silhouette at once instead of flashing.
 */
export const failedThumbs = new Set<string>();

/**
 * Side-view proportions of each car in a 160 × 90 box, facing right, ground at y 70. Fractions
 * are of the body length, from the tail: cabin starts, roof starts, roof ends, windscreen base.
 * They only need to read as five different body shapes at a glance.
 */
interface Profile {
  length: number;
  roofY: number;
  deckY: number;
  hoodY: number;
  noseY: number;
  tailY: number;
  cabin: [number, number, number, number];
  wheel: number;
}

const PROFILES: Record<CarId, Profile> = {
  // Long bonnet, fastback cabin set back.
  nightjar: {
    length: 136,
    roofY: 31,
    deckY: 44,
    hoodY: 46,
    noseY: 51,
    tailY: 42,
    cabin: [0.16, 0.36, 0.55, 0.7],
    wheel: 11,
  },
  // Short and upright, big glasshouse.
  scree: {
    length: 118,
    roofY: 27,
    deckY: 42,
    hoodY: 45,
    noseY: 50,
    tailY: 39,
    cabin: [0.1, 0.25, 0.58, 0.73],
    wheel: 11,
  },
  // Long, flat and square-shouldered.
  haymaker: {
    length: 140,
    roofY: 31,
    deckY: 41,
    hoodY: 42,
    noseY: 46,
    tailY: 40,
    cabin: [0.24, 0.37, 0.55, 0.67],
    wheel: 11.5,
  },
  // Low, cabin pushed forward over a mid engine.
  zanna: {
    length: 138,
    roofY: 35,
    deckY: 44,
    hoodY: 51,
    noseY: 55,
    tailY: 43,
    cabin: [0.22, 0.42, 0.6, 0.78],
    wheel: 11,
  },
  // Very low wedge, one long curve of glass.
  sagitta: {
    length: 136,
    roofY: 38,
    deckY: 46,
    hoodY: 53,
    noseY: 57,
    tailY: 44,
    cabin: [0.18, 0.4, 0.62, 0.84],
    wheel: 11,
  },
};

const GROUND = 70;

export interface Silhouette {
  body: string;
  glass: string;
  wheels: readonly [number, number];
  wheelY: number;
  wheelR: number;
  /** Width of the car, for the ground shadow. */
  length: number;
}

const r = (n: number): string => n.toFixed(1);

/** SVG paths for one car's silhouette. */
export function silhouette(car: CarId): Silhouette {
  const p = PROFILES[car];
  const x0 = 80 - p.length / 2;
  const x1 = 80 + p.length / 2;
  const at = (f: number) => x0 + p.length * f;
  const [cr, rs, re, cf] = p.cabin.map(at) as [number, number, number, number];
  const R = p.wheel;
  const wheelY = GROUND - R;
  const sill = GROUND - R * 0.5;
  const rear = x0 + p.length * 0.19;
  const front = x1 - p.length * 0.18;
  const arch = R + 2.5;
  // Where the wheel arch circle meets the sill line.
  const half = Math.sqrt(arch * arch - (sill - wheelY) ** 2);
  const roofMid = (rs + re) / 2;
  const body = [
    `M${r(x0 + 4)} ${r(sill)}`,
    `L${r(x0 + 1)} ${r(p.tailY + 4)}`,
    `Q${r(x0)} ${r(p.tailY)} ${r(x0 + 6)} ${r(p.tailY)}`,
    `L${r(cr)} ${r(p.deckY)}`,
    `Q${r(rs)} ${r(p.roofY)} ${r(roofMid)} ${r(p.roofY)}`,
    `Q${r(re)} ${r(p.roofY)} ${r(cf)} ${r(p.hoodY)}`,
    `L${r(x1 - 7)} ${r(p.noseY)}`,
    `Q${r(x1)} ${r(p.noseY + 0.5)} ${r(x1)} ${r(p.noseY + 5)}`,
    `L${r(x1 - 2)} ${r(sill)}`,
    `L${r(front + half)} ${r(sill)}`,
    `A${r(arch)} ${r(arch)} 0 1 0 ${r(front - half)} ${r(sill)}`,
    `L${r(rear + half)} ${r(sill)}`,
    `A${r(arch)} ${r(arch)} 0 1 0 ${r(rear - half)} ${r(sill)}`,
    'Z',
  ].join(' ');
  const inset = 2.6;
  const glass = [
    `M${r(cr + 5)} ${r(p.deckY - 1)}`,
    `Q${r(rs + 1)} ${r(p.roofY + inset)} ${r(roofMid)} ${r(p.roofY + inset)}`,
    `Q${r(re - 1)} ${r(p.roofY + inset)} ${r(cf - 4)} ${r(p.hoodY - 1)}`,
    'Z',
  ].join(' ');
  return { body, glass, wheels: [rear, front], wheelY, wheelR: R, length: p.length };
}
