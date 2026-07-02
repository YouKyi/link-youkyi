/* Textures procédurales du fond datacenter (canvas 2D -> CanvasTexture).
   Zéro dépendance hors Three.js. */
import * as THREE from 'three';

export function mulberry32(s){ return function(){ s|=0; s=(s+0x6D2B79F5)|0; let t=Math.imul(s^(s>>>15),1|s); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

export function drawScrew(x, cx, cy){ x.fillStyle='#05060a'; x.beginPath(); x.arc(cx,cy,3,0,6.2831); x.fill(); x.strokeStyle='rgba(255,255,255,0.12)'; x.lineWidth=1; x.beginPath(); x.arc(cx,cy,3,-2.4,-0.6); x.stroke(); }
export function drawUnit(x, ox, oy, w, h, rnd){
  const g=x.createLinearGradient(0,oy,0,oy+h); g.addColorStop(0,'#191d23'); g.addColorStop(0.12,'#12151a'); g.addColorStop(0.5,'#0d1014'); g.addColorStop(1,'#070a0d');
  x.fillStyle=g; x.fillRect(ox,oy,w,h);
  for(let i=0;i<w;i+=2){ x.fillStyle='rgba(255,255,255,'+(0.004+rnd()*0.008).toFixed(3)+')'; x.fillRect(ox+i,oy+2,1,h-4); }
  x.fillStyle='rgba(255,255,255,0.08)'; x.fillRect(ox,oy,w,1.5);
  x.fillStyle='rgba(0,0,0,0.8)'; x.fillRect(ox,oy+h-1.5,w,1.5);
  const cy=oy+h/2;
  x.fillStyle='#0c0e13'; x.fillRect(ox,oy+1,16,h-2); x.fillRect(ox+w-16,oy+1,16,h-2);
  x.fillStyle='rgba(255,255,255,0.06)'; x.fillRect(ox+16,oy+1,1,h-2); x.fillRect(ox+w-17,oy+1,1,h-2);
  drawScrew(x,ox+8,oy+8); drawScrew(x,ox+8,oy+h-8); drawScrew(x,ox+w-8,oy+8); drawScrew(x,ox+w-8,oy+h-8);
  const type=rnd();
  if(type<0.14){
    x.fillStyle='rgba(90,120,170,0.14)'; x.fillRect(ox+20,cy-2,w-80,4);
    const lw=Math.min(46,w*0.18);
    x.fillStyle='#0a1622'; x.fillRect(ox+24,cy-Math.min(8,h/3),lw,Math.min(16,h-8));
    x.fillStyle='rgba(70,160,220,0.55)'; x.fillRect(ox+27,cy-Math.min(5,h/4),lw-6,2);
    x.fillStyle='rgba(70,160,220,0.3)'; x.fillRect(ox+27,cy-1,lw-10,2);
    x.strokeStyle='#454c57'; x.lineWidth=1.5; x.beginPath(); x.arc(ox+w-30,cy,4,0,6.2831); x.stroke();
    x.fillStyle=rnd()<0.6?'#39ff9a':'#37c0ff'; x.beginPath(); x.arc(ox+w-30,cy,1.6,0,6.2831); x.fill();
  } else {
    const gx=ox+22, ventW=w*0.26;
    x.fillStyle='#0b0d12'; x.fillRect(gx,oy+4,ventW,h-8);
    for(let yy=oy+7; yy<oy+h-5; yy+=3.4) for(let xx=gx+2; xx<gx+ventW-2; xx+=3.4){ x.fillStyle='rgba(120,140,170,0.10)'; x.beginPath(); x.arc(xx+(Math.floor((yy-oy)/3.4)%2)*1.7,yy,1.0,0,6.2831); x.fill(); }
    if(type<0.52){
      let dx=gx+ventW+8; const bays=3+Math.floor(rnd()*5); const bw=11, bh=Math.min(h-7,22);
      for(let b=0;b<bays&&dx+bw<ox+w-30;b++){
        const bg=x.createLinearGradient(dx,0,dx+bw,0); bg.addColorStop(0,'#1c2129'); bg.addColorStop(1,'#0c0e13');
        x.fillStyle=bg; x.fillRect(dx,cy-bh/2,bw,bh);
        x.strokeStyle='#3a4250'; x.lineWidth=1; x.strokeRect(dx+0.5,cy-bh/2+0.5,bw-1,bh-1);
        x.fillStyle='#05070b'; x.fillRect(dx+2,cy-bh/2+3,bw-4,3);
        x.fillStyle=rnd()<0.75?'#39ff9a':(rnd()<0.5?'#ffcf4d':'#37c0ff'); x.fillRect(dx+bw-3.5,cy+bh/2-6,2.5,3);
        dx+=bw+3;
      }
    } else {
      let px=gx+ventW+8; const nP=4+Math.floor(rnd()*6); const pw=12, gap=3; const rows=h>26?2:1;
      for(let p=0;p<nP&&px+pw<ox+w-30;p++){
        for(let rr=0;rr<rows;rr++){
          const py=rows===2?cy-10+rr*18:cy-7;
          x.fillStyle='#05060a'; x.fillRect(px,py,pw,13);
          x.strokeStyle='#3a4250'; x.lineWidth=1; x.strokeRect(px+0.5,py+0.5,pw-1,12);
          x.fillStyle='#0c0f15'; x.fillRect(px+2,py+3,pw-4,7);
          x.fillStyle=rnd()<0.55?'#39ff9a':'#ffcf4d'; x.fillRect(px+1.5,py+1,2.5,2);
        }
        px+=pw+gap;
      }
    }
  }
  x.fillStyle='#2c323d'; x.fillRect(ox+w-26,oy+4,18,Math.min(7,h-8));
  x.fillStyle='#11151b'; for(let bi=0;bi<7;bi++) x.fillRect(ox+w-24+bi*2,oy+5,rnd()<0.5?1:0.6,Math.min(5,h-10));
  const ny=1+Math.floor(rnd()*3);
  for(let k=0;k<ny;k++){ const cc=['#39ff9a','#37c0ff','#ffffff','#ffcf4d','#ff5b5b'][Math.floor(rnd()*5)]; x.fillStyle=cc; x.globalAlpha=0.6+rnd()*0.4; x.fillRect(ox+w-24,oy+h-6-k*4,3,2.5); }
  x.globalAlpha=1;
}
// Corps de dessin d'une façade « mesh » (ex-makeRackTexture), sans canvas ni texture :
// dessine en coordonnees 512x1024 dans le contexte fourni (le scale de l'appelant gere la resolution).
function drawRackInto(x, sd){
  const rnd=mulberry32(sd); const W=512,H=1024;
  const bg=x.createLinearGradient(0,0,W,0); bg.addColorStop(0,'#0b0d12'); bg.addColorStop(0.5,'#0f1217'); bg.addColorStop(1,'#090b10'); x.fillStyle=bg; x.fillRect(0,0,W,H);
  for(let yy=22;yy<H-22;yy+=7) for(let xx=42;xx<W-42;xx+=7){ x.fillStyle='rgba(0,0,0,0.6)'; x.beginPath(); x.arc(xx,yy,1.5,0,6.2831); x.fill(); x.fillStyle='rgba(150,170,200,0.05)'; x.fillRect(xx-1,yy-1,1,1); }
  let g1=x.createLinearGradient(0,0,34,0); g1.addColorStop(0,'#30353d'); g1.addColorStop(1,'#13161b'); x.fillStyle=g1; x.fillRect(0,0,30,H);
  let g2=x.createLinearGradient(W-34,0,W,0); g2.addColorStop(0,'#13161b'); g2.addColorStop(1,'#30353d'); x.fillStyle=g2; x.fillRect(W-30,0,30,H);
  for(let s=1;s<3;s++){ const yy=H*s/3; x.fillStyle='rgba(0,0,0,0.65)'; x.fillRect(30,yy-1,W-60,2); x.fillStyle='rgba(255,255,255,0.05)'; x.fillRect(30,yy+1,W-60,1); }
  const hx=rnd()<0.5?52:W-62; x.fillStyle='#20242b'; x.fillRect(hx,H*0.4,10,H*0.2); x.fillStyle='rgba(255,255,255,0.10)'; x.fillRect(hx,H*0.4,2,H*0.2);
}
// Corps de dessin d'une façade « serveur » (ex-makeServerTexture), memes conventions.
function drawServerInto(x, sd){
  const rnd=mulberry32(sd); const W=512,H=1024;
  x.fillStyle='#06080b'; x.fillRect(0,0,W,H);
  let g1=x.createLinearGradient(0,0,28,0); g1.addColorStop(0,'#23272e'); g1.addColorStop(1,'#0c0e12'); x.fillStyle=g1; x.fillRect(0,0,26,H);
  let g2=x.createLinearGradient(W-28,0,W,0); g2.addColorStop(0,'#14171c'); g2.addColorStop(1,'#363c45'); x.fillStyle=g2; x.fillRect(W-26,0,26,H);
  for(let yy=16;yy<H;yy+=46){ drawScrew(x,12,yy); drawScrew(x,W-12,yy); }
  let y=8; while(y<H-8){ const uH=(rnd()<0.16)?(26+rnd()*10):(40+rnd()*60); drawUnit(x,30,y,W-60,Math.min(uH,H-8-y),rnd); y+=uH+3; }
}
// Dessine une façade dans la région (ox, oy, w, h) du contexte partagé.
// Le corps reste en coordonnees 512x1024 : translate + scale gerent l'offset et la resolution de tuile.
function drawFacadeTile(x, ox, oy, w, h, seed, kind){
  x.save(); x.translate(ox, oy); x.scale(w/512, h/1024);
  if (kind === 'mesh') drawRackInto(x, seed);
  else                 drawServerInto(x, seed);
  x.restore();
}
// Atlas de 8 façades (4 colonnes x 2 lignes). Tuile k a l'offset UV ((k%4)/4, 1 - (floor(k/4)+1)/2).
export function makeFacadeAtlas(maxTexSize){
  const big = maxTexSize >= 4096;
  const tw = big ? 1024 : 512, th = big ? 2048 : 1024;   // tuile
  const c = document.createElement('canvas'); c.width = tw*4; c.height = th*2;
  const x = c.getContext('2d');
  const KINDS = ['mesh','mesh','server','server','server','server','server','server'];
  for(let k=0;k<8;k++){
    drawFacadeTile(x, (k%4)*tw, Math.floor(k/4)*th, tw, th, 3000 + k*277, KINDS[k]);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return { texture: t, cols: 4, rows: 2, tiles: 8 };
}
