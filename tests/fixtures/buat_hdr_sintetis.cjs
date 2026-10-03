// panorama sintetis: langit gradasi, matahari di (u=0.25, elevasi 35°), gunung, tanah hijau
const fs=require('fs');
function rgbe(r,g,b){ const m=Math.max(r,g,b); if(m<1e-32) return [0,0,0,0]; const e=Math.floor(Math.log2(m))+1, s=256/2**e; return [Math.min(255,r*s|0),Math.min(255,g*s|0),Math.min(255,b*s|0),e+128]; }
function tulis(nama,w,h,f){
  const head=Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`,'ascii'); const parts=[head];
  for(let y=0;y<h;y++){ const ch=[[],[],[],[]];
    for(let x=0;x<w;x++){ const px=rgbe(...f((x+0.5)/w,(y+0.5)/h)); for(let c=0;c<4;c++) ch[c].push(px[c]); }
    const out=[2,2,w>>8,w&255];
    for(let c=0;c<4;c++){ const a=ch[c]; let i=0;
      while(i<w){ let r=1; while(i+r<w && r<127 && a[i+r]===a[i]) r++;
        if(r>=4){ out.push(128+r,a[i]); i+=r; continue; }
        let j=i, n=0; while(j<w && n<128){ let rr=1; while(j+rr<w&&rr<4&&a[j+rr]===a[j]) rr++; if(rr>=4) break; j++; n++; }
        out.push(n); for(let k=0;k<n;k++) out.push(a[i+k]); i+=n; } }
    parts.push(Buffer.from(out)); }
  fs.writeFileSync(nama,Buffer.concat(parts));
}
const SU=0.25, SE=35*Math.PI/180;
function pano(sunCol,skyTop,skyHor,ground,kuat){ return (u,v)=>{
  const th=v*Math.PI, ph=(u-0.5)*2*Math.PI, d=[Math.cos(ph)*Math.sin(th),Math.cos(th),Math.sin(ph)*Math.sin(th)];
  const sp=(SU-0.5)*2*Math.PI, s=[Math.cos(sp)*Math.cos(SE),Math.sin(SE),Math.sin(sp)*Math.cos(SE)];
  const mu=d[0]*s[0]+d[1]*s[1]+d[2]*s[2];
  const lat=Math.PI/2-th, gunung=0.06+0.05*Math.sin(u*Math.PI*14)+0.03*Math.sin(u*Math.PI*37);
  if(lat<0) return ground.map(c=>c*(0.6+0.4*Math.exp(lat*4)));
  if(lat<gunung) return [0.05,0.07,0.06];
  const t=Math.pow(Math.min(1,lat/(Math.PI/2)),0.5);
  let c=skyHor.map((h,i)=>h*(1-t)+skyTop[i]*t);
  if(mu>Math.cos(0.6*Math.PI/180)) c=sunCol.map(x=>x*kuat);
  else c=c.map((x,i)=>x+sunCol[i]*0.3*Math.pow(Math.max(mu,0),40));
  return c; }; }
tulis('siang.hdr',1024,512,pano([1,0.95,0.85],[0.25,0.45,0.9],[0.8,0.85,0.9],[0.15,0.2,0.08],20000));
tulis('malam.hdr',512,256,pano([0.6,0.7,1],[0.005,0.008,0.02],[0.02,0.025,0.04],[0.005,0.006,0.004],50));
console.log(fs.statSync('siang.hdr').size, fs.statSync('malam.hdr').size);
