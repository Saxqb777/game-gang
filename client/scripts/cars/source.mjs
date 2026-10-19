/**
 * Turns a source GLB (a debranded car from V2/, or a carkit model) into the packager's neutral
 * source model: triangle parts tagged with their group (body, wheel, caliper) and material, the
 * materials with their factors and texture slots, the images, and the wheel node origins.
 */
import { Mesh, Vector3 } from 'three';
import { parseGlb } from './glb.mjs';
import { classifyMaterialName, classifyNodeName, CORNERS } from './classify.mjs';
import { meshFromGeometry } from './mesh.mjs';

/** Reads the material factors straight from the glTF JSON (exact numbers, spec defaults). */
export function materialFromJson(definition, index, maps) {
  const pbr = definition.pbrMetallicRoughness ?? {};
  const base = pbr.baseColorFactor ?? [1, 1, 1, 1];
  const strength = definition.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
  const emissive = (definition.emissiveFactor ?? [0, 0, 0]).map((value) => value * strength);
  const clearcoat = definition.extensions?.KHR_materials_clearcoat;
  return {
    index,
    name: definition.name ?? `material_${index}`,
    color: [base[0], base[1], base[2]],
    opacity: base[3],
    metalness: pbr.metallicFactor ?? 1,
    roughness: pbr.roughnessFactor ?? 1,
    emissive,
    alphaMode: definition.alphaMode ?? 'OPAQUE',
    alphaCutoff: definition.alphaCutoff ?? 0.5,
    doubleSided: definition.doubleSided === true,
    clearcoat: clearcoat?.clearcoatFactor ?? 0,
    clearcoatRoughness: clearcoat?.clearcoatRoughnessFactor ?? 0,
    maps: maps?.maps ?? { base: null, mr: null, normal: null, occlusion: null, emissive: null },
    normalScale: maps?.normalScale ?? 1,
    occlusionStrength: maps?.occlusionStrength ?? 1,
  };
}

/** Adds the vocabulary classification to every material; fails listing every unknown name. */
export function classifyMaterials(materials, usedIndices) {
  const unknown = [];
  for (const material of materials) {
    const info = classifyMaterialName(material.name);
    if (!info) {
      if (usedIndices.has(material.index)) unknown.push(material.name);
      continue;
    }
    material.base = info.base;
    material.family = info.family;
    // Alpha-tested materials are the cutout family whatever their name says.
    material.cutout = info.cutout || material.alphaMode === 'MASK';
  }
  if (unknown.length) {
    throw new Error(
      `Unknown material names (not in the vocabulary of spec 3.10): ${[...new Set(unknown)].sort().join(', ')}`,
    );
  }
}

/** The group a mesh belongs to: the nearest wheel_xx / caliper_xx / brake_xx ancestor, else body. */
function groupOf(object) {
  for (let node = object; node; node = node.parent) {
    const info = classifyNodeName(node.userData.name ?? node.name);
    if (info) return `${info.kind}_${info.corner}`;
  }
  return 'body';
}

/**
 * The neutral source model of a parsed GLB. `renameMaterial` may map source material names first
 * (the placeholder uses it for the one CC0 material name outside the vocabulary).
 */
export function sourceFromParsed(parsed, { renameMaterial = (name) => name } = {}) {
  const { json, scene, images, materialMaps, materialIndexOf } = parsed;
  scene.updateMatrixWorld(true);
  const materials = (json.materials ?? []).map((definition, index) => {
    const material = materialFromJson(definition, index, materialMaps[index]);
    material.name = renameMaterial(material.name);
    return material;
  });
  const parts = [];
  const wheelOrigins = {};
  scene.traverse((object) => {
    const info = classifyNodeName(object.userData.name ?? object.name);
    if (info?.kind === 'wheel') {
      if (wheelOrigins[info.corner]) throw new Error(`Two wheel_${info.corner} nodes`);
      wheelOrigins[info.corner] = new Vector3().setFromMatrixPosition(object.matrixWorld).toArray();
    }
    if (!(object instanceof Mesh)) return;
    if (Array.isArray(object.material)) throw new Error(`${object.name}: multi-material mesh`);
    if (object.isSkinnedMesh || object.morphTargetInfluences) {
      throw new Error(`${object.name}: skinned or morphed meshes are not supported`);
    }
    const mesh = meshFromGeometry(object.geometry, object.matrixWorld);
    if (!mesh.indices.length) return;
    parts.push({
      name: object.userData.name ?? object.name,
      group: groupOf(object),
      material: materialIndexOf(object.material),
      mesh,
    });
  });
  for (const corner of CORNERS) {
    if (!wheelOrigins[corner]) throw new Error(`Missing wheel node wheel_${corner}`);
  }
  classifyMaterials(materials, new Set(parts.map((part) => part.material)));
  return { parts, materials, images, wheelOrigins };
}

export async function loadSourceGlb(bytes) {
  return sourceFromParsed(await parseGlb(bytes));
}
