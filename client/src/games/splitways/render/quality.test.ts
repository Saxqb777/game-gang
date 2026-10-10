import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPreset,
  lowerPreset,
  noteLoadingDrop,
  presetForPlayers,
  recordRaceOutcome,
  resetQualitySession,
  sessionDrops,
  startingPreset,
} from './quality';

const SMOOTH = { atFloorShare: 0.05, missedShare: 0.002 };
const AT_FLOOR = { atFloorShare: 0.35, missedShare: 0 };
const MISSING = { atFloorShare: 0, missedShare: 0.02 };

describe('quality presets', () => {
  beforeEach(() => {
    resetQualitySession();
  });

  it('picks the preset by player count, not by viewport count', () => {
    expect(presetForPlayers(1)).toBe('high');
    expect(presetForPlayers(2)).toBe('medium');
    expect(presetForPlayers(3)).toBe('low');
    expect(presetForPlayers(4)).toBe('low');
    expect(lowerPreset('high')).toBe('medium');
    expect(lowerPreset('low')).toBe('low');
    expect(getPreset('low').shadow.kind).toBe('focus');
    expect(getPreset('high').shadow.kind).toBe('sun');
  });

  it('drops one preset after a race at the floor or missing frames, and keeps smooth races', () => {
    expect(startingPreset(1)).toBe('high');
    recordRaceOutcome(1, SMOOTH);
    expect(startingPreset(1)).toBe('high');
    recordRaceOutcome(1, AT_FLOOR);
    expect(startingPreset(1)).toBe('medium');
    expect(sessionDrops()).toBe(1);
    recordRaceOutcome(1, MISSING);
    expect(startingPreset(1)).toBe('low');
    expect(sessionDrops()).toBe(2);
    // Already on low: nothing more to drop, and no drop is counted.
    recordRaceOutcome(1, MISSING);
    expect(startingPreset(1)).toBe('low');
    expect(sessionDrops()).toBe(2);
  });

  it('starts again from zero drops when the player count changes', () => {
    recordRaceOutcome(1, AT_FLOOR);
    expect(startingPreset(1)).toBe('medium');
    expect(startingPreset(2)).toBe('medium');
    expect(sessionDrops()).toBe(0);
    recordRaceOutcome(2, AT_FLOOR);
    expect(startingPreset(2)).toBe('low');
    expect(startingPreset(1)).toBe('high');
  });

  it('never counts a drop for 3-4 players, who start on low', () => {
    expect(startingPreset(4)).toBe('low');
    recordRaceOutcome(4, AT_FLOOR);
    noteLoadingDrop(4);
    expect(sessionDrops()).toBe(0);
    expect(startingPreset(3)).toBe('low');
    noteLoadingDrop(3);
    expect(sessionDrops()).toBe(0);
  });

  it('counts a loading benchmark drop once per call, never below low', () => {
    noteLoadingDrop(2);
    expect(startingPreset(2)).toBe('low');
    expect(sessionDrops()).toBe(1);
    noteLoadingDrop(2);
    expect(sessionDrops()).toBe(1);
  });
});
