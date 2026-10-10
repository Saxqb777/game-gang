// usage: node fitpanel.mjs <compId> <axis x|y> <p1min,p1max,step> <p2min,p2max,step> <amin,amax,step> [cap]
// axis y: pivot params are (x, z); axis x: pivot params are (y, z).
import { THREE } from './common.mjs';
import { splitAll } from './split.mjs';
import { surfacePoints, vertexPoints, Grid, hingeMatrix, score, nelderMead } from './fitlib.mjs';
const [id, ax, r1, r2, ra, capArg] = process.argv.slice(2);
const comps = splitAll();
const get = (id) => comps.find((c) => c.id === id);
const shell = get('Body12_low#0');
const grid = new Grid(surfacePoints(shell.geo.attributes.position, shell.tris, 1.5), 2);
const panel = get(id);
const pts = vertexPoints(panel.geo.attributes.position, panel.tris);
const CAP = +(capArg || 3);
const base = ax === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
const mk = (x) => { const axis = base.clone().applyEuler(new THREE.Euler(ax === 'y' ? x[3] * Math.PI / 180 : 0, ax === 'x' ? x[3] * Math.PI / 180 : 0, x[4] * Math.PI / 180));
  const piv = ax === 'y' ? new THREE.Vector3(x[0], 100, x[1]) : new THREE.Vector3(0, x[0], x[1]); return hingeMatrix(piv, axis, x[2] * Math.PI / 180); };
const f = (x) => score(pts, grid, mk(x), CAP);
const rng = (s) => { const [a, b, st] = s.split(',').map(Number); const o = []; for (let v = a; v <= b + 1e-9; v += st) o.push(v); return o; };
let best = { v: 1e9 };
for (const p1 of rng(r1)) for (const p2 of rng(r2)) for (const a of rng(ra)) { const v = f([p1, p2, a, 0, 0]); if (v < best.v) best = { v, x: [p1, p2, a, 0, 0] }; }
console.log('coarse', JSON.stringify(best));
let r = nelderMead(f, best.x, [2, 2, 2, 1.5, 1.5], 300);
r = nelderMead(f, r.x, [0.7, 0.7, 0.7, 0.5, 0.5], 300);
console.log('refined', JSON.stringify(r.x.map((v) => +v.toFixed(3))), 'score', r.v.toFixed(3));
const m = mk(r.x); const v = new THREE.Vector3(); const hist = [0, 0, 0, 0];
for (const p of pts) { v.copy(p).applyMatrix4(m); const d = grid.nearest(v, 10); hist[d < 0.7 ? 0 : d < 1.5 ? 1 : d < 4 ? 2 : 3]++; }
console.log('pts', pts.length, 'dist hist <0.7, <1.5, <4, >=4:', hist);
const b = new THREE.Box3(); for (const p of pts) b.expandByPoint(v.copy(p).applyMatrix4(m));
console.log('bbox after', b.min.toArray().map((x) => x.toFixed(1)), b.max.toArray().map((x) => x.toFixed(1)));
console.log('MATRIX', JSON.stringify(m.elements.map((x) => +x.toFixed(6))));
