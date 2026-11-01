import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadTimeoutError, settleWithin, withTimeout } from './loadGuard';

describe('load guards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('withTimeout passes a value that arrives in time through', async () => {
    const result = withTimeout(Promise.resolve(7), 1000, 'Loading cars');
    await expect(result).resolves.toBe(7);
  });

  it('withTimeout rejects with the step once a promise that never settles runs out', async () => {
    const result = withTimeout(new Promise<never>(() => undefined), 1000, 'Loading cars');
    const caught = result.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(999);
    let settled = false;
    void caught.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const error = await caught;
    expect(error).toBeInstanceOf(LoadTimeoutError);
    expect((error as LoadTimeoutError).step).toBe('Loading cars');
    expect((error as Error).message).toBe('Loading cars took longer than 1 s');
  });

  it('withTimeout passes an early rejection through and clears its timer', async () => {
    const result = withTimeout(Promise.reject(new Error('404')), 1000, 'Loading track');
    await expect(result).rejects.toThrow('404');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settleWithin is true when the wait finishes, even by rejecting', async () => {
    await expect(settleWithin(Promise.resolve(), 8000)).resolves.toBe(true);
    await expect(settleWithin(Promise.reject(new Error('x')), 8000)).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settleWithin gives up (false, never a rejection) on a wait that never ends', async () => {
    // compileAsync after a context loss: polls for ever.
    const result = settleWithin(new Promise<never>(() => undefined), 8000);
    await vi.advanceTimersByTimeAsync(8000);
    await expect(result).resolves.toBe(false);
  });
});
