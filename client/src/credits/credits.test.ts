import { CAR_CREDITS, CAR_IDS } from '@gamergang/shared';
import { describe, expect, it } from 'vitest';
import base from '../../../assets/tracks/kestrel-pines/base.layout.json';
import overrides from '../../../assets/tracks/kestrel-pines/overrides.json';
import assetsDoc from '../../../assets/ASSETS.md?raw';
import licencesDoc from '../../../LICENCES.md?raw';
import readmeDoc from '../../../README.md?raw';
import { CREDIT_SECTIONS, TRACK_CREDIT, TRACK_LICENCE } from './credits';

/**
 * The docs part of C6 (README "Credits" and the LICENCES.md car section) lands after the
 * integration acceptance; the checks against those two files switch on with it.
 */
const CAR_DOCS_WRITTEN = false;

describe('car credits', () => {
  it('has one credit per car', () => {
    expect(Object.keys(CAR_CREDITS).sort()).toEqual([...CAR_IDS].sort());
  });

  it.each(CAR_IDS)('%s: complete attribution', (id) => {
    const credit = CAR_CREDITS[id];
    expect(credit.title.trim()).not.toBe('');
    expect(credit.author.trim()).not.toBe('');
    expect(credit.sourceUrl).toMatch(
      /^https:\/\/sketchfab\.com\/3d-models\/[a-z0-9-]+-[0-9a-f]{32}$/,
    );
    expect(credit.licenceUrl).toMatch(/^https:\/\/creativecommons\.org\//);
    expect(credit.modified.trim()).not.toBe('');
    if (credit.licence === 'CC BY 4.0') {
      expect(credit.licenceUrl).toBe('https://creativecommons.org/licenses/by/4.0/');
    } else {
      expect(credit.licenceUrl).toBe('https://creativecommons.org/publicdomain/zero/1.0/');
    }
  });

  it.skipIf(!CAR_DOCS_WRITTEN).each(CAR_IDS)('%s: named in LICENCES.md and README.md', (id) => {
    const { author, title, licence } = CAR_CREDITS[id];
    for (const doc of [licencesDoc, readmeDoc]) {
      expect(doc).toContain(author);
      expect(doc).toContain(title);
      expect(doc).toContain(licence);
    }
  });
});

describe('other credits', () => {
  it('track credit matches the track files', () => {
    for (const file of [base, overrides]) {
      expect(file.credits).toContain(TRACK_CREDIT);
      expect(file.licence).toBe(TRACK_LICENCE);
    }
  });

  it('every linked asset credit mirrors a row of assets/ASSETS.md', () => {
    const linked = CREDIT_SECTIONS.filter((s) => s.title !== 'Libraries').flatMap((s) =>
      s.credits.filter((c) => c.url !== undefined),
    );
    expect(linked.length).toBeGreaterThan(0);
    for (const credit of linked) {
      const row = assetsDoc.split('\n').find((line) => line.includes(`(${credit.url ?? ''})`));
      expect(row, credit.name).toBeDefined();
      expect(row).toContain(credit.name);
      expect(row).toContain(
        credit.licence === 'SIL Open Font License 1.1' ? credit.licence : 'CC0',
      );
      if (credit.author !== credit.source) expect(row).toContain(credit.author);
    }
  });

  it('every library is a runtime dependency', async () => {
    const pkg = (await import('../../package.json')) as { dependencies: Record<string, string> };
    const names: Record<string, string> = {
      'three.js': 'three',
      Rapier: '@dimforge/rapier3d-compat',
      React: 'react',
      zod: 'zod',
    };
    const libraries = CREDIT_SECTIONS.find((s) => s.title === 'Libraries')?.credits ?? [];
    expect(libraries.map((c) => c.name).sort()).toEqual(Object.keys(names).sort());
    for (const lib of libraries) expect(pkg.dependencies).toHaveProperty([names[lib.name] ?? '']);
  });
});
