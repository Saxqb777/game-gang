/**
 * The track data formats: a layout (`base.layout.json`, a segment list in driving order) and a small
 * per-track override file (`overrides.json`). The zod schemas mirror the interfaces exactly, so a
 * track folder is validated before anything is generated from it. Node-safe.
 */
import { trackIdSchema, type TrackId } from '@gamergang/shared';
import { z } from 'zod';
import type { BarrierName, SurfaceName } from '../surfaces';

/** One side of a segment, from the asphalt edge outwards. Widths in metres. */
export interface LayoutSideSpec {
  kerbWidth: number; // 0 = no kerb
  kerbHeight: number; // raise at the kerb's outer edge (m)
  runoffStart: number; // run-off width at segment start (m), kerb (or asphalt) edge to wall
  runoffEnd: number;
  runoffSurface: SurfaceName; // asphalt = paved apron
  barrier: BarrierName;
}
export interface LayoutSegment {
  name: string;
  type: 'straight' | 'left' | 'right';
  length: number; // straights (m); 0 for arcs
  radiusStart: number; // arcs (m); 0 for straights
  radiusEnd: number; // == radiusStart unless spiral
  arc: number; // arcs: turned angle (rad, > 0); 0 for straights
  zEnd: number; // elevation at segment end (m, absolute)
  tangentStart: number | null; // optional vertical tangent (rise/run)
  tangentEnd: number | null;
  bankStart: number; // rad, + = right edge higher (a left-hander banked into the turn is +)
  bankEnd: number;
  roadWidth: number; // full asphalt width (m)
  left: LayoutSideSpec;
  right: LayoutSideSpec;
}
export interface TrackLayout {
  format: 'splitways-layout@1';
  name: string; // human-readable layout name; the game uses TrackOverrides.name
  licence: string;
  credits: string[];
  /** Provenance. An original layout has package 'original', empty file/readme/readmeLicence and a note
   *  (Kestrel Pines: "Original design, not derived from any existing track"). Third-party data would
   *  fill these, and needs its LICENCES.md row first. The generator ignores this field. */
  source: { package: string; file: string; readme: string; readmeLicence: string; notes: string };
  startZ: number; // elevation at the start of segments[0]
  segments: LayoutSegment[]; // driving order; start of segments[0] = start/finish line
}
export type SidePatch = Partial<LayoutSideSpec>;
export type SegmentPatch = Partial<Omit<LayoutSegment, 'name' | 'left' | 'right'>> & {
  left?: SidePatch;
  right?: SidePatch;
};
export interface ExtraKerb {
  segment: string;
  side: 'left' | 'right';
  /** Start (m from the segment's start) and length (m) of the kerb. */
  start: number;
  length: number;
  width?: number;
}
export interface TrackOverrides {
  format: 'splitways-overrides@1';
  id: TrackId; // from @gamergang/shared
  name: string;
  laps: number;
  checkpointCount: number;
  licence: string;
  credits: string[];
  roadWidth?: number;
  kerbWidth?: number; // applied where kerbWidth > 0
  runoffSurfaceRemap?: Partial<Record<SurfaceName, SurfaceName>>;
  runoffClamp?: { min: number; max: number };
  remove?: string[];
  insertAfter?: { after: string; segment: LayoutSegment }[];
  segments?: Record<string, SegmentPatch>;
  extraKerbs?: ExtraKerb[];
  closure: { straights: [string, string]; arc: string | null };
  startOffset?: number; // m from the start of segments[0]; default 0
}

const finite = z.number().refine(Number.isFinite, 'must be a finite number');
const nonNegative = finite.refine((v) => v >= 0, 'must be >= 0');
const surfaceName = z.enum(['asphalt', 'kerb', 'grass', 'gravel']);
const barrierName = z.enum(['none', 'armco', 'tyres', 'wall', 'fence']);

const sideSpec = z.object({
  kerbWidth: nonNegative,
  kerbHeight: nonNegative,
  runoffStart: nonNegative,
  runoffEnd: nonNegative,
  runoffSurface: surfaceName,
  barrier: barrierName,
});

const segmentFields = {
  type: z.enum(['straight', 'left', 'right']),
  length: nonNegative,
  radiusStart: nonNegative,
  radiusEnd: nonNegative,
  arc: nonNegative,
  zEnd: finite,
  tangentStart: finite.nullable(),
  tangentEnd: finite.nullable(),
  bankStart: finite,
  bankEnd: finite,
  roadWidth: finite.refine((v) => v > 0, 'must be > 0'),
};

/** Straights need a length; arcs need a turned angle and both radii. */
export const layoutSegmentSchema = z
  .object({ name: z.string().min(1), ...segmentFields, left: sideSpec, right: sideSpec })
  .superRefine((segment, ctx) => {
    if (segment.type === 'straight') {
      if (segment.length <= 0) {
        ctx.addIssue({ code: 'custom', path: ['length'], message: 'a straight needs length > 0' });
      }
      return;
    }
    if (segment.arc <= 0) {
      ctx.addIssue({ code: 'custom', path: ['arc'], message: 'an arc needs arc > 0' });
    }
    if (segment.radiusStart <= 0 || segment.radiusEnd <= 0) {
      ctx.addIssue({ code: 'custom', path: ['radiusStart'], message: 'an arc needs radii > 0' });
    }
  });

export const trackLayoutSchema = z.object({
  format: z.literal('splitways-layout@1'),
  name: z.string(),
  licence: z.string().min(1),
  credits: z.array(z.string()),
  source: z.object({
    package: z.string(),
    file: z.string(),
    readme: z.string(),
    readmeLicence: z.string(),
    notes: z.string(),
  }),
  startZ: finite,
  segments: z.array(layoutSegmentSchema).min(2),
}) satisfies z.ZodType<TrackLayout>;

const sidePatch = sideSpec.partial();
const segmentPatch = z
  .object(segmentFields)
  .partial()
  .extend({ left: sidePatch.optional(), right: sidePatch.optional() });

export const trackOverridesSchema = z.object({
  format: z.literal('splitways-overrides@1'),
  id: trackIdSchema,
  name: z.string().min(1),
  laps: z.number().int().min(1).max(99),
  checkpointCount: z.number().int().min(2),
  licence: z.string().min(1),
  credits: z.array(z.string()),
  roadWidth: finite.refine((v) => v > 0, 'must be > 0').optional(),
  kerbWidth: nonNegative.optional(),
  runoffSurfaceRemap: z.partialRecord(surfaceName, surfaceName).optional(),
  runoffClamp: z.object({ min: nonNegative, max: nonNegative }).optional(),
  remove: z.array(z.string()).optional(),
  insertAfter: z.array(z.object({ after: z.string(), segment: layoutSegmentSchema })).optional(),
  segments: z.record(z.string(), segmentPatch).optional(),
  extraKerbs: z
    .array(
      z.object({
        segment: z.string(),
        side: z.enum(['left', 'right']),
        start: nonNegative,
        length: finite.refine((v) => v > 0, 'must be > 0'),
        width: finite.refine((v) => v > 0, 'must be > 0').optional(),
      }),
    )
    .optional(),
  closure: z.object({
    straights: z.tuple([z.string(), z.string()]),
    arc: z.string().nullable(),
  }),
  startOffset: nonNegative.optional(),
}) satisfies z.ZodType<TrackOverrides>;
