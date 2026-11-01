import { describe, expect, it } from 'vitest';
import { LIGHT_PRESET, PRESETS } from '../config';
import { lightPreset } from './quality';
import { chooseLightMode, weakDeviceReasons, type DeviceProbe } from './lightMode';

const MAC: DeviceProbe = {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  deviceMemoryGb: 8,
  maxTextureSize: 16384,
  webgl2: true,
};
const PHONE_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';

describe('weak device detection', () => {
  it('leaves a desktop machine and a phone in normal mode', () => {
    expect(weakDeviceReasons(MAC)).toEqual([]);
    expect(weakDeviceReasons({ ...MAC, userAgent: PHONE_UA })).toEqual([]);
    // Chrome caps deviceMemory and SwiftShader reports 8192: neither is weak.
    expect(weakDeviceReasons({ ...MAC, deviceMemoryGb: 4, maxTextureSize: 8192 })).toEqual([]);
    expect(weakDeviceReasons({ ...MAC, deviceMemoryGb: null, maxTextureSize: null })).toEqual([]);
  });

  it('spots smart-TV browsers', () => {
    const tvs = [
      'Mozilla/5.0 (Linux; Android 11; Smart TV Build/RTT2.211108.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Mozilla/5.0 (Linux; Android 9; BRAVIA 4K UR2 Build/PTT1.190515.001.S52) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0 Safari/537.36',
      'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/4.0 Chrome/76.0 TV Safari/537.36',
      'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0 Safari/537.36 WebAppManager',
      'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 (KHTML, like Gecko) Silk/112.0 like Chrome/112.0 Safari/537.36',
      'Mozilla/5.0 (Linux; Android 12; Google TV Streamer) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    ];
    for (const userAgent of tvs) {
      expect(weakDeviceReasons({ ...MAC, userAgent }), userAgent).toContain('tv browser');
    }
  });

  it('treats Android without "Mobile" (a TV box or tablet that names no TV) as weak', () => {
    const tcl =
      'Mozilla/5.0 (Linux; Android 11; 65C735) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0 Safari/537.36';
    expect(weakDeviceReasons({ ...MAC, userAgent: tcl })).toEqual(['android tv or tablet']);
  });

  it('flags little memory, a small GPU and no WebGL 2', () => {
    expect(weakDeviceReasons({ ...MAC, deviceMemoryGb: 2 })).toEqual(['low memory']);
    expect(weakDeviceReasons({ ...MAC, deviceMemoryGb: 0.5 })).toEqual(['low memory']);
    expect(weakDeviceReasons({ ...MAC, maxTextureSize: 4096 })).toEqual(['small gpu']);
    expect(weakDeviceReasons({ ...MAC, webgl2: false, maxTextureSize: null })).toEqual([
      'no webgl2',
    ]);
  });

  it('chooses light mode from the flag first, then memory, then the device', () => {
    expect(chooseLightMode(true, false, MAC)).toEqual({ light: true, reason: 'forced' });
    expect(chooseLightMode(false, true, { ...MAC, deviceMemoryGb: 1 }).light).toBe(false);
    expect(chooseLightMode(null, true, MAC)).toEqual({ light: true, reason: 'remembered' });
    expect(chooseLightMode(null, false, MAC)).toEqual({ light: false, reason: '' });
    expect(chooseLightMode(null, false, { ...MAC, deviceMemoryGb: 2 })).toEqual({
      light: true,
      reason: 'low memory',
    });
  });
});

describe('light preset', () => {
  it('is Low with the costly parts cut, and reports as Low', () => {
    const light = lightPreset();
    expect(light.id).toBe('low');
    expect(light.light).toBe(true);
    expect(light.msaa).toBe(0);
    expect(light.bloomLevels).toBe(0);
    expect(light.shadow.kind).toBe('none');
    expect(light.carLodFloor).toBe(1);
    expect(LIGHT_PRESET.maxInternalPixels).toBeLessThan(PRESETS.low.maxInternalPixels);
    expect(LIGHT_PRESET.vegetationDensity).toBeLessThan(PRESETS.low.vegetationDensity);
    expect(LIGHT_PRESET.cameraFar).toBeLessThan(PRESETS.low.cameraFar);
  });
});
