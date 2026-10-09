/* Textures procédurales, dessinées depuis l'implantation commune aux deux rendus. */
import * as THREE from 'three';
import { RACK, rackLayout, deviceParts, deviceLEDs, mulberry32 } from './dc-layout.mjs';
export { mulberry32 } from './dc-layout.mjs';

export function makeFacadeAtlas(maxTexSize) {
  const tw = maxTexSize >= 3072 ? 512 : 256, th = tw * 3;
  const c = document.createElement('canvas'); c.width = tw * 4; c.height = th * 2;
  const ctx = c.getContext('2d');
  for (let v = 0; v < 8; v++) {
    ctx.save(); ctx.translate((v % 4) * tw, Math.floor(v / 4) * th); ctx.scale(tw / 512, th / 1536);
    const X = x => 256 + x * 512 / RACK.width, Y = y => 1536 - y * 1536 / RACK.height;
    const rect = (x, y, w, h, color) => {
      ctx.fillStyle = color; ctx.fillRect(X(x - w / 2), Y(y + h / 2), w * 512 / RACK.width, h * 1536 / RACK.height);
    };
    ctx.fillStyle = '#0c1118'; ctx.fillRect(0, 0, 512, 1536);
    for (const d of rackLayout(v)) {
      const networkSwitch=d.kind==='switch';
      const top=Y(d.y+d.height/2),bottom=Y(d.y-d.height/2);
      const g=ctx.createLinearGradient(0,top,0,bottom);
      g.addColorStop(0,networkSwitch?'#e0e5e8':d.kind==='blank'?'#30353a':'#5b6165');
      g.addColorStop(0.08,networkSwitch?'#b5bfc7':d.kind==='blank'?'#22272c':'#343a3f');
      g.addColorStop(0.94,networkSwitch?'#87939d':'#232a2e');g.addColorStop(1,networkSwitch?'#505d67':'#141a1e');
      rect(0,d.y,RACK.deviceWidth,d.height,g);
      const parts=deviceParts(d);
      parts.forEach((part,index)=>{
        rect(part.x,part.y,part.w+0.002,part.h+0.002,'#05090c');
        rect(part.x,part.y,part.w,part.h,part.kind==='port'?'#080d10':'#20272b');
        if(part.kind==='drive') {
          const vertical=part.format==='sff';
          rect(part.x,part.y+part.h*0.34,part.w*0.75,vertical?0.006:0.004,'#536066');
          rect(part.x-part.w*0.22,part.y,vertical?0.003:part.w*0.54,vertical?part.h*0.65:0.007,'#30383d');
          // Grille de la cartouche et étiquette, éclairage réel confié au matériau et aux LED.
          for(let q=0;q<(vertical?8:5);q++) {
            if(vertical) rect(part.x+part.w*0.19,part.y-part.h*0.18+q*0.0036,part.w*0.26,0.0015,'#080e11');
            else rect(part.x-part.w*0.14+q*part.w*0.11,part.y-part.h*0.25,part.w*0.055,0.0025,'#080e11');
          }
          ctx.font='5px ui-monospace,monospace';ctx.fillStyle='#b3babc';
          ctx.fillText(vertical?String(index+1).padStart(2,'0'):'SAS  /  '+String(index+1).padStart(2,'0'),X(part.x-part.w*0.30),Y(part.y+part.h*0.28));
        } else {
          rect(part.x,part.y,part.w*0.76,part.h*0.67,'#020507');
          rect(part.x,part.y-part.h*0.32,part.w*0.40,0.0012,'#8b805f');
          for(let q=0;q<4;q++) rect(part.x+(q-1.5)*0.0016,part.y+part.h*0.19,0.0006,0.002,'#817b60');
          if(d.kind==='patch') {
            rect(part.x,d.y+0.011,part.w,0.006,'#9da2a0');
            ctx.font='5px ui-monospace,monospace';ctx.fillStyle='#202629';
            ctx.fillText(String(index+1),X(part.x-0.004),Y(d.y+0.009));
          }
        }
      });
      if(networkSwitch){
        const compact=d.family==='switch24',x=compact?-0.184:-0.206,w=compact?0.030:0.017;
        rect(x,d.y,w,0.027,'#121b22');rect(x,d.y,w-0.004,0.022,'#122f42');
        ctx.font='600 5px ui-monospace,monospace';ctx.fillStyle='#89cde9';
        ctx.fillText('SW',X(x-0.006),Y(d.y+0.003));ctx.fillText(compact?'24':'48',X(x-0.006),Y(d.y-0.005));
      }
      if(d.family==='sff8'||d.family==='sff16') {
        const start=d.family==='sff8'?-0.055:0.089,width=0.206-start;
        for(let field=0;field<2;field++) {
          const left=start+width*field/2+0.004,right=start+width*(field+1)/2-0.004;
          rect((left+right)/2,d.y,right-left,d.height-0.014,'#3b4347');
          ctx.fillStyle='#0a1013';
          let row=0;
          for(let y=d.y-d.height/2+0.010;y<d.y+d.height/2-0.008;y+=0.0045,row++)
            for(let x=left+0.003+(row%2)*0.0025;x<right-0.002;x+=0.005) {
              ctx.beginPath();
              for(let q=0;q<6;q++) {const a=q*Math.PI/3;const px=X(x+Math.cos(a)*0.0021),py=Y(y+Math.sin(a)*0.0021);q?ctx.lineTo(px,py):ctx.moveTo(px,py);}
              ctx.closePath();ctx.fill();
            }
        }
      }
      for(const led of deviceLEDs(d)) rect(led.x,led.y,0.0035,0.0026,'#020609');
      if(d.kind!=='blank') {
        rect(0.216,d.y-d.height*0.23,0.006,0.004,'#020508');
        rect(0.216,d.y-d.height*0.23,0.0045,0.001,'#647681');
      }
      for(const side of [-1,1]) {
        rect(side*0.2325,d.y,0.0176,d.height,networkSwitch?'#a6b0b7':'#3e464c');
        for(const sign of [-1,1]) {
          ctx.fillStyle='#7e878b';ctx.beginPath();ctx.arc(X(side*0.2325),Y(d.y+sign*d.height*0.31),1.6,0,Math.PI*2);ctx.fill();
          rect(side*0.2325,d.y+sign*d.height*0.31,0.0025,0.0007,'#101518');
        }
      }
    }
    ctx.fillStyle = '#202a37'; ctx.fillRect(16, 16, 480, 34);
    ctx.font = '600 15px ui-monospace, monospace'; ctx.fillStyle = '#c4ced9';
    ctx.fillText('YK / ' + String(v + 1).padStart(2, '0'), 34, 39);
    ctx.fillStyle = '#778391'; ctx.fillRect(365, 25, 104, 10);
    const rnd = mulberry32(v + 44);
    for (let q = 0; q < 38; q++) { ctx.fillStyle = '#1d2630'; ctx.fillRect(368 + q * 2.5, 25, rnd() < 0.5 ? 1 : 2, 10); }
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 16;
  return { texture, cols: 4, rows: 2, tiles: 8 };
}

export function makeFloorTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const x = c.getContext('2d'), rnd = mulberry32(47);
  x.fillStyle = '#28313c'; x.fillRect(0, 0, 1024, 1024);
  // Dalles de 60 cm, nuances de matériau et joints fins.
  const size = 128;
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const value = 35 + Math.floor(rnd() * 7);
    x.fillStyle = `rgb(${value},${value+8},${value+18})`;
    x.fillRect(col * size + 1, row * size + 1, size - 2, size - 2);
    x.fillStyle = 'rgba(158,177,198,0.10)'; x.fillRect(col * size + 2, row * size + 2, size - 4, 1);
    x.fillStyle = '#101720'; x.fillRect(col * size, row * size, size, 1);
    // Dalles d'aération en bord d'allée.
    if (col === 2 || col === 5) for (let k = 0; k < 12; k++) {
      x.fillStyle = 'rgba(10,16,24,0.65)'; x.fillRect(col * size + 12, row * size + 12 + k * 8, 104, 3);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// Texture de chemin de câbles : grille métallique (tôle perforée), répétée en X et Z.
export function makeTrayTexture(){
  const c=document.createElement('canvas'); c.width=64; c.height=256;
  const x=c.getContext('2d');
  x.fillStyle='#0b0d11'; x.fillRect(0,0,64,256);
  x.strokeStyle='rgba(140,150,175,0.16)'; x.lineWidth=2;
  for(let z=0; z<256; z+=16){ x.beginPath(); x.moveTo(4,z); x.lineTo(60,z); x.stroke(); }
  x.strokeStyle='rgba(140,150,175,0.22)';
  x.beginPath(); x.moveTo(4,0); x.lineTo(4,256); x.stroke();
  x.beginPath(); x.moveTo(60,0); x.lineTo(60,256); x.stroke();
  const t=new THREE.CanvasTexture(c);
  t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.RepeatWrapping;
  return t;
}
