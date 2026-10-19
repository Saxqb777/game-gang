const fs=require('fs');
const b=fs.readFileSync(process.argv[2]);
const len=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+len).toString());
const nodes=j.nodes;
function walk(i,d){const n=nodes[i];let s='  '.repeat(d)+n.name;if(n.translation)s+=' t='+n.translation.map(v=>v.toFixed(3));if(n.rotation||n.scale||n.matrix)s+=' XFORM';if(n.mesh!==undefined){const m=j.meshes[n.mesh];s+=' mesh['+m.primitives.map(p=>{const mat=j.materials[p.material];const c=j.accessors[p.indices]?.count/3;return mat.name+':'+c}).join(',')+']'}console.log(s);(n.children||[]).forEach(c=>walk(c,d+1))}
j.scenes[0].nodes.forEach(n=>walk(n,0));
for(const m of j.materials){console.log(JSON.stringify(m))}
console.log('images',j.images?.map(i=>i.mimeType+' '+(i.name||'')).join(' | '));
console.log('textures',j.textures?.length,'asset',JSON.stringify(j.asset), 'ext', j.extensionsUsed);
