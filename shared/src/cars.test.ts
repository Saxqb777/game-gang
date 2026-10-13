import { describe, expect, it } from 'vitest';
import { CAR_CREDITS, creditLine } from './carCredits';
import { CAR_IDS, CAR_INFO, DEFAULT_CAR_ID, LOCAL_CAR_ORDER, carIdSchema, carName } from './cars';

describe('car catalogue', () => {
  it('has unique ids', () => {
    expect(new Set(CAR_IDS).size).toBe(CAR_IDS.length);
  });

  it('describes and credits exactly the listed cars', () => {
    expect(Object.keys(CAR_INFO).sort()).toEqual([...CAR_IDS].sort());
    expect(Object.keys(CAR_CREDITS).sort()).toEqual([...CAR_IDS].sort());
  });

  it('keeps every stat an integer from 1 to 10', () => {
    for (const id of CAR_IDS) {
      for (const value of Object.values(CAR_INFO[id].stats)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    }
  });

  it('uses valid ids for the default car and the local car order', () => {
    expect(carIdSchema.safeParse(DEFAULT_CAR_ID).success).toBe(true);
    expect(DEFAULT_CAR_ID).toBe(CAR_IDS[0]);
    for (const id of LOCAL_CAR_ORDER) expect(carIdSchema.safeParse(id).success).toBe(true);
    expect(carIdSchema.safeParse('sports-car').success).toBe(false);
  });

  it('names the five invented makes and models in picker order', () => {
    expect(CAR_IDS.map(carName)).toEqual([
      'Dashwood Nightjar',
      'Mudlark Scree',
      'Brazen Haymaker',
      'Briganti Zanna',
      'Arvanta Sagitta',
    ]);
    expect(CAR_IDS.map((id) => CAR_INFO[id].drive)).toEqual(['RWD', 'AWD', 'RWD', 'RWD', 'AWD']);
  });

  it('writes one small-print credit line per car', () => {
    for (const id of CAR_IDS) {
      const credit = CAR_CREDITS[id];
      expect(creditLine(id)).toBe(
        `Based on "${credit.title}" by ${credit.author}, ${credit.licence}, modified.`,
      );
      expect(credit.sourceUrl).toMatch(/^https:\/\/sketchfab\.com\/3d-models\//);
    }
    expect(CAR_CREDITS.sagitta.licence).toBe('CC0 1.0');
  });
});
