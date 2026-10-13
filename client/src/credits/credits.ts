/**
 * Credits for everything that is not a car: the track, textures and sky, font, sound and the
 * libraries the game is built on. Mirrors `assets/ASSETS.md` (credits.test.ts checks that it
 * agrees). Car credits live in `shared/src/carCredits.ts` (D-C8) so the phone can show them too.
 */

export interface Credit {
  /** What it is in the game, e.g. "Asphalt Track". */
  name: string;
  /** Who made it, as they present themselves. */
  author: string;
  /** Where it came from (shop, library, site). */
  source: string;
  url?: string;
  licence: string;
  licenceUrl?: string;
  /** What it is used for, or how it was changed. */
  note?: string;
}

export interface CreditSection {
  title: string;
  credits: readonly Credit[];
}

const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';

/** Must match `credits` and `licence` in `assets/tracks/kestrel-pines/*.json` (tested). */
export const TRACK_CREDIT = 'Original layout by the Gamer Gang project, 2026';
export const TRACK_LICENCE = 'Proprietary - (C) 2026 Gamer Gang project. All rights reserved.';

export const CREDIT_SECTIONS: readonly CreditSection[] = [
  {
    title: 'Track',
    credits: [
      {
        name: 'Kestrel Pines',
        author: 'Gamer Gang project',
        source: TRACK_CREDIT,
        licence: '(C) 2026 Gamer Gang project',
        note: 'An original layout, not derived from any existing circuit.',
      },
    ],
  },
  {
    title: 'Textures and sky',
    credits: [
      {
        name: 'Asphalt Track',
        author: 'Dimitrios Savva',
        source: 'Poly Haven',
        url: 'https://polyhaven.com/a/asphalt_track',
        licence: 'CC0',
        licenceUrl: CC0,
        note: 'Track asphalt and paved aprons.',
      },
      {
        name: 'Forest Leaves 04',
        author: 'Rob Tuytel',
        source: 'Poly Haven',
        url: 'https://polyhaven.com/a/forest_leaves_04',
        licence: 'CC0',
        licenceUrl: CC0,
        note: 'Forest floor.',
      },
      {
        name: 'Syferfontein 18d Clear (Pure Sky)',
        author: 'Greg Zaal (photo) and Jarod Guest (sky edits)',
        source: 'Poly Haven',
        url: 'https://polyhaven.com/a/syferfontein_18d_clear_puresky',
        licence: 'CC0',
        licenceUrl: CC0,
        note: 'Sky and lighting.',
      },
      {
        name: 'Grass 004',
        author: 'ambientCG',
        source: 'ambientCG',
        url: 'https://ambientcg.com/view?id=Grass004',
        licence: 'CC0',
        licenceUrl: CC0,
        note: 'Grass run-off and terrain; re-encoded and repacked.',
      },
      {
        name: 'Gravel 022',
        author: 'ambientCG',
        source: 'ambientCG',
        url: 'https://ambientcg.com/view?id=Gravel022',
        licence: 'CC0',
        licenceUrl: CC0,
        note: 'Gravel traps; re-encoded and repacked.',
      },
    ],
  },
  {
    title: 'Font',
    credits: [
      {
        name: 'Chakra Petch',
        author: 'Cadson Demak',
        source: 'Google Fonts, packaged by Fontsource',
        url: 'https://fonts.google.com/specimen/Chakra+Petch',
        licence: 'SIL Open Font License 1.1',
        licenceUrl: 'https://openfontlicense.org/',
      },
    ],
  },
  {
    title: 'Sound',
    credits: [
      {
        name: 'Synthesised engines, tyres, wind, horn, impacts, beeps and crowd',
        author: 'Gamer Gang project',
        source: 'Made at runtime with Web Audio; no audio files',
        licence: 'CC0',
        licenceUrl: CC0,
      },
    ],
  },
  {
    title: 'Libraries',
    credits: [
      {
        name: 'three.js',
        author: 'three.js authors',
        source: 'threejs.org',
        url: 'https://threejs.org/',
        licence: 'MIT',
        licenceUrl: 'https://github.com/mrdoob/three.js/blob/dev/LICENSE',
      },
      {
        name: 'Rapier',
        author: 'Dimforge',
        source: 'rapier.rs',
        url: 'https://rapier.rs/',
        licence: 'Apache-2.0',
        licenceUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
      },
      {
        name: 'React',
        author: 'Meta Platforms, Inc. and affiliates',
        source: 'react.dev',
        url: 'https://react.dev/',
        licence: 'MIT',
        licenceUrl: 'https://github.com/facebook/react/blob/main/LICENSE',
      },
      {
        name: 'zod',
        author: 'Colin McDonnell',
        source: 'zod.dev',
        url: 'https://zod.dev/',
        licence: 'MIT',
        licenceUrl: 'https://github.com/colinhacks/zod/blob/main/LICENSE',
      },
    ],
  },
];
