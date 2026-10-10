import { THREE, loadFBX, FIX, sampler } from './common.mjs';
const root = loadFBX(); let body; root.traverse(o => { if (o.name === 'car_body') body = o; });
const g = body.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(FIX, body.matrixWorld));
const pos = g.attributes.position, uv = g.attributes.uv; const alb = sampler('albedo'), spec = sampler('spec');
for (const side of [-1, 1]) {
  const hist = {}; let n = 0;
  for (let t = 0; t < pos.count / 3; t++) {
    let x = 0, y = 0, z = 0, u = 0, v = 0;
    for (let k = 0; k < 3; k++) { x += pos.getX(3*t+k)/3; y += pos.getY(3*t+k)/3; z += pos.getZ(3*t+k)/3; u += uv.getX(3*t+k)/3; v += uv.getY(3*t+k)/3; }
    if (Math.abs(x - side * 0.9) < 0.15 && y > 0.75 && y < 1.0 && z > 0.55 && z < 0.85) {
      n++; const s = spec(u, v), a = alb(u, v); const k = `a${Math.round(a[0]/32)} s${s.map(c=>Math.round(c/32)).join('')}`; hist[k] = (hist[k] || 0) + 1;
    }
  }
  console.log('side', side, n, Object.entries(hist).sort((a,b)=>b[1]-a[1]).slice(0,8));
}
