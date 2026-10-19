import vocabulary from './vocabulary.json' with { type: 'json' };

/**
 * Names the packager accepts from the art track (spec 3.10) and the names it writes (spec 3.9).
 */

/** Input material vocabulary (vocabulary.json): base name to family. */
export const VOCABULARY = vocabulary.families;

/** Families nobody looks at closely: simplified first when LOD0 is over budget. */
export const HIDDEN_FAMILIES = new Set(['interior', 'chassis']);

/** Material names allowed per level in the runtime GLB. */
export const LOD1_MATERIALS = ['paint', 'kit', 'glass', 'light_tail'];
export const LOD2_MATERIALS = ['paint', 'palette'];
export const SHADOW_MATERIAL = 'shadow';

/** LOD0 names: a vocabulary word, optionally `_cutout`, optionally `.<n>`. */
export const LOD0_NAME = new RegExp(`^(${Object.keys(VOCABULARY).join('|')})(_cutout)?(\\.\\d+)?$`);

export const CORNERS = ['fl', 'fr', 'rl', 'rr'];

/**
 * Splits a source material name into its vocabulary word and family, or returns null for a name
 * outside the vocabulary. Case-insensitive; `.2`-style and `_cutout` suffixes are allowed.
 */
export function classifyMaterialName(name) {
  const lower = String(name ?? '')
    .trim()
    .toLowerCase();
  const plain = lower.replace(/[._]\d+$/, '');
  const cutout = plain.endsWith('_cutout');
  const base = cutout ? plain.slice(0, -'_cutout'.length) : plain;
  const family = VOCABULARY[base];
  if (!family) return null;
  return { base, family, cutout };
}

/** `wheel_fl` -> { kind: 'wheel', corner: 'fl' }; `brake_rr`/`caliper_rr` -> caliper; else null. */
export function classifyNodeName(name) {
  const match = /^(wheel|caliper|brake)_(fl|fr|rl|rr)$/i.exec(String(name ?? '').trim());
  if (!match) return null;
  const kind = match[1].toLowerCase() === 'wheel' ? 'wheel' : 'caliper';
  return { kind, corner: match[2].toLowerCase() };
}
