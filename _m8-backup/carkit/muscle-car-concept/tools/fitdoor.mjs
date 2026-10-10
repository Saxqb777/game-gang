import { THREE } from './common.mjs';
import { splitAll } from './split.mjs';
import { surfacePoints, vertexPoints, Grid, hingeMatrix, score, nelderMead } from './fitlib.mjs';
const comps = splitAll();
const get = (id) => comps.find((c) => c.id === id);
const shell = get('Body12_low#0');
const shellPts = surfacePoints(shell.geo.attributes.position, shell.tris, 1.5);
const grid = new Grid(shellPts, 2);
const door = get('Body12_low#4');
const doorPts = vertexPoints(door.geo.attributes.position, door.tris);
console.log('shell pts', shellPts.length, 'door pts', doorPts.length);
const CAP = +(process.argv[2] || 3);
const mk = (x) => { const axis = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(x[3] * Math.PI / 180, 0, x[4] * Math.PI / 180)); return hingeMatrix(new THREE.Vector3(x[0], 100, x[1]), axis, x[2] * Math.PI / 180); };
const f = (x) => score(doorPts, grid, mk(x), CAP);
let best = { v: 1e9 };
for (let px = 78; px <= 98; px += 4) for (let pz = 62; pz <= 90; pz += 4) for (let a = -84; a <= 84; a += 3) { const v = f([px, pz, a, 0, 0]); if (v < best.v) best = { v, x: [px, pz, a, 0, 0] }; }
console.log('coarse', best);
let r = nelderMead(f, best.x, [2, 2, 2, 1.5, 1.5], 300);
r = nelderMead(f, r.x, [0.7, 0.7, 0.7, 0.5, 0.5], 300);
console.log('refined', JSON.stringify(r.x.map((v) => +v.toFixed(3))), 'score', r.v.toFixed(3));
const m = mk(r.x); const v = new THREE.Vector3(); const hist = [0, 0, 0, 0];
for (const p of doorPts) { v.copy(p).applyMatrix4(m); const d = grid.nearest(v, 10); hist[d < 0.7 ? 0 : d < 1.5 ? 1 : d < 4 ? 2 : 3]++; }
console.log('dist hist <0.7, <1.5, <4, >=4:', hist);
const b = new THREE.Box3(); for (const p of doorPts) b.expandByPoint(v.copy(p).applyMatrix4(m));
console.log('door bbox after', b.min.toArray().map((x) => x.toFixed(1)), b.max.toArray().map((x) => x.toFixed(1)));
