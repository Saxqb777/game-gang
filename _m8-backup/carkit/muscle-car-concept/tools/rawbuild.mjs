// Quick look: whole FBX baked to metres, two original materials, textures injected.
import { loadFBX, THREE, KIT } from './common.mjs';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { injectTextures } from './inject.mjs';
import { writeFileSync } from 'node:fs';
const root = loadFBX();
const scene = new THREE.Scene();
const mats = {};
const S = new THREE.Matrix4().makeScale(0.01, 0.01, 0.01);
root.traverse((o) => {
  if (!o.isMesh || !o.geometry.attributes.uv) return;
  const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(S, o.matrixWorld));
  g.translate(0, -0.2607, 0);
  g.deleteAttribute('color'); g.deleteAttribute('uv1');
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const n = o.material.name; mats[n] ??= new THREE.MeshStandardMaterial({ name: n, metalness: 1, roughness: 1, alphaTest: 0.5, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, mats[n]); m.name = o.name; scene.add(m);
});
const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
const out = injectTextures(glb, {
  Bake: { baseColor: 'A_basecolor_alpha.png', mr: 'A_mr.jpg', normal: 'A_normal.png', emissive: 'A_emissive.jpg' },
  NotBake: { baseColor: 'B_basecolor_alpha.png', mr: 'B_mr.jpg', normal: 'B_normal.png', emissive: 'B_emissive.jpg' },
}, KIT + 'tex');
writeFileSync(KIT + 'work/raw.glb', out); console.log('raw.glb', out.length);
