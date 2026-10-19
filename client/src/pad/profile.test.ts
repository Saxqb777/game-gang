import { DEFAULT_CAR_ID } from '@gamergang/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STEERING_MODES, loadProfile, loadSeat } from './profile';

function storeProfile(value: unknown): void {
  const data = new Map([['gamergang.pad.profile', JSON.stringify(value)]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, item: string) => data.set(key, item),
  });
}

describe('pad profile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers drag steer first, as the default', () => {
    expect(STEERING_MODES).toEqual(['drag', 'buttons']);
    storeProfile(null);
    expect(loadProfile().mode).toBe('drag');
  });

  it('keeps a saved buttons choice', () => {
    storeProfile({ name: 'Sara', colour: 'blue', car: 'scree', mode: 'buttons' });
    expect(loadProfile()).toEqual({ name: 'Sara', colour: 'blue', car: 'scree', mode: 'buttons' });
  });

  it('turns any other stored mode into drag', () => {
    storeProfile({ name: 'Sara', colour: 'blue', mode: 'wheel' });
    expect(loadProfile().mode).toBe('drag');
  });

  it('gives a profile with an unknown or missing car the default car', () => {
    storeProfile({ name: 'Sara', colour: 'blue', car: 'wagon', mode: 'drag' });
    expect(loadProfile().car).toBe(DEFAULT_CAR_ID);
    storeProfile({ name: 'Sara', colour: 'blue', mode: 'drag' });
    expect(loadProfile().car).toBe(DEFAULT_CAR_ID);
  });
});

describe('pad seat', () => {
  const KEY = 'seatkey0123456789abcdefg';
  function storeSeat(value: unknown): void {
    const data = new Map([['gamergang.pad.seat', JSON.stringify(value)]]);
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, item: string) => data.set(key, item),
      removeItem: (key: string) => data.delete(key),
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the car of a saved seat', () => {
    storeSeat({
      room: 'ABCD',
      name: 'Sara',
      colour: 'red',
      car: 'zanna',
      mode: 'drag',
      seatKey: KEY,
    });
    expect(loadSeat('ABCD')).toEqual({
      room: 'ABCD',
      name: 'Sara',
      colour: 'red',
      car: 'zanna',
      mode: 'drag',
      seatKey: KEY,
    });
  });

  it('turns an invalid car into the default car and still returns the seat', () => {
    storeSeat({ room: 'ABCD', name: 'Sara', colour: 'red', car: 42, mode: 'drag', seatKey: KEY });
    expect(loadSeat('ABCD')?.car).toBe(DEFAULT_CAR_ID);
  });

  it('still returns an old seat saved before cars existed, with the default car', () => {
    storeSeat({ room: 'ABCD', name: 'Sara', colour: 'red', mode: 'buttons', seatKey: KEY });
    expect(loadSeat('ABCD')).toEqual({
      room: 'ABCD',
      name: 'Sara',
      colour: 'red',
      car: DEFAULT_CAR_ID,
      mode: 'buttons',
      seatKey: KEY,
    });
  });
});
