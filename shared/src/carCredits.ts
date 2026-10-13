/**
 * Attribution for the source models the cars are built from (D-C8). This is the one code file
 * that names the original titles and authors; the credits screen, the /credits page, the phone's
 * car card and the docs all take their wording from here.
 */
import type { CarId } from './cars';

export interface CarCredit {
  /** The source model's title, verbatim. */
  title: string;
  /** As the author presents themselves, e.g. "MMC Works (mmcworks)". */
  author: string;
  sourceUrl: string;
  licence: 'CC BY 4.0' | 'CC0 1.0';
  licenceUrl: string;
  /** What we changed (CC BY asks us to say so). */
  modified: string;
}

const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const MODIFIED = 'Renamed, reshaped, debranded, re-materialed, reduced to three levels of detail.';

export const CAR_CREDITS: Record<CarId, CarCredit> = {
  nightjar: {
    title: 'Generic Sport Coupé Car',
    author: 'MMC Works (mmcworks)',
    sourceUrl:
      'https://sketchfab.com/3d-models/generic-sport-coupe-car-820a13c4831c41959ce75e6c2014e882',
    licence: 'CC BY 4.0',
    licenceUrl: CC_BY,
    modified: MODIFIED,
  },
  scree: {
    title: 'Ariel_350-V2',
    author: 'orcha (gandoplyas)',
    sourceUrl: 'https://sketchfab.com/3d-models/ariel-350-v2-7a9a44bcf152405792424408bb573482',
    licence: 'CC BY 4.0',
    licenceUrl: CC_BY,
    modified: MODIFIED,
  },
  haymaker: {
    title: 'Muscle Car Concept',
    author: 'ViktorKom',
    sourceUrl:
      'https://sketchfab.com/3d-models/muscle-car-concept-aa5dbdc7d492478ababfd4d385b8339f',
    licence: 'CC BY 4.0',
    licenceUrl: CC_BY,
    modified:
      'Renamed, reshaped, debranded, re-materialed, reduced to three levels of detail, hidden parts removed.',
  },
  zanna: {
    title: 'Fictional supercar - V12 Goblin',
    author: 'Olli Teittinen (ollitei)',
    sourceUrl:
      'https://sketchfab.com/3d-models/fictional-supercar-v12-goblin-0a20e49ad5774d778567cb5c3f345786',
    licence: 'CC BY 4.0',
    licenceUrl: CC_BY,
    modified: MODIFIED,
  },
  sagitta: {
    // The upload is labelled CC0 and dedicated to the public domain; credited as a courtesy (R-C3).
    title: 'FREE Concept Car 039 - public domain (CC0)',
    author: 'unityfan777 (Unity Fan YouTube channel)',
    sourceUrl:
      'https://sketchfab.com/3d-models/free-concept-car-039-public-domain-cc0-f17b9d37e0e34f15b4c2e417a98f5ed6',
    licence: 'CC0 1.0',
    licenceUrl: CC0,
    modified: MODIFIED,
  },
};

/** One line for small print: "Based on "<title>" by <author>, <licence>, modified." */
export function creditLine(id: CarId): string {
  const credit = CAR_CREDITS[id];
  return `Based on "${credit.title}" by ${credit.author}, ${credit.licence}, modified.`;
}
