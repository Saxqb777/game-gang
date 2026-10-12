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

/** Touch and key events that can carry the user activation fullscreen needs (HTML spec list). */
const ACTIVATION_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;

/**
 * A reloaded pad rejoins without a Join tap, and a reload always leaves fullscreen. Fullscreen needs
 * a user gesture, so the player's next touch anywhere (usually the first steer or gas) restores it
 * and the landscape lock. Returns a function that stops waiting.
 */
export function enterFullscreenOnNextTouch(): () => void {
  if (typeof document.documentElement.requestFullscreen !== 'function') return () => undefined;
  const stop = () => {
    for (const type of ACTIVATION_EVENTS) window.removeEventListener(type, enterFullscreen, true);
    document.removeEventListener('fullscreenchange', onChange);
  };
  // Some of these events carry no activation (a touch pointerdown), so wait for success to stop.
  const onChange = () => {
    if (document.fullscreenElement) stop();
  };
  for (const type of ACTIVATION_EVENTS) {
    window.addEventListener(type, enterFullscreen, { capture: true, passive: true });
  }
  document.addEventListener('fullscreenchange', onChange);
  return stop;
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
