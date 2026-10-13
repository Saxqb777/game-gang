/**
 * The Split Ways car line-up: ids, picker order and the catalogue the phone's car card shows.
 * All makes and models are invented. Attribution of the source models lives in `carCredits.ts`.
 */
import { z } from 'zod';

/** Picker order; the first is the default car. */
export const CAR_IDS = ['nightjar', 'scree', 'haymaker', 'zanna', 'sagitta'] as const;
export type CarId = (typeof CAR_IDS)[number];
export const carIdSchema = z.enum(CAR_IDS);
export const DEFAULT_CAR_ID: CarId = 'nightjar';
/** Cars for TV keyboard players and bots, by local player index (D-C10). */
export const LOCAL_CAR_ORDER: readonly CarId[] = ['nightjar', 'scree', 'haymaker', 'zanna'];

export interface CarStats {
  /** 1..10, relative within this line-up (all cars have equal lap times). */
  speed: number;
  acceleration: number;
  handling: number;
  braking: number;
  /** How forgiving the car is at the limit. */
  ease: number;
}

export interface CarInfo {
  /** Invented make, e.g. "Dashwood". */
  make: string;
  /** Invented model, e.g. "Nightjar". */
  model: string;
  /** Body style, e.g. "GT coupe". */
  body: string;
  drive: 'RWD' | 'AWD';
  /** The make's tagline. */
  tagline: string;
  stats: CarStats;
}

export const CAR_INFO: Record<CarId, CarInfo> = {
  nightjar: {
    make: 'Dashwood',
    model: 'Nightjar',
    body: 'GT coupe',
    drive: 'RWD',
    tagline: 'Arrive before breakfast.',
    stats: { speed: 6, acceleration: 6, handling: 6, braking: 6, ease: 9 },
  },
  scree: {
    make: 'Mudlark',
    model: 'Scree',
    body: 'Rally coupe',
    drive: 'AWD',
    tagline: 'Clean cars are slow cars.',
    stats: { speed: 4, acceleration: 7, handling: 9, braking: 6, ease: 8 },
  },
  haymaker: {
    make: 'Brazen',
    model: 'Haymaker',
    body: 'Muscle restomod',
    drive: 'RWD',
    tagline: 'Subtle is for other people.',
    stats: { speed: 9, acceleration: 7, handling: 4, braking: 5, ease: 5 },
  },
  zanna: {
    make: 'Briganti',
    model: 'Zanna',
    body: 'Supercar',
    drive: 'RWD',
    tagline: 'Steal the show.',
    stats: { speed: 8, acceleration: 8, handling: 6, braking: 7, ease: 4 },
  },
  sagitta: {
    make: 'Arvanta',
    model: 'Sagitta',
    body: 'Electric hypercar concept',
    drive: 'AWD',
    tagline: 'The future, pending update.',
    stats: { speed: 5, acceleration: 9, handling: 7, braking: 7, ease: 6 },
  },
};

/** "Dashwood Nightjar" */
export function carName(id: CarId): string {
  const info = CAR_INFO[id];
  return `${info.make} ${info.model}`;
}
