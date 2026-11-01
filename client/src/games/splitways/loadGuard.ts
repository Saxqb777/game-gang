/**
 * Time limits for the loading screen's waits (D-TV1). Node-safe and pure, so they are unit-tested.
 *
 * A weak TV can leave a promise pending for ever: three's compileAsync polls the parallel-compile
 * status until every program reports done, which never happens after a context loss or on a driver
 * that never reports it; a stalled download never settles either.
 */

/** A load step ran out of time. `step` names it for the loading screen and the console. */
export class LoadTimeoutError extends Error {
  constructor(
    readonly step: string,
    readonly ms: number,
  ) {
    super(`${step} took longer than ${Math.round(ms / 1000)} s`);
    this.name = 'LoadTimeoutError';
  }
}

/** Rejects with LoadTimeoutError if `promise` has not settled within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new LoadTimeoutError(step, ms));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Waits for `promise` at most `ms`, never rejecting: true if it settled in time (fulfilled or
 * rejected), false if the wait gave up. For waits the loading screen can safely walk away from.
 */
export function settleWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      resolve(false);
    }, ms);
    const done = () => {
      clearTimeout(timer);
      resolve(true);
    };
    promise.then(done, done);
  });
}
