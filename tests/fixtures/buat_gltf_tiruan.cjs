const fs=require('fs');
// kotak 0.5×0.9×0.5 m bertekstur, dua buffer (posisi+uv di .bin, indeks di data: URI) untuk uji penggabungan
const P=[],N=[],U=[],I=[]; const sx=0.25,sy=0.9,sz=0.25;
const muka=[[[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]];
for(const [n,u,v] of muka){ const b=P.length/3;
  for(const [a,c] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ const p=[0,1,2].map(i=>n[i]*0.5+u[i]*a*0.5+v[i]*c*0.5); P.push(p[0]*2*sx, (p[1]+0.5)*sy, p[2]*2*sz); N.push(...n); U.push((a+1)/2,(1-c)/2); }
  I.push(b,b+1,b+2,b,b+2,b+3); }
const pos=Buffer.from(new Float32Array(P).buffer), nor=Buffer.from(new Float32Array(N).buffer), uv=Buffer.from(new Float32Array(U).buffer), idx=Buffer.from(new Uint16Array(I).buffer);
const bin=Buffer.concat([pos,nor,uv]);
fs.writeFileSync('kursi.bin',bin);
const mn=[-sx,0,-sz], mx=[sx,sy,sz];
const j={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'kursi'}],
 meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3,material:0}]}],
 materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:0.8}}],
 textures:[{source:0}], images:[{uri:'textures/kursi_diff_1k.jpg'}],
 buffers:[{uri:'kursi.bin',byteLength:bin.length},{uri:'data:application/octet-stream;base64,'+idx.toString('base64'),byteLength:idx.length}],
 bufferViews:[{buffer:0,byteOffset:0,byteLength:pos.length},{buffer:0,byteOffset:pos.length,byteLength:nor.length},{buffer:0,byteOffset:pos.length+nor.length,byteLength:uv.length},{buffer:1,byteOffset:0,byteLength:idx.length}],
 accessors:[{bufferView:0,componentType:5126,count:P.length/3,type:'VEC3',min:mn,max:mx},{bufferView:1,componentType:5126,count:N.length/3,type:'VEC3'},{bufferView:2,componentType:5126,count:U.length/2,type:'VEC2'},{bufferView:3,componentType:5123,count:I.length,type:'SCALAR'}]};
fs.writeFileSync('kursi_1k.gltf',JSON.stringify(j));
console.log('ok',bin.length);
