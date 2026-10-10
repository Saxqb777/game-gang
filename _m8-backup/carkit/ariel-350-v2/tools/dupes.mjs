// count exactly duplicated triangles (same positions, any vertex order) per mesh and across meshes
import { loadGLB, THREE, KIT } from './common.mjs';
const g = await loadGLB(process.argv[2] || KIT + 'ariel-350-v2.glb');
const global = new Map(); let tot = 0, dupTot = 0;
g.scene.updateMatrixWorld(true);
const v = new THREE.Vector3();
g.scene.traverse((o) => {
  if (!o.isMesh) return;
  const idx = o.geometry.index.array, pos = o.geometry.attributes.position; let dup = 0; const seen = new Set();
  for (let t = 0; t < idx.length; t += 3) {
    const ks = [0, 1, 2].map((k) => { v.fromBufferAttribute(pos, idx[t + k]).applyMatrix4(o.matrixWorld); return `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`; }).sort().join('|');
    if (seen.has(ks)) dup++; else seen.add(ks);
    global.set(ks, (global.get(ks) || 0) + 1);
  }
  tot += idx.length / 3; dupTot += dup;
  if (dup) console.log(o.name.padEnd(24), 'tris', idx.length / 3, 'dupes within mesh', dup);
});
let cross = 0; for (const c of global.values()) if (c > 1) cross += c - 1;
console.log('total', tot, 'within-mesh dupes', dupTot, 'all dupes (any mesh)', cross);
