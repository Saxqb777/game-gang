/**
 * Plain-array triangle meshes for the packager: { positions, normals, uvs | null, indices }, all
 * Float32Array / Uint32Array, in car space. Merging, welding, bounds, area and simplification.
 */
import { Matrix3, Vector3 } from 'three';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';

export function triangleCount(mesh) {
  return mesh.indices.length / 3;
}

export function vertexCount(mesh) {
  return mesh.positions.length / 3;
}

/** Copies a three BufferGeometry into plain arrays, transformed by `matrix` (a Matrix4). */
export function meshFromGeometry(geometry, matrix) {
  const position = geometry.getAttribute('position');
  if (!position) throw new Error('Mesh without positions');
  const count = position.count;
  const positions = new Float32Array(count * 3);
  const e = matrix.elements;
  for (let i = 0; i < count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    positions[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
    positions[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
    positions[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
  }
  let indices;
  if (geometry.index) {
    indices = new Uint32Array(geometry.index.count);
    for (let i = 0; i < indices.length; i++) indices[i] = geometry.index.getX(i);
  } else {
    indices = new Uint32Array(count);
    for (let i = 0; i < count; i++) indices[i] = i;
  }
  // A mirroring transform turns the triangles inside out; flip them back.
  const det =
    e[0] * (e[5] * e[10] - e[9] * e[6]) -
    e[4] * (e[1] * e[10] - e[9] * e[2]) +
    e[8] * (e[1] * e[6] - e[5] * e[2]);
  if (det < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const t = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = t;
    }
  }
  const normal = geometry.getAttribute('normal');
  let normals;
  if (normal) {
    const normalMatrix = new Matrix3().getNormalMatrix(matrix);
    const n = new Vector3();
    normals = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
      normals[i * 3] = n.x;
      normals[i * 3 + 1] = n.y;
      normals[i * 3 + 2] = n.z;
    }
  } else {
    normals = computeNormals(positions, indices);
  }
  const uv = geometry.getAttribute('uv');
  let uvs = null;
  if (uv) {
    uvs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      uvs[i * 2] = uv.getX(i);
      uvs[i * 2 + 1] = uv.getY(i);
    }
  }
  return { positions, normals, uvs, indices };
}

export function computeNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      normals[k] += nx;
      normals[k + 1] += ny;
      normals[k + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= length;
    normals[i + 1] /= length;
    normals[i + 2] /= length;
  }
  return normals;
}

/** Concatenates meshes. UVs are kept only if every mesh has them (else zero-filled when `needUv`). */
export function mergeMeshes(meshes, needUv = false) {
  let vertices = 0;
  let indexCount = 0;
  for (const mesh of meshes) {
    vertices += vertexCount(mesh);
    indexCount += mesh.indices.length;
  }
  const withUv = needUv || (meshes.length > 0 && meshes.every((mesh) => mesh.uvs));
  const positions = new Float32Array(vertices * 3);
  const normals = new Float32Array(vertices * 3);
  const uvs = withUv ? new Float32Array(vertices * 2) : null;
  const indices = new Uint32Array(indexCount);
  let v = 0;
  let k = 0;
  for (const mesh of meshes) {
    positions.set(mesh.positions, v * 3);
    normals.set(mesh.normals, v * 3);
    if (uvs && mesh.uvs) uvs.set(mesh.uvs, v * 2);
    for (let i = 0; i < mesh.indices.length; i++) indices[k + i] = mesh.indices[i] + v;
    v += vertexCount(mesh);
    k += mesh.indices.length;
  }
  return { positions, normals, uvs, indices };
}

/** Moves every vertex by (dx, dy, dz). */
export function translateMesh(mesh, dx, dy, dz) {
  const positions = mesh.positions.slice();
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += dx;
    positions[i + 1] += dy;
    positions[i + 2] += dz;
  }
  return { ...mesh, positions };
}

/** Axis-aligned bounds { min: [x,y,z], max: [x,y,z] } of the vertices the indices use. */
export function meshBounds(meshes) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of meshes) {
    for (let i = 0; i < mesh.indices.length; i++) {
      const p = mesh.indices[i] * 3;
      for (let axis = 0; axis < 3; axis++) {
        const value = mesh.positions[p + axis];
        if (value < min[axis]) min[axis] = value;
        if (value > max[axis]) max[axis] = value;
      }
    }
  }
  return { min, max };
}

/** Total triangle area in square metres. */
export function surfaceArea(mesh) {
  const { positions: p, indices } = mesh;
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const ux = p[b] - p[a];
    const uy = p[b + 1] - p[a + 1];
    const uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a];
    const vy = p[c + 1] - p[a + 1];
    const vz = p[c + 2] - p[a + 2];
    area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return area;
}

/**
 * Merges bit-identical vertices (position, normal and uv) and drops unused and degenerate ones, so
 * the simplifier sees a connected mesh. Deterministic: first occurrence wins, order kept.
 */
export function weldMesh(mesh) {
  const count = vertexCount(mesh);
  const remap = new Uint32Array(count);
  const seen = new Map();
  const keep = [];
  const f32 = new Float32Array(8);
  const u32 = new Uint32Array(f32.buffer);
  const used = new Uint8Array(count);
  for (let i = 0; i < mesh.indices.length; i++) used[mesh.indices[i]] = 1;
  for (let i = 0; i < count; i++) {
    if (!used[i]) continue;
    f32[0] = mesh.positions[i * 3];
    f32[1] = mesh.positions[i * 3 + 1];
    f32[2] = mesh.positions[i * 3 + 2];
    f32[3] = mesh.normals[i * 3];
    f32[4] = mesh.normals[i * 3 + 1];
    f32[5] = mesh.normals[i * 3 + 2];
    f32[6] = mesh.uvs ? mesh.uvs[i * 2] : 0;
    f32[7] = mesh.uvs ? mesh.uvs[i * 2 + 1] : 0;
    const key = Array.from(u32).join(',');
    const existing = seen.get(key);
    if (existing === undefined) {
      seen.set(key, keep.length);
      remap[i] = keep.length;
      keep.push(i);
    } else {
      remap[i] = existing;
    }
  }
  const positions = new Float32Array(keep.length * 3);
  const normals = new Float32Array(keep.length * 3);
  const uvs = mesh.uvs ? new Float32Array(keep.length * 2) : null;
  keep.forEach((source, target) => {
    positions.set(mesh.positions.subarray(source * 3, source * 3 + 3), target * 3);
    normals.set(mesh.normals.subarray(source * 3, source * 3 + 3), target * 3);
    if (uvs) uvs.set(mesh.uvs.subarray(source * 2, source * 2 + 2), target * 2);
  });
  const indices = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = remap[mesh.indices[i]];
    const b = remap[mesh.indices[i + 1]];
    const c = remap[mesh.indices[i + 2]];
    if (a === b || b === c || a === c) continue;
    indices.push(a, b, c);
  }
  return { positions, normals, uvs, indices: Uint32Array.from(indices) };
}

/** Keeps only the vertices the index buffer uses, in first-use order. */
export function compactMesh(mesh) {
  const count = vertexCount(mesh);
  const remap = new Int32Array(count).fill(-1);
  let next = 0;
  const indices = new Uint32Array(mesh.indices.length);
  for (let i = 0; i < mesh.indices.length; i++) {
    const v = mesh.indices[i];
    if (remap[v] < 0) remap[v] = next++;
    indices[i] = remap[v];
  }
  const positions = new Float32Array(next * 3);
  const normals = new Float32Array(next * 3);
  const uvs = mesh.uvs ? new Float32Array(next * 2) : null;
  for (let v = 0; v < count; v++) {
    const target = remap[v];
    if (target < 0) continue;
    positions.set(mesh.positions.subarray(v * 3, v * 3 + 3), target * 3);
    normals.set(mesh.normals.subarray(v * 3, v * 3 + 3), target * 3);
    if (uvs) uvs.set(mesh.uvs.subarray(v * 2, v * 2 + 2), target * 2);
  }
  return { positions, normals, uvs, indices };
}

export const simplifierReady = MeshoptSimplifier.ready;

/** Attribute weights: normals keep hard edges, UVs keep texture seams from sliding. */
const NORMAL_WEIGHT = 0.5;
const UV_WEIGHT = 0.5;

/**
 * Simplifies a mesh towards `targetTriangles` with meshoptimizer: attribute-aware with the mesh
 * border locked first (keeps seams between parts closed); if that stalls above the target, a pass
 * without the border lock, then one allowed to cross attribute seams, then (where allowed) a sloppy
 * pass as the last resort. Fixed options, so deterministic.
 */
export const SIMPLIFY_PASSES = [['LockBorder'], [], ['Permissive']];

export function simplifyMesh(
  mesh,
  targetTriangles,
  { sloppyAllowed = false, passes = SIMPLIFY_PASSES } = {},
) {
  const current = triangleCount(mesh);
  if (targetTriangles >= current) return mesh;
  let work = weldMesh(mesh);
  if (triangleCount(work) <= targetTriangles) return compactMesh(work);
  const stride = mesh.uvs ? 5 : 3;
  const attributes = () => {
    const count = vertexCount(work);
    const data = new Float32Array(count * stride);
    for (let i = 0; i < count; i++) {
      data[i * stride] = work.normals[i * 3];
      data[i * stride + 1] = work.normals[i * 3 + 1];
      data[i * stride + 2] = work.normals[i * 3 + 2];
      if (work.uvs) {
        data[i * stride + 3] = work.uvs[i * 2];
        data[i * stride + 4] = work.uvs[i * 2 + 1];
      }
    }
    return data;
  };
  const weights = mesh.uvs
    ? [NORMAL_WEIGHT, NORMAL_WEIGHT, NORMAL_WEIGHT, UV_WEIGHT, UV_WEIGHT]
    : [NORMAL_WEIGHT, NORMAL_WEIGHT, NORMAL_WEIGHT];
  const target = Math.max(3, Math.floor(targetTriangles) * 3);
  // Faceted sources make every edge an attribute seam; Permissive lets the last pass cross them.
  for (const flags of passes) {
    const [indices] = MeshoptSimplifier.simplifyWithAttributes(
      work.indices,
      work.positions,
      3,
      attributes(),
      stride,
      weights,
      null,
      Math.min(target, work.indices.length),
      1,
      flags,
    );
    work = compactMesh({ ...work, indices: Uint32Array.from(indices) });
    if (indices.length <= target * 1.02) return work;
  }
  if (sloppyAllowed) {
    const [indices] = MeshoptSimplifier.simplifySloppy(
      work.indices,
      work.positions,
      3,
      null,
      Math.min(target, work.indices.length),
      1,
    );
    work = compactMesh({ ...work, indices: Uint32Array.from(indices) });
  }
  return work;
}
