/* Datacenter 3D - moteur (adapté du design "Datacenter 3D.html").
   Boucle INFINIE SANS SAUT : chaque baie est recyclée individuellement vers le
   fond (dans le brouillard) -> plus de "remise à zéro" visible.
   Three.js auto-hébergé (importmap local) => CSP-safe.
   Config par défaut = réglages validés ; surcharge via window.DC_CONFIG.
   Panneau de réglage optionnel via window.DC_PANEL. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const DEFAULTS = {
  camSpeed: 0.40, blink: 1.05, density: 0.75, ledSize: 0.045,
  glow: 1.20, fog: 0.025, veil: 0.32, palette: 'datacenter',
  bg: '#04060a', theme: 'dark'
};
let config = Object.assign({}, DEFAULTS, (window.DC_CONFIG || {}));

function mulberry32(s){ return function(){ s|=0; s=(s+0x6D2B79F5)|0; let t=Math.imul(s^(s>>>15),1|s); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
let seed = Math.floor(Math.random()*1e9);
function hexToRgba(hex,a){ let h=hex.replace('#',''); if(h.length===3)h=h.split('').map(c=>c+c).join(''); const n=parseInt(h,16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }

const canvas = document.getElementById('scene-canvas');
const veilEl = document.getElementById('veil');

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  if (canvas) canvas.style.display = 'none';
  document.body.style.background = `radial-gradient(120% 90% at 50% 30%, #0b1020, ${config.bg})`;
  console.warn('[datacenter] WebGL indisponible, fallback fond sombre.', e);
}

if (renderer) {
  // Plafonne la résolution de rendu à ~1080p (le canvas est upscalé en CSS) : gros gain GPU en 1440p/4K, look quasi identique.
  const MAX_W = 1920, MAX_H = 1080;
  const pixRatio = () => Math.min(1.5, MAX_W / window.innerWidth, MAX_H / window.innerHeight, window.devicePixelRatio || 1);
  renderer.setPixelRatio(pixRatio());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color(config.bg), config.fog);

  const FOV = 62;
  const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth/window.innerHeight, 0.1, 120);

  const hemi = new THREE.HemisphereLight(0x223247, 0x04050a, 0.16); scene.add(hemi);
  const fill = new THREE.DirectionalLight(0x4060a0, 0.08); fill.position.set(0, 6, 4); scene.add(fill);

  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pixRatio());
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.7, 0.0);
  composer.addPass(bloom);

  const ROWS = 34, SPACING = 2.4, RACK_X = 2.45, RACK_W = 1.45, RACK_H = 4.1, RACK_Z = 2.05;
  const FACE_X = RACK_X - RACK_W / 2;
  const Z0 = 4, Z_CAM = 2.0, NEAR_WRAP = Z0 + 0.5, TUNNEL = ROWS * SPACING;

  const worldGroup = new THREE.Group(); scene.add(worldGroup);
  let units = [];

  const PALETTES = {
    green: [[128,0.95,0.58,9],[118,0.92,0.54,4],[140,0.85,0.56,2],[150,0.8,0.6,1.5],[212,0.95,0.62,2.2],[225,0.9,0.64,1.2]],
    datacenter: [[212,0.95,0.6,6],[224,0.9,0.62,4],[200,0.9,0.58,2],[45,0.95,0.6,1.2],[0,0,0.95,0.8]],
    multi: [[190,0.9,0.6,3],[150,0.9,0.55,3],[210,0.9,0.6,2],[280,0.8,0.62,2],[45,0.95,0.6,2],[0,0.9,0.58,1]],
    cyan:  [[185,0.9,0.6,4],[200,0.9,0.6,3],[160,0.8,0.55,2],[220,0.7,0.6,1]],
    amber: [[40,0.95,0.6,4],[28,0.95,0.58,3],[55,0.9,0.6,2],[0,0.85,0.55,1]],
    warm:  [[18,0.95,0.58,3],[0,0.9,0.55,3],[300,0.7,0.6,2],[45,0.9,0.6,2]]
  };
  function pickColor(rnd, pal){ let tot=0; for(const p of pal)tot+=p[3]; let r=rnd()*tot; for(const p of pal){ r-=p[3]; if(r<=0)return p; } return pal[0]; }

  function drawScrew(x, cx, cy){ x.fillStyle='#05060a'; x.beginPath(); x.arc(cx,cy,3,0,6.2831); x.fill(); x.strokeStyle='rgba(255,255,255,0.12)'; x.lineWidth=1; x.beginPath(); x.arc(cx,cy,3,-2.4,-0.6); x.stroke(); }
  function drawUnit(x, ox, oy, w, h, rnd){
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
  function makeRackTexture(sd){
    const rnd=mulberry32(sd); const W=512,H=1024; const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
    const bg=x.createLinearGradient(0,0,W,0); bg.addColorStop(0,'#0b0d12'); bg.addColorStop(0.5,'#0f1217'); bg.addColorStop(1,'#090b10'); x.fillStyle=bg; x.fillRect(0,0,W,H);
    for(let yy=22;yy<H-22;yy+=7) for(let xx=42;xx<W-42;xx+=7){ x.fillStyle='rgba(0,0,0,0.6)'; x.beginPath(); x.arc(xx,yy,1.5,0,6.2831); x.fill(); x.fillStyle='rgba(150,170,200,0.05)'; x.fillRect(xx-1,yy-1,1,1); }
    let g1=x.createLinearGradient(0,0,34,0); g1.addColorStop(0,'#30353d'); g1.addColorStop(1,'#13161b'); x.fillStyle=g1; x.fillRect(0,0,30,H);
    let g2=x.createLinearGradient(W-34,0,W,0); g2.addColorStop(0,'#13161b'); g2.addColorStop(1,'#30353d'); x.fillStyle=g2; x.fillRect(W-30,0,30,H);
    for(let s=1;s<3;s++){ const yy=H*s/3; x.fillStyle='rgba(0,0,0,0.65)'; x.fillRect(30,yy-1,W-60,2); x.fillStyle='rgba(255,255,255,0.05)'; x.fillRect(30,yy+1,W-60,1); }
    const hx=rnd()<0.5?52:W-62; x.fillStyle='#20242b'; x.fillRect(hx,H*0.4,10,H*0.2); x.fillStyle='rgba(255,255,255,0.10)'; x.fillRect(hx,H*0.4,2,H*0.2);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=16; return t;
  }
  function makeServerTexture(sd){
    const rnd=mulberry32(sd); const W=512,H=1024; const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
    x.fillStyle='#06080b'; x.fillRect(0,0,W,H);
    let g1=x.createLinearGradient(0,0,28,0); g1.addColorStop(0,'#23272e'); g1.addColorStop(1,'#0c0e12'); x.fillStyle=g1; x.fillRect(0,0,26,H);
    let g2=x.createLinearGradient(W-28,0,W,0); g2.addColorStop(0,'#14171c'); g2.addColorStop(1,'#363c45'); x.fillStyle=g2; x.fillRect(W-26,0,26,H);
    for(let yy=16;yy<H;yy+=46){ drawScrew(x,12,yy); drawScrew(x,W-12,yy); }
    let y=8; while(y<H-8){ const uH=(rnd()<0.16)?(26+rnd()*10):(40+rnd()*60); drawUnit(x,30,y,W-60,Math.min(uH,H-8-y),rnd); y+=uH+3; }
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=16; return t;
  }

  const rackMat = new THREE.MeshStandardMaterial({ color: 0x060709, roughness: 0.5, metalness: 0.85 });
  const rackGeo = new THREE.BoxGeometry(RACK_W, RACK_H, RACK_Z);
  const meshMats = []; for(let i=0;i<3;i++){ const tex=makeRackTexture(1000+i*137); meshMats.push(new THREE.MeshStandardMaterial({ map:tex, emissive:0x9fc0ff, emissiveMap:tex, emissiveIntensity:0.12, roughness:0.62, metalness:0.5 })); }
  const serverMats = []; for(let i=0;i<3;i++){ const tex=makeServerTexture(2000+i*211); serverMats.push(new THREE.MeshStandardMaterial({ map:tex, emissive:0x9fc0ff, emissiveMap:tex, emissiveIntensity:0.14, roughness:0.58, metalness:0.45 })); }
  const handleGeo = new THREE.BoxGeometry(0.05, RACK_H*0.32, 0.10);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x04050a, roughness: 0.35, metalness: 0.6 });
  const faceGeo = new THREE.PlaneGeometry(RACK_Z*0.97, RACK_H*0.992);
  const pickF = mulberry32(777);

  const ledMat = new THREE.ShaderMaterial({
    uniforms: { uTime:{value:0}, uSize:{value:config.ledSize}, uHeight:{value:600}, uBlink:{value:config.blink}, uMaxSize:{value:16}, uFog:{value:config.fog}, uFogColor:{value:new THREE.Color(config.bg)} },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aColor; attribute float aPhase; attribute float aRate; attribute float aBase;
      uniform float uTime, uSize, uHeight, uBlink, uMaxSize;
      varying vec3 vColor; varying float vB;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float dist = -mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(uMaxSize, uSize * uHeight / max(dist, 0.1));
        float blink = 0.5 + 0.5 * sin(uTime * uBlink * aRate + aPhase * 6.2831);
        float b = aBase * mix(0.9, blink, step(0.12, aRate));
        vColor = aColor; vB = clamp(b, 0.0, 1.4);
      }
    `,
    fragmentShader: `
      varying vec3 vColor; varying float vB;
      void main(){
        vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
        float a = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(vColor * vB * 1.5, a * clamp(vB, 0.0, 1.0));
      }
    `
  });

  function buildStatics(){
    const dprF = pixRatio();
    for(let side=-1; side<=1; side+=2){
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.18,ROWS*SPACING), new THREE.MeshStandardMaterial({ color:0x0a0b10, roughness:0.8, metalness:0.6 }));
      rail.position.set(side*1.5, RACK_H+0.45, Z0-ROWS*SPACING/2); worldGroup.add(rail);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, ROWS*SPACING+24), new THREE.MeshStandardMaterial({ color:0x070809, roughness:0.95, metalness:0.2 }));
    ceil.rotation.x = Math.PI/2; ceil.position.set(0, RACK_H+1.15, Z0-ROWS*SPACING/2); worldGroup.add(ceil);
    const mirror = new Reflector(new THREE.PlaneGeometry(14, ROWS*SPACING+24), { color:0x8b939d, textureWidth:1024*dprF, textureHeight:1024*dprF, clipBias:0.003 });
    mirror.rotation.x = -Math.PI/2; mirror.position.set(0,0,Z0-ROWS*SPACING/2); worldGroup.add(mirror);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, ROWS*SPACING+24), new THREE.MeshStandardMaterial({ color:0x04060a, roughness:0.2, metalness:0.55, transparent:true, opacity:0.34 }));
    floor.rotation.x = -Math.PI/2; floor.position.set(0,0.002,Z0-ROWS*SPACING/2); worldGroup.add(floor);
  }

  function buildRacks(){
    for(let side=-1; side<=1; side+=2){
      for(let r=0; r<ROWS; r++){
        const zc = Z0 - r*SPACING - SPACING/2;
        const u = new THREE.Group(); u.position.set(0,0,zc); u.userData = { side, r };
        const m = new THREE.Mesh(rackGeo, rackMat); m.position.set(side*RACK_X, RACK_H/2+0.05, 0); u.add(m);
        const faceMat = (pickF()<0.22) ? meshMats[Math.floor(pickF()*meshMats.length)] : serverMats[Math.floor(pickF()*serverMats.length)];
        const f = new THREE.Mesh(faceGeo, faceMat); f.position.set(side*(FACE_X-0.02), RACK_H/2+0.05, 0); f.rotation.y = -side*Math.PI/2; u.add(f);
        const handle = new THREE.Mesh(handleGeo, handleMat); handle.position.set(side*(FACE_X-0.06), RACK_H*0.5, (pickF()<0.5?-RACK_Z*0.40:RACK_Z*0.40)); u.add(handle);
        units.push(u); worldGroup.add(u);
      }
    }
  }

  function buildLEDs(){
    const pal = PALETTES[config.palette] || PALETTES.datacenter;
    const yBase = 0.34, yTop = RACK_H - 0.18;
    const U = Math.max(20, Math.round(34*config.density));
    const uH = (yTop-yBase)/U;
    const ledZ = RACK_Z*0.86;
    for(const u of units){
      if(u.userData.led){ u.userData.led.geometry.dispose(); u.remove(u.userData.led); u.userData.led=null; }
      const rnd = mulberry32(((seed ^ (u.userData.r*73856093) ^ (u.userData.side===1?19349663:0))>>>0) || 1);
      const x = u.userData.side*(FACE_X-0.012);
      const pos=[],col=[],pha=[],rate=[],base=[];
      const addLED=(yy,zz,c,fixed,b)=>{ pos.push(x,yy,zz); col.push(c.r,c.g,c.b); pha.push(rnd()); rate.push(fixed?0.03:0.5+rnd()*2.2); base.push(b); };
      const z0 = -ledZ/2;
      let uu=0;
      while(uu<U){
        const span = rnd()<0.32?2:1;
        const yc = yBase + (uu+span/2)*uH;
        uu += span;
        if(rnd()<0.30) continue;
        const pMain = pickColor(rnd,pal);
        const main = new THREE.Color().setHSL(pMain[0]/360, pMain[1], pMain[2]);
        const nLed = Math.max(8, Math.round((14+rnd()*10)*Math.min(1.6, config.density)));
        const fillR = 0.6+rnd()*0.4; const usable = ledZ*fillR;
        const zStart = z0 + (ledZ-usable)*(0.15+rnd()*0.7);
        const lineFixed = rnd()<0.7; const lineB = 0.8+rnd()*0.4;
        for(let k=0;k<nLed;k++){
          const z = zStart + (k/(nLed-1))*usable;
          let c=main, fixed=lineFixed, b=lineB; const accent=rnd();
          if(accent<0.06){ c=new THREE.Color().setHSL(45/360,0.95,0.6); fixed=false; b=1.1; }
          else if(accent<0.085){ c=new THREE.Color().setHSL(0,0.9,0.58); fixed=false; b=1.0; }
          else if(accent<0.16){ c=new THREE.Color().setHSL(0,0,0.96); fixed=true; b=1.0; }
          addLED(yc, z, c, fixed, b);
        }
        if(span===2 && rnd()<0.6){
          const y2=yc-uH*0.55; const n2=Math.round(nLed*0.7);
          for(let k=0;k<n2;k++){ const z=zStart+(k/(n2-1))*usable*0.9; addLED(y2,z,main, rnd()<0.8, lineB*0.85); }
        }
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
      g.setAttribute('aColor', new THREE.Float32BufferAttribute(col,3));
      g.setAttribute('aPhase', new THREE.Float32BufferAttribute(pha,1));
      g.setAttribute('aRate', new THREE.Float32BufferAttribute(rate,1));
      g.setAttribute('aBase', new THREE.Float32BufferAttribute(base,1));
      const pts = new THREE.Points(g, ledMat); pts.frustumCulled=false; u.add(pts); u.userData.led=pts;
    }
  }

  function veilCss(){ return `radial-gradient(70% 64% at 50% 48%, ${hexToRgba(config.bg, config.veil*0.92)} 0%, ${hexToRgba(config.bg, config.veil*0.42)} 44%, ${hexToRgba(config.bg, 0)} 74%)`; }
  function applyLive(){
    bloom.strength = config.glow;
    renderer.setClearColor(new THREE.Color(config.bg), 1);
    scene.fog.density = config.fog; scene.fog.color.set(config.bg);
    ledMat.uniforms.uFog.value = config.fog; ledMat.uniforms.uSize.value = config.ledSize;
    ledMat.uniforms.uBlink.value = config.blink; ledMat.uniforms.uFogColor.value.set(config.bg);
    if(veilEl) veilEl.style.background = veilCss();
    document.body.style.background = config.bg;
  }

  const t0 = performance.now();
  const FRAME_MS = 1000 / 30;   // ~30 fps : ~5x moins de charge GPU, invisible sur un fond lent
  let raf = 0, last = 0;
  function animate(now){
    if (document.hidden) { raf = 0; return; }   // 0 GPU quand l'onglet est caché
    raf = requestAnimationFrame(animate);
    if (now - last < FRAME_MS) return;           // throttle ~30 fps
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    const time = (now-t0)/1000;
    ledMat.uniforms.uTime.value = time;
    for(const u of units){ u.position.z += config.camSpeed*dt; if(u.position.z > NEAR_WRAP) u.position.z -= TUNNEL; }
    camera.position.set(Math.sin(time*0.12)*0.10, 1.5+Math.sin(time*0.1)*0.04, Z_CAM);
    camera.lookAt(Math.sin(time*0.05)*0.15, 0.55, Z_CAM-12);
    composer.render();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !raf) { last = 0; raf = requestAnimationFrame(animate); } });
  function resize(){
    const W=window.innerWidth, H=window.innerHeight, dpr=pixRatio();
    renderer.setPixelRatio(dpr); renderer.setSize(W,H);
    composer.setPixelRatio(dpr); composer.setSize(W,H); bloom.setSize(W,H);
    camera.aspect = W/H; camera.updateProjectionMatrix();
    ledMat.uniforms.uHeight.value = (H*dpr)/(2*Math.tan(THREE.MathUtils.degToRad(FOV/2)));
  }
  window.addEventListener('resize', resize);

  function buildPanel(){
    const controls = document.getElementById('controls'); if(!controls) return;
    const REGEN = ['density','palette'];
    const SLIDERS = [
      { group:'Allée' },
      { key:'camSpeed', label:'Vitesse caméra', min:0, max:3, step:0.05, fmt:v=>v.toFixed(2) },
      { key:'fog', label:'Brouillard', min:0, max:0.12, step:0.005, fmt:v=>v.toFixed(3) },
      { group:'LED' },
      { key:'blink', label:'Clignotement', min:0, max:3, step:0.05, fmt:v=>v.toFixed(2) },
      { key:'density', label:'Densité', min:0.4, max:2, step:0.05, fmt:v=>v.toFixed(2) },
      { key:'ledSize', label:'Taille', min:0.01, max:0.12, step:0.005, fmt:v=>v.toFixed(3) },
      { key:'glow', label:'Bloom / lueur', min:0, max:2, step:0.05, fmt:v=>v.toFixed(2) },
      { group:'Lisibilité' },
      { key:'veil', label:'Voile central', min:0, max:1, step:0.02, fmt:v=>v.toFixed(2) }
    ];
    SLIDERS.forEach(def=>{
      if(def.group){ const t=document.createElement('div'); t.className='group-title'; t.textContent=def.group; controls.appendChild(t); return; }
      const row=document.createElement('div'); row.className='row';
      row.innerHTML=`<div class="lab"><span>${def.label}</span><span class="val" id="val-${def.key}"></span></div><input type="range" id="in-${def.key}" min="${def.min}" max="${def.max}" step="${def.step}">`;
      controls.appendChild(row);
      const input=row.querySelector('input'), val=row.querySelector('.val');
      input.value=config[def.key]; val.textContent=def.fmt(config[def.key]);
      input.addEventListener('input', ()=>{ config[def.key]=parseFloat(input.value); val.textContent=def.fmt(config[def.key]); if(REGEN.includes(def.key)) buildLEDs(); applyLive(); });
    });
    const palRow=document.createElement('div'); palRow.className='row';
    palRow.innerHTML=`<div class="lab"><span>Ambiance LED</span></div><select id="in-pal"><option value="green">Vert (réf.)</option><option value="datacenter">Bleu</option><option value="multi">Multicolore</option><option value="cyan">Cyan / bleu</option><option value="amber">Ambre / or</option><option value="warm">Chaud (rouge/violet)</option></select>`;
    controls.appendChild(palRow);
    const palSel=palRow.querySelector('select'); palSel.value=config.palette; palSel.addEventListener('change', ()=>{ config.palette=palSel.value; buildLEDs(); });
    const bgRow=document.createElement('div'); bgRow.className='row'; bgRow.innerHTML=`<div class="lab"><span>Couleur de fond</span></div><input type="color" id="in-bg">`;
    controls.appendChild(bgRow);
    const bgInput=bgRow.querySelector('input'); bgInput.value=config.bg; bgInput.addEventListener('input', ()=>{ config.bg=bgInput.value; applyLive(); });
    const actRow=document.createElement('div'); actRow.className='btn-row'; actRow.innerHTML=`<button class="act" id="btn-regen">↻ Régénérer</button><button class="act primary" id="btn-copy">⧉ Copier la config</button>`;
    controls.appendChild(actRow);
    document.getElementById('btn-regen').addEventListener('click', ()=>{ seed=Math.floor(Math.random()*1e9); buildLEDs(); });
    document.getElementById('btn-copy').addEventListener('click', ()=>{ const clean={}; Object.keys(DEFAULTS).forEach(k=>clean[k]=config[k]); const json=JSON.stringify(clean,null,2); if(navigator.clipboard) navigator.clipboard.writeText(json).then(showToast,()=>fb(json)); else fb(json); });
    function fb(text){ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); showToast(); }catch(e){} ta.remove(); }
    const toast=document.getElementById('toast'); let tt; function showToast(){ if(!toast)return; toast.classList.add('show'); clearTimeout(tt); tt=setTimeout(()=>toast.classList.remove('show'),1600); }
    const panel=document.getElementById('panel'), togBtn=document.getElementById('toggle-panel');
    function setPanel(open){ if(!panel)return; panel.classList.toggle('collapsed',!open); if(togBtn){ togBtn.style.opacity=open?'0':'1'; togBtn.style.pointerEvents=open?'none':'auto'; } }
    const colBtn=document.getElementById('btn-collapse'); if(colBtn) colBtn.addEventListener('click', ()=>setPanel(false));
    if(togBtn) togBtn.addEventListener('click', ()=>setPanel(true));
    setPanel(true);
  }

  buildStatics(); buildRacks(); buildLEDs();
  resize(); applyLive();
  if(window.DC_PANEL) buildPanel();
  raf = requestAnimationFrame(animate);

  window.DC = { DEFAULTS, config, PALETTES, applyLive, buildLEDs, regen(){ seed=Math.floor(Math.random()*1e9); buildLEDs(); } };
}
