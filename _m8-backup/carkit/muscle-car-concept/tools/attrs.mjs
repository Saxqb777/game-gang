import { loadFBX } from './common.mjs';
const root = loadFBX();
const stats = {};
root.traverse((o) => { if (!o.isMesh) return; const c = o.geometry.attributes.color; if (!c) return;
  let mn = [9,9,9], mx = [-9,-9,-9];
  for (let i = 0; i < c.count; i++) for (let k = 0; k < 3; k++) { const v = c.array[i*c.itemSize+k]; mn[k] = Math.min(mn[k], v); mx[k] = Math.max(mx[k], v); }
  stats[o.name] = mn.map(v=>v.toFixed(2)).join('/') + ' .. ' + mx.map(v=>v.toFixed(2)).join('/');
  const u = o.geometry.attributes.uv; let umn=[9,9],umx=[-9,-9]; for (let i=0;i<u.count;i++) for (let k=0;k<2;k++){const v=u.array[i*2+k]; umn[k]=Math.min(umn[k],v); umx[k]=Math.max(umx[k],v);} stats[o.name] += `  uv ${umn.map(v=>v.toFixed(2))}..${umx.map(v=>v.toFixed(2))}`;
});
const vals = Object.entries(stats); vals.slice(0, 200).forEach(([k, v]) => console.log(k, v));
