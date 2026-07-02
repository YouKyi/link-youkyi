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
import { mulberry32, makeFacadeAtlas, makeFloorTexture, makeGlowTexture } from './dc-textures.js';

const DEFAULTS = {
  camSpeed: 0.40, blink: 1.05, density: 0.75, ledSize: 0.045,
  glow: 1.20, fog: 0.025, veil: 0.32, palette: 'datacenter',
  bg: '#04060a', theme: 'dark', mirror: 1, ramp: 1.0,
  shaft: 0.5, dust: 0.5
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
  const RAMP_SPACING = SPACING*2, RAMP_Z0 = Z0 - 1.2;   // pas des rampes plafond ; RAMP_Z0 = phase de tout l'éclairage cuit

  const worldGroup = new THREE.Group(); scene.add(worldGroup);

  // Baies instanciées : ~4 InstancedMesh au lieu de 272 Groups. Le miroir (sous le sol) n'est plus
  // un Group cloné (scale.y = -1) mais la seconde moitié des instances -> encore une passe, moins d'objets.
  const FACE_RECESS = 0.10;          // renfoncement de la façade dans le caisson
  let slots = [], casesIM, facesIM, pillarsIM, rampsIM, rampMat, NRAMP, ledPoints = null, ledMirror = -1;
  let shaftMat, dustMat;

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

  // side: DoubleSide partout car les instances miroir ont un scale.y = -1 (culling inversé).
  const rackMat = new THREE.MeshStandardMaterial({ color: 0x060709, roughness: 0.5, metalness: 0.85, side: THREE.DoubleSide });
  const rackGeo = new THREE.BoxGeometry(RACK_W, RACK_H, RACK_Z);
  const faceGeo = new THREE.PlaneGeometry(RACK_Z*0.97, RACK_H*0.992);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide });

  // Atlas de façades (8 tuiles) -> un seul ShaderMaterial remplace les 6 MeshStandardMaterial + textures.
  const atlas = makeFacadeAtlas(renderer.capabilities.maxTextureSize);
  const faceMat = new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: atlas.texture },
      uTileScale: { value: new THREE.Vector2(1/atlas.cols, 1/atlas.rows) },
      uBright: { value: 1.0 },
      uFogColor: { value: new THREE.Color(config.bg) },
      uFogDensity: { value: config.fog },
      uRampSpacing: { value: SPACING*2 },   // utilisés à partir de la tâche 6
      uRampZ0: { value: 0 },
      uRampBright: { value: 0 },             // 0 = modulation neutre pour l'instant
    },
    // three r160 : pour un ShaderMaterial rendu par un InstancedMesh, three declare deja
    // `attribute mat4 instanceMatrix;` (prefixe USE_INSTANCING). On ne le redeclare donc PAS ici
    // (une double declaration serait une erreur GLSL) ; on l'utilise directement dans main().
    vertexShader: `
      attribute vec2 aTile;
      varying vec2 vUv; varying vec2 vTile; varying float vWZ; varying float vDist;
      void main(){
        vUv = uv; vTile = aTile;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWZ = wp.z;
        vec4 mv = viewMatrix * wp;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uAtlas; uniform vec2 uTileScale;
      uniform float uBright, uFogDensity, uRampSpacing, uRampZ0, uRampBright;
      uniform vec3 uFogColor;
      varying vec2 vUv; varying vec2 vTile; varying float vWZ; varying float vDist;
      void main(){
        vec3 tex = texture2D(uAtlas, vUv * uTileScale + vTile).rgb;
        float d = (vWZ - uRampZ0) / uRampSpacing;
        float pool = pow(0.5 + 0.5*cos(6.28318*d), 1.6);
        float light = mix(1.0, 0.55 + 0.9*pool, clamp(uRampBright, 0.0, 2.0));
        vec3 col = tex * uBright * light;
        float f = 1.0 - exp(-uFogDensity*uFogDensity*vDist*vDist);
        gl_FragColor = vec4(mix(col, uFogColor, clamp(f,0.0,1.0)), 1.0);
      }`,
    side: THREE.DoubleSide,
  });

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
    // L et zC : étendue (Z) et centre du monde statique (2 périodes + marge) ; réutilisés par
    // le sol, les rails/plafond ci-dessous et (tâche 7) le fond d'allée.
    const L = PERIODS*TUNNEL + 24, zC = Z0 - PERIODS*TUNNEL/2;
    for(let side=-1; side<=1; side+=2){
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.18,L), new THREE.MeshStandardMaterial({ color:0x0a0b10, roughness:0.8, metalness:0.6 }));
      rail.position.set(side*1.5, RACK_H+0.45, zC); worldGroup.add(rail);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, L), new THREE.MeshStandardMaterial({ color:0x070809, roughness:0.95, metalness:0.2 }));
    ceil.rotation.x = Math.PI/2; ceil.position.set(0, RACK_H+1.15, zC); worldGroup.add(ceil);

    // Sol texturé (dalles + pools de lumière sous les rampes) : remplace l'ancien plan semi-
    // transparent uni (opacité 0.62) de la tâche 3. Le miroir transparaît dans les 12 % restants
    // et à travers les zones sombres de la texture.
    const floorTex = makeFloorTexture();
    floorTex.repeat.set(1, L/4.8);
    // phase : le pool (centre de tuile) doit tomber sous RAMP_Z0 ; le plan est centré en zC.
    // NOTE : sens visuel non vérifié ici (pas de navigateur) ; si le pool est décalé par rapport
    // à la rampe au tuner, inverser le signe de cet offset (cf. brief tâche 6).
    floorTex.offset.y = (((zC + L/2) - (RAMP_Z0 + 2.4)) / 4.8) % 1;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, L),
      new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, opacity: 0.88, color: 0xffffff }));
    floor.rotation.x = -Math.PI/2; floor.position.set(0, 0.002, zC); worldGroup.add(floor);

    // Rampes plafond instanciées (et leur reflet sous le sol, seconde moitié des instances).
    const rampGeo = new THREE.BoxGeometry(0.55, 0.06, 1.5);
    rampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    NRAMP = Math.round(PERIODS*TUNNEL/RAMP_SPACING);   // 34
    rampsIM = new THREE.InstancedMesh(rampGeo, rampMat, NRAMP*2);
    for(let k=0;k<NRAMP;k++){
      const z = RAMP_Z0 - k*RAMP_SPACING;
      setInst(rampsIM, k, 0, RACK_H + 1.02, z, null, 0);
      setInst(rampsIM, k+NRAMP, 0, RACK_H + 1.02, z, null, 1);
    }
    rampsIM.instanceMatrix.needsUpdate = true; rampsIM.frustumCulled = false;
    worldGroup.add(rampsIM);

    // Fond d'allée : aux deux extrémités de période, un plan de lueur discret.
    const glowMat = new THREE.MeshBasicMaterial({ map: makeGlowTexture(), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, color: 0x8f7ad9, opacity: 0.5 });
    for(const zEnd of [Z0 - TUNNEL - 2, Z0 - 2*TUNNEL - 2]){
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), glowMat);
      glow.position.set(0, 2.2, zEnd); worldGroup.add(glow);
    }
  }

  function buildAtmosphere(){
    // Faux faisceaux volumétriques : un cône texturé (dégradé radial) sous chaque rampe, pointe
    // en haut, base évasée vers le bas. Pas de miroir : aucun reflet utile sous le sol.
    const shaftGeo = new THREE.ConeGeometry(1.5, 3.4, 14, 1, true);   // ouvert, pointe en haut
    const shaftTex = makeGlowTexture(64);
    shaftTex.wrapS = THREE.ClampToEdgeWrapping;
    shaftMat = new THREE.MeshBasicMaterial({
      map: shaftTex, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, color: 0xbcb3e8, opacity: 0.10 });
    const shaftsIM = new THREE.InstancedMesh(shaftGeo, shaftMat, NRAMP);   // pas de miroir
    for(let k=0;k<NRAMP;k++) setInst(shaftsIM, k, 0, RACK_H + 1.02 - 1.7, RAMP_Z0 - k*RAMP_SPACING, null, 0);
    shaftsIM.instanceMatrix.needsUpdate = true; shaftsIM.frustumCulled = false;
    worldGroup.add(shaftsIM);

    // Poussière flottante : shader autonome (aucune mise à jour CPU par particule), positionnée
    // relative caméra (ajoutée à `scene`, pas à `worldGroup`) pour ne jamais « claquer » au wrap.
    const DUST_N = 300, DUST_LEN = 30.0;
    const dustGeo = new THREE.BufferGeometry();
    {
      const p = new Float32Array(DUST_N*3), sd = new Float32Array(DUST_N);
      const rndD = mulberry32(4242);
      for(let i=0;i<DUST_N;i++){
        // concentrées vers le centre d'allée et la hauteur des shafts
        p[i*3]   = (rndD()*2-1) * (0.6 + rndD()*1.4);
        p[i*3+1] = 0.4 + rndD()*4.2;
        p[i*3+2] = rndD()*DUST_LEN;                    // z de départ, replié par le shader
        sd[i] = rndD();
      }
      dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(p,3));
      dustGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd,1));
    }
    dustMat = new THREE.ShaderMaterial({
      uniforms: { uTime:{value:0}, uCamZ:{value:Z_CAM}, uDust:{value:config.dust},
                  uHeight:{value:600}, uRampSpacing:{value:RAMP_SPACING}, uRampZ0:{value:RAMP_Z0} },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSeed;
        uniform float uTime, uCamZ, uDust, uHeight, uRampSpacing, uRampZ0;
        varying float vA;
        void main(){
          vec3 p = position;
          float z = mod(p.z + uTime*(0.18 + aSeed*0.15), 30.0);
          p.z = uCamZ + 1.0 - z;
          p.x += sin(uTime*0.30 + aSeed*40.0)*0.22;
          p.y += sin(uTime*0.21 + aSeed*70.0)*0.15;
          // plus visible sous les rampes (dans les shafts)
          float d = (p.z - uRampZ0)/uRampSpacing;
          float inShaft = 0.35 + 0.65*pow(0.5+0.5*cos(6.28318*d), 2.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(5.0, 0.02*uHeight/max(-mv.z, 0.1));
          float tw = 0.6 + 0.4*sin(uTime*(0.8+aSeed*2.0) + aSeed*90.0);
          vA = uDust * inShaft * tw * smoothstep(0.0, 3.0, -mv.z) * smoothstep(28.0, 14.0, -mv.z);
        }`,
      fragmentShader: `
        varying float vA;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.1, length(uv)) * vA * 0.22;
          gl_FragColor = vec4(vec3(0.82, 0.79, 0.95), a);
        }`
    });
    const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; scene.add(dust);
  }

  function buildSlots(){
    slots = [];
    for(let p=0; p<PERIODS; p++)
      for(let side=-1; side<=1; side+=2)
        for(let r=0; r<ROWS; r++){
          // Graine déterministe par (side, r) uniquement : jamais par p ni par l'ordre d'appel,
          // sinon les deux périodes divergeraient et le wrap deviendrait visible.
          const rnd = mulberry32(((r*73856093) ^ (side===1?19349663:97)) >>> 0);
          slots.push({ side, r, p, z: Z0 - p*TUNNEL - r*SPACING - SPACING/2,
                       variant: Math.floor(rnd()*8) });
        }
  }

  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(),
        _q = new THREE.Quaternion(), _qF = new THREE.Quaternion(),
        _s1 = new THREE.Vector3(1,1,1), _sM = new THREE.Vector3(1,-1,1);

  function setInst(im, i, x, y, z, quat, mirrored){
    _p.set(x, mirrored ? -y : y, z);
    _m.compose(_p, quat || _q.identity(), mirrored ? _sM : _s1);
    im.setMatrixAt(i, _m);
  }

  function buildRacks(){
    buildSlots();
    const N = slots.length;                                  // 136
    casesIM  = new THREE.InstancedMesh(rackGeo, rackMat, N*2);
    facesIM  = new THREE.InstancedMesh(faceGeo, faceMat, N*2);
    const pillarGeo = new THREE.BoxGeometry(0.07, RACK_H, 0.13);
    pillarsIM = new THREE.InstancedMesh(pillarGeo, pillarMat, N*4);   // 2 montants par baie
    const tiles = new Float32Array(N*2*2);                   // offset UV par instance de face
    // Remplissage monde d'abord (indices [0..N-1]) puis miroir ([N..2N-1]) ; pillarsIM : monde
    // [0..2N-1], miroir [2N..4N-1] (via j*2). L'ordre permet à applyLive() de tronquer via im.count.
    slots.forEach((s, i) => {
      for(const mir of [0,1]){
        const j = i + mir*N;
        setInst(casesIM, j, s.side*RACK_X, RACK_H/2+0.05, s.z, null, mir);
        _qF.setFromAxisAngle(new THREE.Vector3(0,1,0), -s.side*Math.PI/2);
        // La façade reste plaquée au fond du caisson (FACE_X - 0.02) ; ce sont les montants qui
        // avancent de FACE_RECESS vers l'allée, ce qui donne l'impression que la façade est
        // renfoncée. Ne pas mettre la façade à FACE_X + FACE_RECESS : elle serait dans le caisson opaque.
        setInst(facesIM, j, s.side*(FACE_X - 0.02), RACK_H/2+0.05, s.z, _qF, mir);
        tiles[j*2]   = (s.variant%4)/4;
        tiles[j*2+1] = 1 - (Math.floor(s.variant/4)+1)/2;
        setInst(pillarsIM, j*2,   s.side*(FACE_X - FACE_RECESS), RACK_H/2+0.05, s.z - RACK_Z*0.44, null, mir);
        setInst(pillarsIM, j*2+1, s.side*(FACE_X - FACE_RECESS), RACK_H/2+0.05, s.z + RACK_Z*0.44, null, mir);
      }
    });
    // aTile est un attribut PAR INSTANCE : on clone la géométrie pour ne pas le faire fuiter sur faceGeo partagé.
    facesIM.geometry = faceGeo.clone();
    facesIM.geometry.setAttribute('aTile', new THREE.InstancedBufferAttribute(tiles, 2));
    for(const im of [casesIM, facesIM, pillarsIM]){
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; worldGroup.add(im);
    }
  }

  function buildLEDs(){
    const pal = PALETTES[config.palette] || PALETTES.datacenter;
    const yBase = 0.34, yTop = RACK_H - 0.18;
    const U = Math.max(20, Math.round(34*config.density));
    const uH = (yTop-yBase)/U;
    const ledZ = RACK_Z*0.86;
    if(ledPoints){ ledPoints.geometry.dispose(); scene.remove(ledPoints); ledPoints = null; }
    // Un seul Points global (monde + miroir) au lieu d'un Points par baie.
    const pos=[],col=[],pha=[],rate=[],base=[];
    for(const s of slots){
      // Graine par (seed, r, side) uniquement (jamais par p) : les 2 périodes restent identiques -> pas de saut au wrap.
      const rnd = mulberry32(((seed ^ (s.r*73856093) ^ (s.side===1?19349663:0))>>>0) || 1);
      const x = s.side*(FACE_X - 0.032);
      const addLED=(yy,zz,c,fixed,b)=>{ pos.push(x,yy,s.z+zz); col.push(c.r,c.g,c.b); pha.push(rnd()); rate.push(fixed?0.03:0.5+rnd()*2.2); base.push(b); };
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
    }
    // Copies miroir sous le sol (y négatif, base atténuée à 40 %) quand le miroir est actif.
    ledMirror = config.mirror;
    if(config.mirror !== 0){
      const nW = base.length;
      for(let i=0;i<nW;i++){
        pos.push(pos[i*3], -pos[i*3+1], pos[i*3+2]);
        col.push(col[i*3], col[i*3+1], col[i*3+2]);
        pha.push(pha[i]); rate.push(rate[i]); base.push(base[i]*0.4);
      }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(col,3));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(pha,1));
    g.setAttribute('aRate', new THREE.Float32BufferAttribute(rate,1));
    g.setAttribute('aBase', new THREE.Float32BufferAttribute(base,1));
    ledPoints = new THREE.Points(g, ledMat); ledPoints.frustumCulled=false; scene.add(ledPoints);
  }

  function veilCss(){ return `radial-gradient(70% 64% at 50% 48%, ${hexToRgba(config.bg, config.veil*0.92)} 0%, ${hexToRgba(config.bg, config.veil*0.42)} 44%, ${hexToRgba(config.bg, 0)} 74%)`; }
  function applyLive(){
    bloom.strength = config.glow;
    renderer.setClearColor(new THREE.Color(config.bg), 1);
    scene.fog.density = config.fog; scene.fog.color.set(config.bg);
    ledMat.uniforms.uFog.value = config.fog; ledMat.uniforms.uSize.value = config.ledSize;
    ledMat.uniforms.uBlink.value = config.blink; ledMat.uniforms.uFogColor.value.set(config.bg);
    faceMat.uniforms.uFogColor.value.set(config.bg); faceMat.uniforms.uFogDensity.value = config.fog;
    // Éclairage cuit : rampes plafond (couleur + intensité) et modulation des façades sous les pools.
    rampMat.color.setScalar(0.75 + 1.5*config.ramp);           // blanc chaud -> le bloom fait le halo
    faceMat.uniforms.uRampBright.value = config.ramp;
    faceMat.uniforms.uRampZ0.value = RAMP_Z0;
    // Atmosphère (tâche 7) : faisceaux volumétriques faux + poussière.
    shaftMat.opacity = 0.20 * config.shaft;
    dustMat.uniforms.uDust.value = config.dust;
    // Miroir : les instances miroir sont en seconde moitié -> on tronque via im.count (pas de mirrorGroup).
    const N = slots.length;
    for(const im of [casesIM, facesIM, pillarsIM]) if(im) im.count = config.mirror !== 0 ? (im === pillarsIM ? N*4 : N*2) : (im === pillarsIM ? N*2 : N);
    if(rampsIM) rampsIM.count = config.mirror !== 0 ? NRAMP*2 : NRAMP;
    if(config.mirror !== ledMirror) buildLEDs();   // reconstruit les LED avec/sans copies miroir
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
    dustMat.uniforms.uTime.value = time; dustMat.uniforms.uCamZ.value = camZ;
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
    dustMat.uniforms.uHeight.value = ledMat.uniforms.uHeight.value;
  }
  window.addEventListener('resize', resize);

  buildStatics(); buildAtmosphere(); buildRacks(); buildLEDs();
  resize(); applyLive();
  if (window.DC_PANEL) import('./dc-panel.js').then(m => m.buildPanel({
    config, DEFAULTS, applyLive, buildLEDs,
    regen(){ seed = Math.floor(Math.random()*1e9); buildLEDs(); },
    getStats(){ return stats; }
  }));
  raf = requestAnimationFrame(animate);

  window.DC = { DEFAULTS, config, PALETTES, applyLive, buildLEDs, regen(){ seed=Math.floor(Math.random()*1e9); buildLEDs(); }, stats };
}
