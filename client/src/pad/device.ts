/** Phone hardware helpers: motion permission, fullscreen, wake lock, vibration. All degrade silently. */
import type { HapticPattern } from '@gamergang/shared';

export type TiltPermission = 'granted' | 'denied' | 'unsupported';

interface OrientationPermissionApi {
  requestPermission?: () => Promise<string>;
}

function orientationApi(): OrientationPermissionApi | null {
  return typeof DeviceOrientationEvent === 'undefined'
    ? null
    : (DeviceOrientationEvent as unknown as OrientationPermissionApi);
}

/** iOS asks the user for motion access; Android just grants it. */
export function tiltNeedsPrompt(): boolean {
  return typeof orientationApi()?.requestPermission === 'function';
}

/**
 * Call synchronously from a tap handler: iOS only shows the motion prompt during a user gesture,
 * and only on secure (https) pages.
 */
export function requestTiltPermission(): Promise<TiltPermission> {
  const api = orientationApi();
  if (!api || !window.isSecureContext) return Promise.resolve('unsupported');
  if (typeof api.requestPermission !== 'function') return Promise.resolve('granted');
  return api.requestPermission().then(
    (result) => (result === 'granted' ? 'granted' : 'denied'),
    () => 'denied',
  );
}

/** True if the device really reports orientation. Laptops either send nothing or send nulls. */
export function probeTiltSensor(timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      window.removeEventListener('deviceorientation', onEvent);
      resolve(ok);
    };
    const onEvent = (event: DeviceOrientationEvent) => {
      if (event.beta !== null && event.gamma !== null) finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    window.addEventListener('deviceorientation', onEvent);
  });
}

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
