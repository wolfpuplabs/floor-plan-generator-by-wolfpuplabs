/* Plan23D — SALURAN TV BAWAAN (JEV-065), dipindah dari index.html (JEV-123): empat tayangan digambar langsung di kanvas
   320×180 tiap bingkai — tanpa berkas & tanpa lisensi. Dimuat saat TV pertama menyala. */
(function () {
  'use strict';
  window.KANAL_TV = {
  senja:{l:'Senja di pantai', gambar:(c,w,h,t)=>{
    const g=c.createLinearGradient(0,0,0,h*0.62); g.addColorStop(0,'#2a2550'); g.addColorStop(0.55,'#e0705a'); g.addColorStop(1,'#ffc77a');
    c.fillStyle=g; c.fillRect(0,0,w,h*0.62);
    const sy=h*0.5+Math.sin(t*0.05)*h*0.04; c.fillStyle='#fff1c8'; c.beginPath(); c.arc(w*0.62,sy,h*0.11,0,Math.PI*2); c.fill();
    const l=c.createLinearGradient(0,h*0.6,0,h); l.addColorStop(0,'#c45d4f'); l.addColorStop(1,'#1d2340'); c.fillStyle=l; c.fillRect(0,h*0.6,w,h*0.4);
    for(let i=0;i<26;i++){ const y=h*0.62+i*i*0.28, a=0.55-i*0.018; c.strokeStyle=`rgba(255,214,160,${Math.max(0,a)})`; c.lineWidth=1+i*0.08; c.beginPath();
      for(let x=0;x<=w;x+=6){ const yy=y+Math.sin(x*0.035+t*(1.2+i*0.05)+i)*(1+i*0.25); x?c.lineTo(x,yy):c.moveTo(x,yy); } c.stroke(); }
    c.fillStyle='rgba(255,240,200,0.5)'; for(let i=0;i<14;i++){ const x=w*0.62+Math.sin(t*2+i*7)*w*0.05*(i%4+1), y=h*0.64+i*h*0.024; c.fillRect(x-8+i,y,16-i*0.5,1.5); }
    c.fillStyle='#14182c'; for(let i=0;i<3;i++){ const x=(t*14+i*140)%(w+80)-40, y=h*0.3-i*12+Math.sin(t*3+i)*3;
      c.beginPath(); c.moveTo(x-7,y); c.quadraticCurveTo(x-3,y-4,x,y); c.quadraticCurveTo(x+3,y-4,x+7,y); c.lineWidth=1.6; c.strokeStyle='#14182c'; c.stroke(); } }},
  akuarium:{l:'Akuarium', gambar:(c,w,h,t)=>{
    const g=c.createLinearGradient(0,0,0,h); g.addColorStop(0,'#0f6f8f'); g.addColorStop(1,'#06223a'); c.fillStyle=g; c.fillRect(0,0,w,h);
    for(let i=0;i<5;i++){ c.fillStyle=`rgba(180,240,255,${0.05+0.03*Math.sin(t+i)})`; c.beginPath(); const x=w*(0.1+i*0.22)+Math.sin(t*0.4+i)*20;
      c.moveTo(x,0); c.lineTo(x+40,0); c.lineTo(x+90,h); c.lineTo(x+20,h); c.fill(); }
    c.fillStyle='#c8b48a'; c.beginPath(); c.moveTo(0,h); for(let x=0;x<=w;x+=20) c.lineTo(x,h*0.88+Math.sin(x*0.05)*5); c.lineTo(w,h); c.fill();
    for(let i=0;i<9;i++){ const x=20+i*w/9; c.strokeStyle=i%2?'#2f8a4a':'#3fa35a'; c.lineWidth=5; c.beginPath(); c.moveTo(x,h);
      for(let k=1;k<=8;k++) c.lineTo(x+Math.sin(t*1.5+k*0.6+i)*6*k/8,h-k*h*0.06*(0.7+(i%3)*0.2)); c.stroke(); }
    const ikan=[['#ff8a3a',0.3,1],['#ffd23a',0.5,-1],['#3ad1ff',0.42,1],['#ff5aa0',0.66,-1],['#ffffff',0.22,-1],['#ff8a3a',0.75,1]];
    ikan.forEach(([warna,yy,arah],i)=>{ const sp=18+i*5, x=arah>0?(t*sp+i*90)%(w+60)-30:w+30-((t*sp+i*90)%(w+60)), y=h*yy+Math.sin(t*2+i)*6, s=7+i%3*3;
      c.save(); c.translate(x,y); c.scale(arah,1); c.fillStyle=warna; c.beginPath(); c.ellipse(0,0,s*1.6,s,0,0,Math.PI*2); c.fill();
      c.beginPath(); c.moveTo(-s*1.4,0); c.lineTo(-s*2.6,-s*(0.8+0.3*Math.sin(t*9+i))); c.lineTo(-s*2.6,s*(0.8+0.3*Math.sin(t*9+i))); c.fill();
      c.fillStyle='#111'; c.beginPath(); c.arc(s*0.9,-s*0.2,1.6,0,Math.PI*2); c.fill(); c.restore(); });
    c.fillStyle='rgba(220,250,255,0.7)'; for(let i=0;i<16;i++){ const x=w*0.85+Math.sin(t*2+i)*6+(i%3)*8, y=h-((t*40+i*23)%h); c.beginPath(); c.arc(x,y,1.5+(i%3),0,Math.PI*2); c.fill(); } }},
  kota:{l:'Kota malam berhujan', gambar:(c,w,h,t)=>{
    const g=c.createLinearGradient(0,0,0,h); g.addColorStop(0,'#090b1c'); g.addColorStop(1,'#2a2140'); c.fillStyle=g; c.fillRect(0,0,w,h);
    const kilat=(Math.sin(t*0.7)>0.995)||(t%13<0.08); if(kilat){ c.fillStyle='rgba(200,210,255,0.25)'; c.fillRect(0,0,w,h); }
    for(let i=0;i<14;i++){ const bw=24+(i*37)%30, bh=h*(0.3+((i*53)%40)/100), x=i*w/13-10;
      c.fillStyle=`hsl(${230+i*3},25%,${10+i%3*3}%)`; c.fillRect(x,h-bh,bw,bh);
      for(let yy=h-bh+6;yy<h-8;yy+=9) for(let xx=x+4;xx<x+bw-4;xx+=7){ const n=Math.sin(xx*12.9+yy*78.2+i)*43758.5; if((n-Math.floor(n))>0.55+0.1*Math.sin(t*0.3+xx)){ c.fillStyle='#ffd88a'; c.fillRect(xx,yy,3,4); } } }
    c.strokeStyle='rgba(180,200,255,0.35)'; c.lineWidth=1; c.beginPath();
    for(let i=0;i<120;i++){ const x=(i*97.3+t*60)%w, y=(i*53.7+t*420)%h; c.moveTo(x,y); c.lineTo(x-3,y+12); } c.stroke();
    c.fillStyle='rgba(255,90,90,0.8)'; c.fillRect(((t*50)%(w+40))-20,h*0.93,6,3); c.fillStyle='rgba(255,250,210,0.9)'; c.fillRect(w-((t*70)%(w+40))+20,h*0.95,6,3); }},
  aurora:{l:'Aurora', gambar:(c,w,h,t)=>{
    c.fillStyle='#030814'; c.fillRect(0,0,w,h);
    for(let i=0;i<60;i++){ const n=Math.sin(i*91.7)*43758.5, f=n-Math.floor(n); c.fillStyle=`rgba(255,255,255,${0.3+0.5*Math.abs(Math.sin(t*2+i))})`; c.fillRect(f*w,((i*37)%60)/100*h*0.7,1.5,1.5); }
    c.globalCompositeOperation='lighter';
    for(let b=0;b<3;b++){ for(let x=0;x<w;x+=3){ const y=h*(0.3+b*0.08)+Math.sin(x*0.012+t*0.6+b)*h*0.08+Math.sin(x*0.03-t*0.9)*h*0.03;
      const tinggi=h*(0.18+0.1*Math.sin(x*0.02+t+b)); const g=c.createLinearGradient(0,y-tinggi,0,y);
      g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(0.7,b===1?'rgba(170,80,255,0.3)':'rgba(60,255,160,0.36)'); g.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=g; c.fillRect(x,y-tinggi,3,tinggi); } }
    c.globalCompositeOperation='source-over';
    c.fillStyle='#050a12'; c.beginPath(); c.moveTo(0,h); for(let x=0;x<=w;x+=10) c.lineTo(x,h*0.78-Math.abs(Math.sin(x*0.013))*h*0.18-Math.sin(x*0.05)*6); c.lineTo(w,h); c.fill();
    c.fillStyle='#0b1a24'; c.fillRect(0,h*0.92,w,h*0.08); }}
  };
})();
