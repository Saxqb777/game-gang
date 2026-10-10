// tiny CPU z-buffer rasteriser for quick looks while the browser lock is busy
// usage: node softrender.mjs out.ppm dirx diry dirz [W H] [zoom] [targetx targety targetz]
import { loadGLB, THREE, KIT } from './common.mjs';
import { writeFileSync } from 'node:fs';
const [out, dx, dy, dz, Wa, Ha, zoomA, tx, ty, tz] = process.argv.slice(2);
const W = +Wa || 1200, H = +Ha || 700, zoom = +zoomA || 1;
const g = await loadGLB(process.env.GLB || KIT + 'ariel-350-v2.glb');
const s = g.scene; s.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(s, true); const ctr = box.getCenter(new THREE.Vector3()); const R = box.getSize(new THREE.Vector3()).length() / 2;
const target = tx !== undefined ? new THREE.Vector3(+tx, +ty, +tz) : ctr;
const dir = new THREE.Vector3(+dx, +dy, +dz).normalize();
const cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 100);
cam.position.copy(target).addScaledVector(dir, R / Math.sin(THREE.MathUtils.degToRad(15)) * 0.62 / zoom); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
const zb = new Float32Array(W * H).fill(Infinity); const img = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) { const y = Math.floor(i / W); const t = y / H; img[i * 3] = img[i * 3 + 1] = img[i * 3 + 2] = 200 - 30 * t; }
const L1 = new THREE.Vector3(0.5, 1, 0.6).normalize(), L2 = new THREE.Vector3(-0.6, 0.4, -0.5).normalize();
const p = [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()]; const wv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), view = new THREE.Vector3();
s.traverse((o) => {
  if (!o.isMesh || !o.visible) return;
  const m = o.material; if (process.env.HIDE && process.env.HIDE.split(',').some((h) => m.name === h || o.name.startsWith(h) || o.parent.name.startsWith(h))) return;
  const col = m.color.clone().convertLinearToSRGB(); const glass = m.transparent; const emis = m.emissive && m.emissive.getHex() ? m.emissive.clone().convertLinearToSRGB() : null;
  const pos = o.geometry.attributes.position, idx = o.geometry.index.array;
  for (let t = 0; t < idx.length; t += 3) {
    for (let k = 0; k < 3; k++) { wv[k].fromBufferAttribute(pos, idx[t + k]).applyMatrix4(o.matrixWorld); p[k].set(wv[k].x, wv[k].y, wv[k].z, 1).applyMatrix4(vp); }
    if (p[0].w <= 0 || p[1].w <= 0 || p[2].w <= 0) continue;
    const sx = p.map((q) => (q.x / q.w * 0.5 + 0.5) * W), sy = p.map((q) => (1 - (q.y / q.w * 0.5 + 0.5)) * H), sz = p.map((q) => q.z / q.w);
    e1.subVectors(wv[1], wv[0]); e2.subVectors(wv[2], wv[0]); n.crossVectors(e1, e2).normalize();
    view.subVectors(cam.position, wv[0]).normalize(); if (n.dot(view) < 0) n.negate();
    let shade = 0.25 + 0.6 * Math.max(0, n.dot(L1)) + 0.25 * Math.max(0, n.dot(L2));
    const spec = Math.pow(Math.max(0, n.dot(new THREE.Vector3().addVectors(L1, view).normalize())), 40) * (1 - (m.roughness ?? 0.5)) * 1.2;
    let c = [col.r, col.g, col.b].map((v) => Math.min(1, Math.max(0.03, v) * shade + spec));
    if (emis) c = [emis.r, emis.g, emis.b].map((v, i) => Math.min(1, 0.4 * v + c[i]));
    const x0 = Math.max(0, Math.floor(Math.min(...sx))), x1 = Math.min(W - 1, Math.ceil(Math.max(...sx)));
    const y0 = Math.max(0, Math.floor(Math.min(...sy))), y1 = Math.min(H - 1, Math.ceil(Math.max(...sy)));
    const area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]); if (Math.abs(area) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((sx[1] - px) * (sy[2] - py) - (sx[2] - px) * (sy[1] - py)) / area;
      const w1 = ((sx[2] - px) * (sy[0] - py) - (sx[0] - px) * (sy[2] - py)) / area;
      const w2 = 1 - w0 - w1; if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * sz[0] + w1 * sz[1] + w2 * sz[2]; const i = y * W + x;
      if (glass) { if (z < zb[i]) for (let k = 0; k < 3; k++) img[i * 3 + k] = img[i * 3 + k] * 0.6 + 255 * (c[k] * 0.4 + spec * 0.3); continue; }
      if (z < zb[i]) { zb[i] = z; img[i * 3] = c[0] * 255; img[i * 3 + 1] = c[1] * 255; img[i * 3 + 2] = c[2] * 255; }
    }
  }
});
writeFileSync(out, Buffer.concat([Buffer.from(`P6 ${W} ${H} 255\n`), Buffer.from(img)]));
