/**
 * Light mode for weak machines (D-TV1): smart-TV browsers, little RAM, small GPUs. The pure
 * detection is Node-safe and unit-tested; the probe and the memory touch the browser only inside
 * functions.
 *
 * Light mode is chosen up front when the machine is clearly weak, when `?light=1` forces it, or when
 * this device remembers that a normal load failed here (localStorage, so it outlives the page).
 */

export interface DeviceProbe {
  userAgent: string;
  /** navigator.deviceMemory (GB, rounded down by the browser), if it is exposed. */
  deviceMemoryGb: number | null;
  /** MAX_TEXTURE_SIZE of a WebGL 2 context; null without one. */
  maxTextureSize: number | null;
  webgl2: boolean;
}

/** Smart-TV and set-top browsers: Android TV / Google TV, Tizen, webOS, Fire TV, Chromecast, ... */
const TV_AGENT =
  /\b(android tv|google ?tv|smart[- ]?tv|hbbtv|tizen|web0s|webos|netcast|bravia|crkey|aft[a-z]{1,3}|opera tv|vidaa|roku|viera|philipstv|appletv|tv bro)\b/i;

/**
 * Why this machine should start in light mode (empty: it should not). Android without "Mobile" is
 * a tablet or a TV box: many Android TVs name no TV in their user agent at all.
 */
export function weakDeviceReasons(probe: DeviceProbe): string[] {
  const reasons: string[] = [];
  const ua = probe.userAgent;
  if (TV_AGENT.test(ua)) reasons.push('tv browser');
  else if (/\bandroid\b/i.test(ua) && !/\bmobile\b/i.test(ua)) reasons.push('android tv or tablet');
  if (probe.deviceMemoryGb !== null && probe.deviceMemoryGb <= 2) reasons.push('low memory');
  if (!probe.webgl2) reasons.push('no webgl2');
  else if (probe.maxTextureSize !== null && probe.maxTextureSize <= 4096) reasons.push('small gpu');
  return reasons;
}

let probed: DeviceProbe | null = null;

/** Reads this browser once: a throwaway WebGL 2 context for the GPU limits, lost straight away. */
export function probeDevice(): DeviceProbe {
  if (probed) return probed;
  const nav = navigator as Navigator & { deviceMemory?: number };
  let webgl2 = false;
  let maxTextureSize: number | null = null;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (gl) {
      webgl2 = true;
      const size: unknown = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      maxTextureSize = typeof size === 'number' ? size : null;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    // No WebGL at all: reported as no WebGL 2.
  }
  probed = {
    userAgent: nav.userAgent,
    deviceMemoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    maxTextureSize,
    webgl2,
  };
  return probed;
}

const STORAGE_KEY = 'gamergang.splitways.light';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** A normal load failed on this device before: start light. */
export function rememberedLight(): boolean {
  try {
    return storage()?.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberLight(on: boolean): void {
  try {
    if (on) storage()?.setItem(STORAGE_KEY, '1');
    else storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Blocked storage: light mode still applies to this page load.
  }
}

export interface LightChoice {
  light: boolean;
  /** Why, for the console and the loading screen (empty when not light). */
  reason: string;
}

/**
 * Whether the first attempt runs light. `forced` is `?light=1` (true) or `?light=0` (false, also
 * forgets the remembered choice); null decides from memory and the device.
 */
export function chooseLightMode(
  forced: boolean | null,
  remembered: boolean,
  probe: DeviceProbe,
): LightChoice {
  if (forced !== null) return { light: forced, reason: forced ? 'forced' : '' };
  if (remembered) return { light: true, reason: 'remembered' };
  const reasons = weakDeviceReasons(probe);
  return { light: reasons.length > 0, reason: reasons.join(', ') };
}
