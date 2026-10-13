import { describe, expect, it } from 'vitest';
import base from '../../../../../../assets/tracks/kestrel-pines/base.layout.json';
import overrides from '../../../../../../assets/tracks/kestrel-pines/overrides.json';
import { integratePlan } from './centreline';
import { closeLoop } from './closure';
import {
  trackLayoutSchema,
  trackOverridesSchema,
  type LayoutSegment,
  type LayoutSideSpec,
  type TrackLayout,
  type TrackOverrides,
} from './layout';
import { applyOverrides } from './overrides';

const QUARTER = Math.PI / 2;

function side(patch: Partial<LayoutSideSpec> = {}): LayoutSideSpec {
  return {
    kerbWidth: 0,
    kerbHeight: 0,
    runoffStart: 10,
    runoffEnd: 10,
    runoffSurface: 'grass',
    barrier: 'armco',
    ...patch,
  };
}

function straight(name: string, length: number): LayoutSegment {
  return {
    name,
    type: 'straight',
    length,
    radiusStart: 0,
    radiusEnd: 0,
    arc: 0,
    zEnd: 0,
    tangentStart: null,
    tangentEnd: null,
    bankStart: 0,
    bankEnd: 0,
    roadWidth: 12,
    left: side(),
    right: side(),
  };
}

function left(name: string, radius: number, arc: number, kerb = false): LayoutSegment {
  return {
    ...straight(name, 0),
    type: 'left',
    radiusStart: radius,
    radiusEnd: radius,
    arc,
    left: side(kerb ? { kerbWidth: 1.2, kerbHeight: 0.05 } : {}),
  };
}

/** A closed rounded rectangle: 100 x 60 m straights joined by four R30 left quarter turns. */
function fixture(segments?: LayoutSegment[]): TrackLayout {
  return {
    format: 'splitways-layout@1',
    name: 'Fixture',
    licence: 'test',
    credits: [],
    source: { package: 'original', file: '', readme: '', readmeLicence: '', notes: 'test' },
    startZ: 0,
    segments: segments ?? [
      straight('A', 100),
      left('T1', 30, QUARTER, true),
      straight('B', 60),
      left('T2', 30, QUARTER),
      straight('C', 100),
      left('T3', 30, QUARTER, true),
      straight('D', 60),
      left('T4', 30, QUARTER),
    ],
  };
}

function fixtureOverrides(patch: Partial<TrackOverrides> = {}): TrackOverrides {
  return {
    format: 'splitways-overrides@1',
    id: 'kestrel-pines',
    name: 'Fixture',
    laps: 3,
    checkpointCount: 4,
    licence: 'test',
    credits: [],
    closure: { straights: ['A', 'B'], arc: 'T3' },
    ...patch,
  };
}

function names(layout: TrackLayout): string[] {
  return layout.segments.map((s) => s.name);
}

function segment(layout: TrackLayout, name: string): LayoutSegment {
  const found = layout.segments.find((s) => s.name === name);
  if (!found) throw new Error(`no segment ${name}`);
  return found;
}

describe('committed Kestrel Pines files', () => {
  it('parse with the schemas unchanged', () => {
    const layout = trackLayoutSchema.parse(base);
    const parsed = trackOverridesSchema.parse(overrides);
    expect(layout.segments).toHaveLength(46);
    expect(layout).toEqual(base);
    expect(parsed).toEqual(overrides);
    // The file uses null vertical tangents and the fence barrier.
    expect(layout.segments.every((s) => s.tangentStart === null && s.tangentEnd === null)).toBe(
      true,
    );
    expect(layout.segments.some((s) => s.right.barrier === 'fence')).toBe(true);
  });
});

describe('schemas', () => {
  it('reject a wrong format', () => {
    expect(
      trackLayoutSchema.safeParse({ ...fixture(), format: 'splitways-layout@2' }).success,
    ).toBe(false);
    expect(
      trackOverridesSchema.safeParse({ ...fixtureOverrides(), format: 'other@1' }).success,
    ).toBe(false);
  });

  it('reject an unknown surface or barrier name', () => {
    const layout = fixture();
    const badSurface = structuredClone(layout) as unknown as {
      segments: { left: { runoffSurface: string; barrier: string } }[];
    };
    (badSurface.segments[0] as (typeof badSurface.segments)[number]).left.runoffSurface = 'sand';
    expect(trackLayoutSchema.safeParse(badSurface).success).toBe(false);
    const badBarrier = structuredClone(layout) as unknown as typeof badSurface;
    (badBarrier.segments[0] as (typeof badSurface.segments)[number]).left.barrier = 'hedge';
    expect(trackLayoutSchema.safeParse(badBarrier).success).toBe(false);
  });

  it('reject an arc with arc <= 0', () => {
    const layout = fixture();
    (layout.segments[1] as LayoutSegment).arc = 0;
    expect(trackLayoutSchema.safeParse(layout).success).toBe(false);
    (layout.segments[1] as LayoutSegment).arc = -0.1;
    expect(trackLayoutSchema.safeParse(layout).success).toBe(false);
  });
});

describe('overrides', () => {
  it('apply in order: globals, remap, clamp, remove, insert, patches, extra kerbs', () => {
    const inserted = { ...straight('E', 30), roadWidth: 9 };
    inserted.left = side({ runoffStart: 40, runoffEnd: 40 });
    const { layout, extraKerbs } = applyOverrides(
      fixture(),
      fixtureOverrides({
        roadWidth: 14,
        kerbWidth: 1.5,
        runoffSurfaceRemap: { grass: 'gravel' },
        runoffClamp: { min: 4, max: 8 },
        remove: ['D'],
        insertAfter: [{ after: 'C', segment: inserted }],
        segments: {
          A: { roadWidth: 16, left: { barrier: 'tyres' } },
          E: { right: { runoffEnd: 2 } },
        },
        extraKerbs: [{ segment: 'B', side: 'right', start: 5, length: 20 }],
      }),
    );
    expect(names(layout)).toEqual(['A', 'T1', 'B', 'T2', 'C', 'E', 'T3', 'T4']);
    // Global road width, except where a later patch set its own.
    expect(segment(layout, 'B').roadWidth).toBe(14);
    expect(segment(layout, 'A').roadWidth).toBe(16);
    // Inserted after the globals ran: it keeps its own width, surface and run-off.
    expect(segment(layout, 'E').roadWidth).toBe(9);
    expect(segment(layout, 'E').left.runoffStart).toBe(40);
    expect(segment(layout, 'E').left.runoffSurface).toBe('grass');
    // Kerb width only where a kerb exists.
    expect(segment(layout, 'T1').left.kerbWidth).toBe(1.5);
    expect(segment(layout, 'T2').left.kerbWidth).toBe(0);
    // Remap then clamp.
    expect(segment(layout, 'A').left.runoffSurface).toBe('gravel');
    expect(segment(layout, 'A').left.runoffStart).toBe(8);
    // Side patches merge field by field.
    expect(segment(layout, 'A').left.barrier).toBe('tyres');
    expect(segment(layout, 'A').left.runoffEnd).toBe(8);
    expect(segment(layout, 'E').right.runoffEnd).toBe(2);
    expect(segment(layout, 'E').right.runoffStart).toBe(10);
    // Extra kerbs are kept as spans for the corridor step.
    expect(extraKerbs).toEqual([{ segment: 'B', side: 'right', start: 5, length: 20 }]);
  });

  it('never mutate the base layout', () => {
    const layout = fixture();
    const before = structuredClone(layout);
    applyOverrides(layout, fixtureOverrides({ roadWidth: 20, remove: ['D'] }));
    expect(layout).toEqual(before);
  });

  it('name the segment when an override refers to an unknown one', () => {
    const cases: Partial<TrackOverrides>[] = [
      { remove: ['Nowhere'] },
      { insertAfter: [{ after: 'Nowhere', segment: straight('X', 10) }] },
      { segments: { Nowhere: { roadWidth: 10 } } },
      { extraKerbs: [{ segment: 'Nowhere', side: 'left', start: 0, length: 10 }] },
    ];
    for (const patch of cases) {
      expect(() => applyOverrides(fixture(), fixtureOverrides(patch))).toThrow(/"Nowhere"/);
    }
    // A segment removed first cannot be the anchor of an insert.
    expect(() =>
      applyOverrides(
        fixture(),
        fixtureOverrides({
          remove: ['C'],
          insertAfter: [{ after: 'C', segment: straight('X', 5) }],
        }),
      ),
    ).toThrow(/"C"/);
    expect(() => closeLoop(fixture().segments, { straights: ['A', 'Nowhere'], arc: null })).toThrow(
      /"Nowhere"/,
    );
  });
});

describe('closure', () => {
  it('closes a loop built with wrong straight lengths and a wrong arc', () => {
    const segments = fixture().segments.map((s) => ({ ...s }));
    (segments[0] as LayoutSegment).length = 103;
    (segments[2] as LayoutSegment).length = 57.5;
    (segments[5] as LayoutSegment).arc = QUARTER + 0.03;
    const open = integratePlan(segments);
    const openGap = Math.hypot(open.x.at(-1) as number, open.y.at(-1) as number);
    expect(openGap).toBeGreaterThan(1);

    const { plan, report } = closeLoop(segments, { straights: ['A', 'B'], arc: 'T3' });
    const gap = Math.hypot(plan.x.at(-1) as number, plan.y.at(-1) as number);
    expect(gap).toBeLessThan(0.05);
    expect(Math.abs((plan.heading.at(-1) as number) - 2 * Math.PI)).toBeLessThan(1e-6);
    expect(report.arc?.after).toBeCloseTo(QUARTER, 9);
    expect(report.straights[0].after).toBeCloseTo(100, 6);
    expect(report.straights[1].after).toBeCloseTo(60, 6);
  });

  it('throws when the heading is off and no closure arc is named', () => {
    const segments = fixture().segments.map((s) => ({ ...s }));
    (segments[1] as LayoutSegment).arc = QUARTER + 0.01;
    expect(() => closeLoop(segments, { straights: ['A', 'B'], arc: null })).toThrow(/heading/);
  });

  it('throws for two closure straights under 20 degrees apart', () => {
    const kink = (10 * Math.PI) / 180;
    const segments = [
      straight('A1', 50),
      left('kink', 100, kink),
      straight('A2', 50),
      left('T1', 30, QUARTER - kink),
      straight('B', 60),
      left('T2', 30, QUARTER),
      straight('C', 100),
      left('T3', 30, QUARTER),
      straight('D', 60),
      left('T4', 30, QUARTER),
    ];
    expect(() => closeLoop(segments, { straights: ['A1', 'A2'], arc: null })).toThrow(
      /10\.0 deg apart/,
    );
  });

  it('throws when a straight would have to change by more than half', () => {
    const segments = fixture().segments.map((s) => ({ ...s }));
    (segments[0] as LayoutSegment).length = 250;
    expect(() => closeLoop(segments, { straights: ['A', 'B'], arc: null })).toThrow(/> 50%/);
  });
});
