import { afterEach, describe, expect, it, vi } from 'vitest';
import { STEERING_MODES, loadProfile } from './profile';

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
    storeProfile({ name: 'Sara', colour: 'blue', mode: 'buttons' });
    expect(loadProfile()).toEqual({ name: 'Sara', colour: 'blue', mode: 'buttons' });
  });

  it('turns any other stored mode into drag', () => {
    storeProfile({ name: 'Sara', colour: 'blue', mode: 'wheel' });
    expect(loadProfile().mode).toBe('drag');
  });
});
