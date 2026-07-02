/* Datacenter 3D - moteur (adapté du design "Datacenter 3D.html").
   Monde STATIQUE (2 périodes de tunnel identiques, immuable après construction) :
   c'est la caméra qui avance et se téléporte en arrière d'une période (TUNNEL)
   -> boucle infinie invisible car la scène est exactement périodique.
   Three.js auto-hébergé (importmap local) => CSP-safe.
   Config par défaut = réglages validés ; surcharge via window.DC_CONFIG.
   Panneau de réglage optionnel via window.DC_PANEL. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { mulberry32, makeRackTexture, makeServerTexture } from './dc-textures.js';

const DEFAULTS = {
  camSpeed: 0.40, blink: 1.05, density: 0.75, ledSize: 0.045,
  glow: 1.20, fog: 0.025, veil: 0.32, palette: 'datacenter',
  bg: '#04060a', theme: 'dark', mirror: 1
};
let config = Object.assign({}, DEFAULTS, (window.DC_CONFIG || {}));

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
  const PERIODS = 2;
  const Z0 = 4, Z_CAM = 2.0, TUNNEL = ROWS * SPACING;

  const worldGroup = new THREE.Group(); scene.add(worldGroup);
  let units = [];

  // Monde miroir : clone à l'envers (scale.y = -1) de tout ce qui doit se refléter sous le sol
  // (y=0), au lieu d'un second rendu de scène (Reflector) -> même passe, deux fois moins cher.
  const mirrorGroup = new THREE.Group();
  mirrorGroup.scale.y = -1;
  scene.add(mirrorGroup);
  function buildMirror(){
    mirrorGroup.clear();
    for(const u of units){ mirrorGroup.add(u.clone()); }
  }

  const PALETTES = {
    green: [[128,0.95,0.58,9],[118,0.92,0.54,4],[140,0.85,0.56,2],[150,0.8,0.6,1.5],[212,0.95,0.62,2.2],[225,0.9,0.64,1.2]],
    datacenter: [[212,0.95,0.6,6],[224,0.9,0.62,4],[200,0.9,0.58,2],[45,0.95,0.6,1.2],[0,0,0.95,0.8]],
    multi: [[190,0.9,0.6,3],[150,0.9,0.55,3],[210,0.9,0.6,2],[280,0.8,0.62,2],[45,0.95,0.6,2],[0,0.9,0.58,1]],
    cyan:  [[185,0.9,0.6,4],[200,0.9,0.6,3],[160,0.8,0.55,2],[220,0.7,0.6,1]],
    amber: [[40,0.95,0.6,4],[28,0.95,0.58,3],[55,0.9,0.6,2],[0,0.85,0.55,1]],
    warm:  [[18,0.95,0.58,3],[0,0.9,0.55,3],[300,0.7,0.6,2],[45,0.9,0.6,2]],
    // Violet « YouKyi » : violet franc (hue ~271°, vrai violet, pas le magenta de GitHub), vif,
    // avec un rare vert #34D399 (statut « ok »).
    violet: [[271,0.95,0.58,6],[276,0.9,0.66,4],[266,0.95,0.5,2],[271,0.3,0.95,1],[150,0.85,0.55,1]],
    // Violet premium « confiance B2B » (réf. #7F32C8, violet franc ~271° désaturé) : sobre, sans vert.
    violetPremium: [[271,0.62,0.5,6],[275,0.58,0.6,4],[266,0.78,0.42,2],[271,0.22,0.92,1]]
  };
  function pickColor(rnd, pal){ let tot=0; for(const p of pal)tot+=p[3]; let r=rnd()*tot; for(const p of pal){ r-=p[3]; if(r<=0)return p; } return pal[0]; }

  const rackMat = new THREE.MeshStandardMaterial({ color: 0x060709, roughness: 0.5, metalness: 0.85 });
  const rackGeo = new THREE.BoxGeometry(RACK_W, RACK_H, RACK_Z);
  const meshMats = []; for(let i=0;i<3;i++){ const tex=makeRackTexture(1000+i*137); meshMats.push(new THREE.MeshStandardMaterial({ map:tex, emissive:0xc79fff, emissiveMap:tex, emissiveIntensity:0.12, roughness:0.62, metalness:0.5 })); }
  const serverMats = []; for(let i=0;i<3;i++){ const tex=makeServerTexture(2000+i*211); serverMats.push(new THREE.MeshStandardMaterial({ map:tex, emissive:0xc79fff, emissiveMap:tex, emissiveIntensity:0.14, roughness:0.58, metalness:0.45 })); }
  const handleGeo = new THREE.BoxGeometry(0.05, RACK_H*0.32, 0.10);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x04050a, roughness: 0.35, metalness: 0.6 });
  const faceGeo = new THREE.PlaneGeometry(RACK_Z*0.97, RACK_H*0.992);
  // mirrorGroup a un scale.y = -1 : ça inverse le culling des faces -> double face requis.
  rackMat.side = THREE.DoubleSide;
  for(const m of meshMats) m.side = THREE.DoubleSide;
  for(const m of serverMats) m.side = THREE.DoubleSide;
  handleMat.side = THREE.DoubleSide;

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
    for(let side=-1; side<=1; side+=2){
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.18,PERIODS*TUNNEL+24), new THREE.MeshStandardMaterial({ color:0x0a0b10, roughness:0.8, metalness:0.6 }));
      rail.position.set(side*1.5, RACK_H+0.45, Z0-PERIODS*TUNNEL/2); worldGroup.add(rail);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, PERIODS*TUNNEL+24), new THREE.MeshStandardMaterial({ color:0x070809, roughness:0.95, metalness:0.2 }));
    ceil.rotation.x = Math.PI/2; ceil.position.set(0, RACK_H+1.15, Z0-PERIODS*TUNNEL/2); worldGroup.add(ceil);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, PERIODS*TUNNEL+24), new THREE.MeshStandardMaterial({ color:0x04060a, roughness:0.2, metalness:0.55, transparent:true, opacity:0.62 }));
    floor.rotation.x = -Math.PI/2; floor.position.set(0,0.002,Z0-PERIODS*TUNNEL/2); worldGroup.add(floor);
  }

  function buildRacks(){
    for(let p=0; p<PERIODS; p++){
      for(let side=-1; side<=1; side+=2){
        for(let r=0; r<ROWS; r++){
          const zc = Z0 - p*TUNNEL - r*SPACING - SPACING/2;
          const u = new THREE.Group(); u.position.set(0,0,zc); u.userData = { side, r };
          const m = new THREE.Mesh(rackGeo, rackMat); m.position.set(side*RACK_X, RACK_H/2+0.05, 0); u.add(m);
          // Sélection déterministe par (side, r) uniquement : jamais par p ni par l'ordre d'appel,
          // sinon les deux périodes divergeraient et le wrap deviendrait visible.
          const rndF = mulberry32(((r*73856093) ^ (side===1?19349663:97)) >>> 0);
          const faceMat = (rndF()<0.22) ? meshMats[Math.floor(rndF()*meshMats.length)] : serverMats[Math.floor(rndF()*serverMats.length)];
          const f = new THREE.Mesh(faceGeo, faceMat); f.position.set(side*(FACE_X-0.02), RACK_H/2+0.05, 0); f.rotation.y = -side*Math.PI/2; u.add(f);
          const handle = new THREE.Mesh(handleGeo, handleMat); handle.position.set(side*(FACE_X-0.06), RACK_H*0.5, (rndF()<0.5?-RACK_Z*0.40:RACK_Z*0.40)); u.add(handle);
          units.push(u); worldGroup.add(u);
        }
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
    buildMirror();
  }

  function veilCss(){ return `radial-gradient(70% 64% at 50% 48%, ${hexToRgba(config.bg, config.veil*0.92)} 0%, ${hexToRgba(config.bg, config.veil*0.42)} 44%, ${hexToRgba(config.bg, 0)} 74%)`; }
  function applyLive(){
    bloom.strength = config.glow;
    renderer.setClearColor(new THREE.Color(config.bg), 1);
    scene.fog.density = config.fog; scene.fog.color.set(config.bg);
    ledMat.uniforms.uFog.value = config.fog; ledMat.uniforms.uSize.value = config.ledSize;
    ledMat.uniforms.uBlink.value = config.blink; ledMat.uniforms.uFogColor.value.set(config.bg);
    mirrorGroup.visible = config.mirror !== 0;
    if(veilEl) veilEl.style.background = veilCss();
    document.body.style.background = config.bg;
  }

  let camZ = Z_CAM;
  const t0 = performance.now();
  const FRAME_MS = 1000 / 30;   // ~30 fps : ~5x moins de charge GPU, invisible sur un fond lent
  let raf = 0, last = 0;
  const stats = { ms: 0, calls: 0 };   // instrumentation perf (ms/frame CPU, EMA) : voir window.DC.stats
  function animate(now){
    if (document.hidden) { raf = 0; return; }   // 0 GPU quand l'onglet est caché
    raf = requestAnimationFrame(animate);
    if (now - last < FRAME_MS) return;           // throttle ~30 fps
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    const time = (now-t0)/1000;
    ledMat.uniforms.uTime.value = time;
    camZ -= config.camSpeed*dt;
    if (camZ < Z_CAM - TUNNEL) camZ += TUNNEL;
    camera.position.set(Math.sin(time*0.12)*0.10, 1.5+Math.sin(time*0.1)*0.04, camZ);
    camera.lookAt(Math.sin(time*0.05)*0.15, 0.55, camZ-12);
    const tA = performance.now();
    composer.render();
    stats.ms += (performance.now() - tA) * 0.05 - stats.ms * 0.05;   // EMA
    stats.calls = renderer.info.render.calls;
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

  buildStatics(); buildRacks(); buildLEDs();
  resize(); applyLive();
  if (window.DC_PANEL) import('./dc-panel.js').then(m => m.buildPanel({
    config, DEFAULTS, applyLive, buildLEDs,
    regen(){ seed = Math.floor(Math.random()*1e9); buildLEDs(); },
    getStats(){ return stats; }
  }));
  raf = requestAnimationFrame(animate);

  window.DC = { DEFAULTS, config, PALETTES, applyLive, buildLEDs, regen(){ seed=Math.floor(Math.random()*1e9); buildLEDs(); }, stats };
}
