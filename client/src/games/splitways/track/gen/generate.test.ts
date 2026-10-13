import { describe, expect, it } from 'vitest';
import base from '../../../../../../assets/tracks/kestrel-pines/base.layout.json';
import overrides from '../../../../../../assets/tracks/kestrel-pines/overrides.json';
import { TRACKGEN } from '../../config';
import { buildTrack } from '../tracks';
import { segmentLength } from './centreline';
import { generateTrackWithReport } from './generate';
import { trackLayoutSchema, trackOverridesSchema } from './layout';
import { applyOverrides } from './overrides';

const LICENCE = 'Proprietary - (C) 2026 Gamer Gang project. All rights reserved.';
const CREDITS = ['Original layout by the Gamer Gang project, 2026'];

const layout = trackLayoutSchema.parse(base);
const trackOverrides = trackOverridesSchema.parse(overrides);
const track = buildTrack(base, overrides);
const n = track.samples.length;
const { report } = generateTrackWithReport(layout, trackOverrides);

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Station in the middle of a named segment of the closed layout. */
function middleOf(name: string): number {
  let s = 0;
  for (const segment of report.layout.segments) {
    const length = segmentLength(segment);
    if (segment.name === name) return Math.round((s + length / 2) / track.spacing);
    s += length;
  }
  throw new Error(`no segment ${name}`);
}

describe('Kestrel Pines generation', () => {
  it('is a 3.35-3.37 km lap of ~1 m stations', () => {
    expect(track.length).toBeGreaterThan(3350);
    expect(track.length).toBeLessThan(3370);
    expect(track.spacing).toBeGreaterThan(0.99);
    expect(track.spacing).toBeLessThan(1.01);
    expect(track.definition.count).toBe(n);
  });

  it('closes: no gap at the seam and a continuous heading', () => {
    const first = track.sample(0).position;
    const last = track.sample(n - 1).position;
    expect(Math.hypot(first.x - last.x, first.z - last.z)).toBeLessThan(1.5 * track.spacing);
    const { layout: overridden } = applyOverrides(layout, trackOverrides);
    let layoutRadius = Infinity;
    for (const s of overridden.segments) {
      if (s.type !== 'straight') layoutRadius = Math.min(layoutRadius, s.radiusStart, s.radiusEnd);
    }
    expect(layoutRadius).toBe(30);
    let maxStep = 0;
    for (let i = 0; i < n; i++) {
      const step = wrapAngle(
        (track.definition.heading[(i + 1) % n] as number) - (track.definition.heading[i] as number),
      );
      maxStep = Math.max(maxStep, Math.abs(step));
    }
    expect(maxStep).toBeLessThan((1.5 * track.spacing) / layoutRadius);
    const seam = wrapAngle(
      (track.definition.heading[0] as number) - (track.definition.heading[n - 1] as number),
    );
    expect(Math.abs(seam)).toBeLessThan(1e-3);
    expect(report.closure.gapBefore).toBeLessThan(0.05);
  });

  it('has the Switchback as its tightest corner', () => {
    expect(track.minimumRadius()).toBeGreaterThan(28);
    expect(track.minimumRadius()).toBeLessThan(45);
  });

  it('keeps separate legs of the lap at least 115 m apart', () => {
    let closest = Infinity;
    for (let i = 0; i < n; i += 4) {
      for (let j = i + 4; j < n; j += 4) {
        const along = Math.min(j - i, n - (j - i)) * track.spacing;
        if (along <= 500) continue;
        const a = track.sample(i).position;
        const b = track.sample(j).position;
        closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
      }
    }
    expect(closest).toBeGreaterThan(115);
  });

  it('has walls beyond the road on both sides everywhere and a valid corridor', () => {
    for (const s of track.samples) {
      expect(s.sideL.wall).toBeGreaterThan(s.sideL.road);
      expect(s.sideR.wall).toBeGreaterThan(s.sideR.road);
    }
    expect(track.validateCorridor()).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('keeps crests gentle and the elevation range of the layout', () => {
    let crest = 0;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < n; i++) {
      const y = (k: number) => track.sample(k).position.y;
      crest = Math.min(crest, (y(i - 1) - 2 * y(i) + y(i + 1)) / track.spacing ** 2);
      min = Math.min(min, y(i));
      max = Math.max(max, y(i));
    }
    expect(-crest).toBeLessThanOrEqual(1.1 / TRACKGEN.crestRadius);
    expect(max - min).toBeGreaterThan(20);
    expect(max - min).toBeLessThan(24);
  });

  it('turns left with positive curvature and banks into the corners', () => {
    expect(track.sample(middleOf('Kestrel hold')).curvature).toBeGreaterThan(0);
    expect(track.sample(middleOf('Kestrel hold')).bank).toBeGreaterThan(0.09);
    const hollow = middleOf('the Hollow apex');
    const sample = track.sample(hollow);
    expect(sample.curvature).toBeLessThan(0);
    expect(sample.bank).toBeLessThan(0);
    // Right-hander banked into the turn: the left edge is higher.
    expect(track.crossSectionY(hollow, -sample.sideL.road)).toBeGreaterThan(
      track.crossSectionY(hollow, sample.sideR.road),
    );
  });

  it('starts at station 0 with 230 m of straight behind the line', () => {
    expect(track.startLine.distance).toBe(0);
    expect(track.startLine.sample).toBe(track.sample(0));
    for (let i = n - 230; i < n; i++) {
      expect(Math.abs(track.sample(i).curvature)).toBeLessThan(1e-3);
    }
  });

  it('has 18 checkpoints that reach past both walls', () => {
    expect(track.checkpoints).toHaveLength(18);
    for (const gate of track.checkpoints) {
      expect(gate.halfWidthLeft).toBeCloseTo(gate.sample.sideL.wall + 1.5, 5);
      expect(gate.halfWidthRight).toBeCloseTo(gate.sample.sideR.wall + 1.5, 5);
    }
  });

  it('carries the project licence and credits in both files', () => {
    expect(base.licence).toBe(LICENCE);
    expect(overrides.licence).toBe(LICENCE);
    expect(base.credits).toEqual(CREDITS);
    expect(overrides.credits).toEqual(CREDITS);
    expect(base.source.package).toBe('original');
    expect(track.definition.licence).toBe(LICENCE);
    expect(track.definition.credits).toEqual(CREDITS);
  });

  it('is deterministic', () => {
    const again = buildTrack(base, overrides).definition;
    const first = track.definition;
    for (const key of [
      'x',
      'y',
      'z',
      'heading',
      'curvature',
      'bank',
      'racingLine',
      'speed',
    ] as const) {
      expect(again[key]).toEqual(first[key]);
    }
    expect(again.left).toEqual(first.left);
    expect(again.right).toEqual(first.right);
  });

  it('plans a racing line inside the asphalt and slows for the big corners', () => {
    for (const s of track.samples) {
      expect(s.racingLine).toBeGreaterThanOrEqual(-s.sideL.road);
      expect(s.racingLine).toBeLessThanOrEqual(s.sideR.road);
      expect(s.targetSpeed).toBeGreaterThan(10);
      expect(s.targetSpeed).toBeLessThanOrEqual(51);
    }
    // The Switchback hairpin is the slowest point; the main straight is flat out.
    expect(track.sample(middleOf('Switchback apex')).targetSpeed).toBeLessThan(22);
    expect(track.sample(100).targetSpeed).toBeGreaterThan(48);
  });
});
