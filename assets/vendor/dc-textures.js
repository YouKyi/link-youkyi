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
// Porte grillagée : perforations hexagonales en quinconce + lueurs de LED derrière.
// Le motif percé se dessine sur un canvas offscreen (tôle sombre pleine, percée en
// destination-out) puis est plaqué par-dessus les lueurs en source-over, pour ne
// jamais percer le fond de tuile ni les dégradés déjà posés dans le contexte partagé.
function drawHexDoor(x, seed){
  const rnd = mulberry32(seed);
  x.fillStyle = '#0a0c10'; x.fillRect(0, 0, 512, 1024);
  // lueurs diffuses derrière la grille (LED des serveurs devinées au travers)
  for(let i=0;i<26;i++){
    const gx = 60+rnd()*392, gy = 40+rnd()*944;
    const cols = ['57,255,154','55,192,255','201,160,255','255,207,77'];
    const cc = cols[Math.floor(rnd()*cols.length)];
    const g = x.createRadialGradient(gx,gy,0,gx,gy,14+rnd()*22);
    g.addColorStop(0, `rgba(${cc},${0.10+rnd()*0.12})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(gx-36,gy-36,72,72);
  }
  // grille : hexagones percés, dessinés sur le canvas offscreen dédié
  const off = document.createElement('canvas'); off.width = 512; off.height = 1024;
  const o = off.getContext('2d');
  o.fillStyle = 'rgba(16,19,26,0.92)'; o.fillRect(0, 0, 512, 1024);
  const rHex = 5.2, dx = rHex*1.9, dy = rHex*1.65;
  for(let row=0, yy=14; yy<1010; row++, yy+=dy){
    for(let xx=14+(row%2)*dx/2; xx<500; xx+=dx){
      o.beginPath();
      for(let a=0;a<6;a++){ const t=Math.PI/6 + a*Math.PI/3;
        o[a?'lineTo':'moveTo'](xx+Math.cos(t)*rHex, yy+Math.sin(t)*rHex); }
      o.closePath();
      o.globalCompositeOperation='destination-out'; o.globalAlpha=0.85; o.fill();
      o.globalCompositeOperation='source-over'; o.globalAlpha=1;
      o.strokeStyle='rgba(120,130,150,0.10)'; o.lineWidth=0.8; o.stroke();
    }
  }
  x.drawImage(off, 0, 0);
  x.fillStyle='rgba(255,255,255,0.05)'; x.fillRect(0,0,512,3);
  x.fillStyle='rgba(0,0,0,0.75)'; x.fillRect(0,1021,512,3);
  drawScrew(x,14,14); drawScrew(x,498,14); drawScrew(x,14,1010); drawScrew(x,498,1010);
  bakeAO(x);
}
// Arcs de câbles patch entre deux points (panneau de brassage).
function drawPatchCables(x, rnd, y0, y1){
  const COLORS = ['#7c3aed','#8b5cf6','#39ff9a','#37c0ff','#ffcf4d','#e8e8ee'];
  const n = 8 + Math.floor(rnd()*10);
  for(let i=0;i<n;i++){
    const xa = 46+rnd()*180, xb = 280+rnd()*180;
    const ya = y0+rnd()*(y1-y0), yb = y0+rnd()*(y1-y0);
    const sag = 22+rnd()*46;
    x.strokeStyle = COLORS[Math.floor(rnd()*COLORS.length)];
    x.globalAlpha = 0.5+rnd()*0.4; x.lineWidth = 2.4;
    x.beginPath(); x.moveTo(xa,ya);
    x.bezierCurveTo(xa+18, ya+sag, xb-18, yb+sag, xb, yb); x.stroke();
    x.globalAlpha = 1;
  }
}
// Étiquette d'inventaire (petit rectangle + pseudo code-barres + texte).
function drawLabel(x, rnd, lx, ly){
  x.fillStyle='rgba(226,229,236,0.80)'; x.fillRect(lx,ly,44,14);
  x.fillStyle='#0a0c10';
  for(let i=0;i<16;i++){ if(rnd()<0.6) x.fillRect(lx+3+i*2.3, ly+2, rnd()<0.4?1.6:0.8, 6); }
  x.font='5px monospace'; x.fillStyle='#20242c';
  x.fillText('YK-'+String(100+Math.floor(rnd()*900)), lx+4, ly+12.5);
}
// Occlusion ambiante cuite : bords assombris + dégradé vertical léger.
function bakeAO(x){
  let g = x.createLinearGradient(0,0,0,1024);
  g.addColorStop(0,'rgba(0,0,0,0.34)'); g.addColorStop(0.18,'rgba(0,0,0,0.05)');
  g.addColorStop(0.72,'rgba(0,0,0,0.05)'); g.addColorStop(1,'rgba(0,0,0,0.45)');
  x.fillStyle=g; x.fillRect(0,0,512,1024);
  g = x.createLinearGradient(0,0,512,0);
  g.addColorStop(0,'rgba(0,0,0,0.30)'); g.addColorStop(0.12,'rgba(0,0,0,0)');
  g.addColorStop(0.88,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.30)');
  x.fillStyle=g; x.fillRect(0,0,512,1024);
}
// Corps de dessin d'une façade « serveur » (ex-makeServerTexture), memes conventions.
function drawServerInto(x, sd){
  const rnd=mulberry32(sd); const W=512,H=1024;
  x.fillStyle='#06080b'; x.fillRect(0,0,W,H);
  let g1=x.createLinearGradient(0,0,28,0); g1.addColorStop(0,'#23272e'); g1.addColorStop(1,'#0c0e12'); x.fillStyle=g1; x.fillRect(0,0,26,H);
  let g2=x.createLinearGradient(W-28,0,W,0); g2.addColorStop(0,'#14171c'); g2.addColorStop(1,'#363c45'); x.fillStyle=g2; x.fillRect(W-26,0,26,H);
  for(let yy=16;yy<H;yy+=46){ drawScrew(x,12,yy); drawScrew(x,W-12,yy); }
  let y=8; while(y<H-8){ const uH=(rnd()<0.16)?(26+rnd()*10):(40+rnd()*60); drawUnit(x,30,y,W-60,Math.min(uH,H-8-y),rnd); y+=uH+3; }
  bakeAO(x);
}
// Tuile « switch + brassage » : 2 switchs 1U, panneau de brassage câblé, serveurs en bas.
function drawSwitchPanel(x, seed){
  const rnd = mulberry32(seed);
  x.fillStyle='#06080b'; x.fillRect(0,0,512,1024);
  // 2 switchs 1U en haut : rangée de ports + micro-LED d'activité
  for(let sw=0; sw<2; sw++){
    const y = 30 + sw*54;
    x.fillStyle='#10141a'; x.fillRect(30, y, 452, 40);
    x.strokeStyle='#2c333e'; x.strokeRect(30.5, y+0.5, 451, 39);
    for(let i=0;i<24;i++){
      const px2 = 44 + i*18;
      x.fillStyle='#04060a'; x.fillRect(px2, y+16, 13, 15);
      x.fillStyle = rnd()<0.7 ? '#39ff9a' : (rnd()<0.5 ? '#ffcf4d' : '#0e1218');
      x.globalAlpha = 0.45+rnd()*0.55; x.fillRect(px2+2, y+8, 4, 3); x.globalAlpha = 1;
    }
  }
  // panneau de brassage au centre : 2 rangées de ports + arcs de câbles
  for(let row=0; row<2; row++){
    const y = 300 + row*230;
    x.fillStyle='#0c0f14'; x.fillRect(30, y-24, 452, 44);
    for(let i=0;i<20;i++){ x.fillStyle='#030508'; x.fillRect(42+i*22, y-16, 15, 15);
      x.strokeStyle='#232a34'; x.strokeRect(42.5+i*22, y-15.5, 14, 14); }
  }
  drawPatchCables(x, rnd, 300, 560);
  // bas : serveurs classiques
  let y = 620; while(y < 1000){ const uH = 40+rnd()*60;
    drawUnit(x, 30, y, 452, Math.min(uH, 1000-y), rnd); y += uH+3; }
  drawLabel(x, rnd, 36, 12); drawLabel(x, rnd, 430, 990);
  bakeAO(x);
}
// Tuile « baie de stockage » : colonnes denses de tiroirs disques du haut en bas.
function drawStorageWall(x, seed){
  const rnd = mulberry32(seed);
  x.fillStyle='#06080b'; x.fillRect(0,0,512,1024);
  for(let y=16; y<990; y+=34){
    let dx = 36;
    while(dx+30 < 476){
      const bg = x.createLinearGradient(dx,0,dx+28,0);
      bg.addColorStop(0,'#1c2129'); bg.addColorStop(1,'#0c0e13');
      x.fillStyle=bg; x.fillRect(dx, y, 28, 28);
      x.strokeStyle='#3a4250'; x.lineWidth=1; x.strokeRect(dx+0.5, y+0.5, 27, 27);
      x.fillStyle='#05070b'; x.fillRect(dx+3, y+4, 22, 5);
      x.fillStyle = rnd()<0.8 ? '#39ff9a' : (rnd()<0.5 ? '#ffcf4d' : '#ff5b5b');
      x.globalAlpha = 0.5+rnd()*0.5; x.fillRect(dx+21, y+21, 4, 3); x.globalAlpha = 1;
      dx += 31;
    }
  }
  drawLabel(x, rnd, 40, 8); bakeAO(x);
}
// Tuile « PDU + serveurs » : bandeau PDU vertical (prises + LED) à droite, serveurs à gauche.
function drawPduColumn(x, seed){
  const rnd = mulberry32(seed);
  x.fillStyle='#06080b'; x.fillRect(0,0,512,1024);
  // serveurs sur la largeur restante
  let y = 10; while(y < 1010){ const uH = 40+rnd()*60;
    drawUnit(x, 30, y, 380, Math.min(uH, 1010-y), rnd); y += uH+3; }
  // bandeau PDU vertical à droite : prises + LED
  x.fillStyle='#0a0c11'; x.fillRect(420, 8, 62, 1008);
  x.strokeStyle='#262d38'; x.strokeRect(420.5, 8.5, 61, 1007);
  for(let i=0;i<18;i++){
    const py = 34 + i*54;
    x.fillStyle='#03050a'; x.fillRect(434, py, 34, 26);
    x.strokeStyle='#1f2630'; x.strokeRect(434.5, py+0.5, 33, 25);
    x.fillStyle = (i%3===0) ? '#ff5b5b' : '#39ff9a';
    x.globalAlpha = 0.6+rnd()*0.4; x.fillRect(452, py+32, 3, 3); x.globalAlpha = 1;
  }
  drawLabel(x, rnd, 430, 990); bakeAO(x);
}
// Dessine une tuile dans la région (ox, oy, w, h) du contexte partagé.
// Le corps reste en coordonnees 512x1024 : translate + scale gerent l'offset et la resolution de tuile.
function drawFacadeTile(x, ox, oy, w, h, seed, fn){
  x.save(); x.translate(ox, oy); x.scale(w/512, h/1024);
  fn(seed);
  x.restore();
}
// Atlas de 8 façades (4 colonnes x 2 lignes). Tuile k a l'offset UV ((k%4)/4, 1 - (floor(k/4)+1)/2).
// Répartition : 0-1 portes grillagées hex, 2-4 piles de serveurs, 5 switch + brassage câblé,
// 6 baie de stockage dense, 7 PDU + serveurs.
export function makeFacadeAtlas(maxTexSize){
  const big = maxTexSize >= 4096;
  const tw = big ? 1024 : 512, th = big ? 2048 : 1024;   // tuile
  const c = document.createElement('canvas'); c.width = tw*4; c.height = th*2;
  const x = c.getContext('2d');
  const TILES = [
    s => drawHexDoor(x, s), s => drawHexDoor(x, s+13),
    s => drawServerInto(x, s), s => drawServerInto(x, s+7), s => drawServerInto(x, s+29),
    s => drawSwitchPanel(x, s),
    s => drawStorageWall(x, s),
    s => drawPduColumn(x, s),
  ];
  for(let k=0;k<8;k++){
    drawFacadeTile(x, (k%4)*tw, Math.floor(k/4)*th, tw, th, 3000 + k*277, TILES[k]);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return { texture: t, cols: 4, rows: 2, tiles: 8 };
}

// Texture de sol : dalles + pools de lumière sous les rampes plafond. Couvre 14 m (X) x 4.8 m (Z)
// monde (une travée de rampe), répétée via RepeatWrapping le long de l'allée.
export function makeFloorTexture(){
  const W=512, H=1024;   // 14 m x 4.8 m monde -> 1 travée de rampe
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d');
  x.fillStyle='#05070b'; x.fillRect(0,0,W,H);
  // dalles 0.6 m : pas de 512/14*0.6 ≈ 22 px en X, 1024/4.8*0.6 = 128 px en Z
  const px=W/14*0.6, pz=H/4.8*0.6;
  x.strokeStyle='rgba(150,170,205,0.07)'; x.lineWidth=1;
  for(let gx=0; gx<=W; gx+=px){ x.beginPath(); x.moveTo(gx,0); x.lineTo(gx,H); x.stroke(); }
  for(let gz=0; gz<=H; gz+=pz){ x.beginPath(); x.moveTo(0,gz); x.lineTo(W,gz); x.stroke(); }
  // perforations d'aération sur les dalles côté baies
  for(let gz=pz/2; gz<H; gz+=pz) for(let gx=px/2; gx<W; gx+=px){
    const lane = gx < W*0.30 || gx > W*0.70;
    if(!lane) continue;
    for(let i=0;i<9;i++){ x.fillStyle='rgba(0,0,0,0.5)';
      x.beginPath(); x.arc(gx-6+(i%3)*6, gz-6+Math.floor(i/3)*6, 1.1, 0, 6.2832); x.fill(); }
  }
  // pool de lumière de la rampe : ellipse centrée en Z=H/2 (sous la rampe), centre d'allée
  let g = x.createRadialGradient(W/2,H/2,10, W/2,H/2,240);
  g.addColorStop(0,'rgba(205,200,255,0.16)'); g.addColorStop(0.45,'rgba(190,180,255,0.07)');
  g.addColorStop(1,'rgba(0,0,0,0)');
  x.save(); x.translate(W/2,H/2); x.scale(0.55,1); x.translate(-W/2,-H/2);
  x.fillStyle=g; x.fillRect(0,0,W,H); x.restore();
  // usure : traces de roulettes au centre de l'allée
  x.fillStyle='rgba(255,255,255,0.016)';
  x.fillRect(W*0.44,0,7,H); x.fillRect(W*0.53,0,7,H);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.RepeatWrapping;
  t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=16;
  return t;
}

// Texture d'écran de logs : pseudo-terminal (lignes de log défilantes), répétée en Y par le shader.
export function makeLogTexture(){
  const W=256, H=512;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d'); const rnd=mulberry32(90210);
  x.fillStyle='#04070a'; x.fillRect(0,0,W,H);
  x.font='7px monospace';
  const COLS=['#39ff9a','#c9a0ff','#d8dbe2','#ffcf4d','#37c0ff'];
  const WORDS=['[ ok ]','[warn]','probe','sync','eth0','bgp','ipmi','fan2','42.1C','psu-a','raid','scrub','vlan','tls'];
  for(let y=10; y<H-4; y+=10){
    let lx=6;
    const n=2+Math.floor(rnd()*4);
    for(let i=0;i<n;i++){
      x.fillStyle=COLS[Math.floor(rnd()*COLS.length)];
      x.globalAlpha=0.5+rnd()*0.5;
      const w = rnd()<0.5 ? WORDS[Math.floor(rnd()*WORDS.length)]
                          : (Math.floor(rnd()*0xffff)).toString(16).padStart(4,'0');
      x.fillText(w, lx, y); lx += 8 + w.length*4.6 + rnd()*14;
      if(lx>W-30) break;
    }
    if(rnd()<0.12){ x.fillStyle='#39ff9a'; x.globalAlpha=0.7;
      x.fillRect(6, y+2, 40+rnd()*160, 2.5); }
    x.globalAlpha=1;
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=THREE.ClampToEdgeWrapping; t.wrapT=THREE.RepeatWrapping;
  t.colorSpace=THREE.SRGBColorSpace;
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

// Texture de lueur : dégradé radial blanc -> transparent, réutilisée pour le fond d'allée
// (et la tâche 7).
export function makeGlowTexture(size=128){
  const c=document.createElement('canvas'); c.width=c.height=size;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.4,'rgba(255,255,255,0.35)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}
