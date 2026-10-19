const fs=require('fs');const path=require('path');
const f=process.argv[2], out=process.argv[3];fs.mkdirSync(out,{recursive:true});
const b=fs.readFileSync(f);const len=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+len).toString());
const binStart=20+len+8;
j.images.forEach((im,i)=>{const bv=j.bufferViews[im.bufferView];const data=b.slice(binStart+(bv.byteOffset||0),binStart+(bv.byteOffset||0)+bv.byteLength);fs.writeFileSync(path.join(out,i+'_'+im.name+(im.mimeType==='image/png'?'.png':'.jpg')),data)});
