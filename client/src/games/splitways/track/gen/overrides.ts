/**
 * Step 1 of track generation: apply a track's overrides to its base layout, in a fixed order, and
 * return a fresh layout (the input is never mutated). Unknown segment names are errors that name the
 * segment, so a typo in an override file never silently does nothing. Node-safe.
 */
import type { ExtraKerb, LayoutSegment, LayoutSideSpec, TrackLayout, TrackOverrides } from './layout';

export interface OverriddenLayout {
  layout: TrackLayout;
  /** Kept as spans; the corridor profile applies them per station (generation step 6). */
  extraKerbs: ExtraKerb[];
}

const SIDES = ['left', 'right'] as const;

function cloneSegment(segment: LayoutSegment): LayoutSegment {
  return { ...segment, left: { ...segment.left }, right: { ...segment.right } };
}

function indexOfSegment(segments: readonly LayoutSegment[], name: string, where: string): number {
  const index = segments.findIndex((s) => s.name === name);
  if (index < 0) throw new Error(`Unknown segment "${name}" in overrides.${where}`);
  return index;
}

function assignDefined<T extends object>(target: T, patch: Partial<T>): void {
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (value !== undefined) target[key] = value as T[keyof T];
  }
}

/**
 * Order: global `roadWidth`, `kerbWidth` (only where a kerb exists), `runoffSurfaceRemap`,
 * `runoffClamp`, `remove`, `insertAfter`, per-segment patches (side patches merge field by field),
 * then `extraKerbs` (validated here, kept as spans).
 */
export function applyOverrides(base: TrackLayout, overrides: TrackOverrides): OverriddenLayout {
  let segments = base.segments.map(cloneSegment);
  const eachSide = (fn: (side: LayoutSideSpec) => void) => {
    for (const segment of segments) for (const side of SIDES) fn(segment[side]);
  };

  const { roadWidth, kerbWidth, runoffSurfaceRemap, runoffClamp } = overrides;
  if (roadWidth !== undefined) for (const segment of segments) segment.roadWidth = roadWidth;
  if (kerbWidth !== undefined) {
    eachSide((side) => {
      if (side.kerbWidth > 0) side.kerbWidth = kerbWidth;
    });
  }
  if (runoffSurfaceRemap) {
    eachSide((side) => {
      side.runoffSurface = runoffSurfaceRemap[side.runoffSurface] ?? side.runoffSurface;
    });
  }
  if (runoffClamp) {
    const clamp = (v: number) => Math.min(runoffClamp.max, Math.max(runoffClamp.min, v));
    eachSide((side) => {
      side.runoffStart = clamp(side.runoffStart);
      side.runoffEnd = clamp(side.runoffEnd);
    });
  }
  for (const name of overrides.remove ?? []) {
    const index = indexOfSegment(segments, name, 'remove');
    segments = segments.filter((_, i) => i !== index);
  }
  for (const { after, segment } of overrides.insertAfter ?? []) {
    const index = indexOfSegment(segments, after, 'insertAfter');
    if (segments.some((s) => s.name === segment.name)) {
      throw new Error(`overrides.insertAfter: segment "${segment.name}" already exists`);
    }
    segments.splice(index + 1, 0, cloneSegment(segment));
  }
  for (const [name, patch] of Object.entries(overrides.segments ?? {})) {
    const segment = segments[indexOfSegment(segments, name, 'segments')] as LayoutSegment;
    const { left, right, ...fields } = patch;
    assignDefined(segment, fields);
    if (left) assignDefined(segment.left, left);
    if (right) assignDefined(segment.right, right);
  }
  const extraKerbs = (overrides.extraKerbs ?? []).map((span) => {
    indexOfSegment(segments, span.segment, 'extraKerbs');
    return { ...span };
  });
  return { layout: { ...base, segments }, extraKerbs };
}
