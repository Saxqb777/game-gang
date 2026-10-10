// estimate LOD triangle counts with meshoptimizer (absolute error in metres), per group
import { loadGLB, THREE, KIT } from './common.mjs';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier as MS } from '/home/user/game-gang/node_modules/.pnpm/meshoptimizer@1.1.1/node_modules/meshoptimizer/index.js';
await MS.ready;
const g = await loadGLB(KIT + 'ariel-350-v2.glb'); g.scene.updateMatrixWorld(true);
const LODS = [['LOD0', 0.0005, []], ['LOD1', 0.002, []], ['LOD2', 0.008, ['Prune']], ['LOD3', 0.03, ['Prune']]];
const table = {}; const cfgs = (process.env.SKIP || '').split(',');
g.scene.traverse((o) => {
  if (!o.isMesh) return;
  const p = new THREE.BufferGeometry(); p.setAttribute('position', o.geometry.attributes.position.clone()); p.setIndex(o.geometry.index.clone());
  const w = mergeVertices(p, 1e-5);
  const pos = new Float32Array(w.attributes.position.array); const idx = new Uint32Array(w.index.array);
  const grp = o.parent.name.startsWith('wheel_') ? 'wheels(4)' : o.parent.name.startsWith('brake_') ? 'brakes(4)' : o.parent.name;
  const row = (table[grp] ??= { src: 0, LOD0: 0, LOD1: 0, LOD2: 0, LOD3: 0 }); row.src += idx.length / 3;
  for (const [name, err, flags] of LODS) {
    const [out] = MS.simplify(idx, pos, 3, 0, err, ['ErrorAbsolute', ...flags]);
    row[name] += out.length / 3;
  }
});
let tot = { src: 0, LOD0: 0, LOD1: 0, LOD2: 0, LOD3: 0 };
for (const [k, r] of Object.entries(table)) { console.log(k.padEnd(10), JSON.stringify(r)); for (const c in tot) tot[c] += r[c]; }
console.log('TOTAL'.padEnd(10), JSON.stringify(tot));
