/** Phone hardware helpers: fullscreen, wake lock, vibration. All degrade silently. */
import type { HapticPattern } from '@gamergang/shared';

/** Android: fullscreen + landscape lock. iPhone Safari has no element fullscreen, so this is a no-op there. */
export function enterFullscreen(): void {
  const root = document.documentElement;
  if (document.fullscreenElement || typeof root.requestFullscreen !== 'function') return;
  root
    .requestFullscreen({ navigationUI: 'hide' })
    .then(() => {
      // Safari exposes screen.orientation without lock(), so check before calling.
      const orientation = screen.orientation as Partial<ScreenOrientation> | undefined;
      return typeof orientation?.lock === 'function' ? orientation.lock('landscape') : undefined;
    })
    .catch(() => undefined);
}

let wakeLock: WakeLockSentinel | null = null;
let wakeLockWanted = false;

/** Keeps the screen on while racing. The lock is dropped when the tab hides, so it is re-taken on return. */
export function keepScreenAwake(): void {
  wakeLockWanted = true;
  if (!('wakeLock' in navigator) || (wakeLock && !wakeLock.released)) return;
  navigator.wakeLock.request('screen').then(
    (sentinel) => {
      wakeLock = sentinel;
    },
    () => undefined,
  );
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLockWanted) keepScreenAwake();
});

const HAPTICS: Record<HapticPattern, number[]> = {
  collision: [40],
  start: [90, 70, 220],
  finish: [120, 80, 120, 80, 320],
};

export function vibrate(pattern: HapticPattern): void {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(HAPTICS[pattern]);
}
