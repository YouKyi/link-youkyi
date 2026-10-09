/* Datacenter YouKyi : deux rendus, une implantation, un travelling périodique.
   Three.js r160 auto-hébergé. Aucun modèle distant ni dépendance supplémentaire. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { makeFacadeAtlas, makeFloorTexture, makeTrayTexture } from './dc-textures.js';
import { buildRackModels } from './dc-racks.js';
import { RACK, STYLES, SCENE_DEFAULTS, rackLayout, deviceLEDs, tunnelSlots, cameraFraming, mulberry32 } from './dc-layout.mjs';

const DEFAULTS = SCENE_DEFAULTS;
const config = { ...DEFAULTS, ...window.DC_CONFIG };
const requestedStyle = new URLSearchParams(location.search).get('render');
if (STYLES.includes(requestedStyle)) config.rackStyle = requestedStyle;
if (!STYLES.includes(config.rackStyle)) config.rackStyle = 'graphite';
const PALETTES = {
  violet: '#a58bdd', violetPremium: '#9687b3', datacenter: '#7fb8ee', cyan: '#60cfd9',
  green: '#68d4a6', amber: '#dcbb78', warm: '#d19899', multi: '#8fa8de'
};
const canvas = document.getElementById('scene-canvas'), veil = document.getElementById('veil');
const poster = document.getElementById('poster');
if (poster && config.rackStyle === 'hardware') poster.style.backgroundImage = "url('/assets/poster-hardware.webp')";
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const stats = { ms: 0, calls: 0, triangles: 0, fps: 0, frames: 0, width: 0, height: 0 };
let started = false, starting = false, manuallyPaused = false, contextLost = false, inspecting = false;
let applyLive = () => {}, renderOnce = () => {}, capturePoster = () => {}, captureVideoFrame = () => {}, rebuildLEDs = () => {};
let seed = 90210, sceneTime = 0, travel = 0;
const api = window.DC = { build: 'b18-perf', config, DEFAULTS, PALETTES, stats,
  applyLive() { applyLive(); renderOnce(); },
  buildLEDs() { rebuildLEDs(); renderOnce(); },
  capturePoster(download = true) { return capturePoster(download); },
  captureVideoFrame(time, duration = 18) {
    if (!Number.isFinite(time) || time < 0 || !Number.isFinite(duration) || duration <= 0) throw new RangeError('Temps de capture invalide');
    return captureVideoFrame(time, duration);
  },
  regen() { seed++; rebuildLEDs(); renderOnce(); },
  setStyle(style) {
    if (!STYLES.includes(style)) return false;
    config.rackStyle = style; applyLive(); renderOnce();
    window.dispatchEvent(new CustomEvent('dc:style', { detail: style })); return true;
  },
  setPaused(value) { manuallyPaused = Boolean(value); renderOnce(); return api.paused; },
  get paused() { return manuallyPaused || motion.matches; },
  setInspection(value) { inspecting = Boolean(value); renderOnce(); },
  get inspecting() { return inspecting; },
  resetView() { sceneTime = 0; travel = 0; renderOnce(); }
};

function init() {
  if (started || starting || !canvas) return;
  if (!window.DC_PANEL && motion.matches) return;
  starting = true;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'default' }); }
  catch (error) {
    starting = false; canvas.hidden = true;
    window.dispatchEvent(new CustomEvent('dc:error'));
    console.warn('[datacenter] WebGL indisponible, poster conservé.', error); return;
  }
  const pixelRatio = () => Math.min(2, 2560/innerWidth, 1600/innerHeight, Math.max(1, devicePixelRatio || 1));
  renderer.setPixelRatio(pixelRatio()); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.96;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(config.bg, config.fog);
  scene.background = scene.fog.color;
  const camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, 0.05, 85);
  // Résoudre le MSAA dans une cible séparée avant le bloom, qui réécrit sa texture d'entrée.
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }));
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Math.min(4, renderer.capabilities.maxSamples) });
  const raster = new RenderPass(scene, camera), resolve = new ShaderPass(CopyShader);
  resolve.material.depthTest = resolve.material.depthWrite = false;
  composer.addPass({ enabled: true, needsSwap: false,
    setSize(w,h) { sceneTarget.setSize(w,h); },
    render(r,writeBuffer,readBuffer) { raster.render(r,writeBuffer,sceneTarget); resolve.render(r,readBuffer,sceneTarget); }
  });
  stats.samples = sceneTarget.samples;
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), config.glow, 0.42, 0.95); composer.addPass(bloom);
  // Les passes plein écran ne testent aucune profondeur : seuls les volumes 3D en ont besoin.
  for (const target of [bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical]) target.depthBuffer = false;
  // Conversion finale unique après le bloom : les matériaux travaillent en lumière linéaire.
  composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ gl_FragColor=texture2D(tDiffuse,vUv);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` }));

  scene.add(new THREE.HemisphereLight(0xc4ccda, 0x24212b, 1.5));
  const key = new THREE.DirectionalLight(0xe6e9ef, 1.8); key.position.set(2, 5, 3); scene.add(key);
  const fill = new THREE.DirectionalLight(0xe3a282, 0.55); fill.position.set(-3, 2, -4); scene.add(fill);
  // Environnement de studio construit localement : reflets larges sur le métal graphite.
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 16), new THREE.MeshBasicMaterial({ color: 0x41434a, side: THREE.BackSide })); env.add(room);
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 2.4, 3.0), side: THREE.DoubleSide }));
    strip.rotation.x = Math.PI/2; strip.position.set(side*1.3, 2.1, 0); env.add(strip);
  }
  const pmrem = new THREE.PMREMGenerator(renderer), envTarget = pmrem.fromScene(env, 0.03);
  scene.environment = envTarget.texture; pmrem.dispose();
  env.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });

  const slots = tunnelSlots(), TUNNEL = RACK.rows*RACK.spacing, Z_CAM = 1.8;
  const ledLayouts = Array.from({ length: 8 }, (_, variant) => rackLayout(variant).flatMap(deviceLEDs));
  const atlas = makeFacadeAtlas(renderer.capabilities.maxTextureSize).texture;
  const racks = buildRackModels(slots, atlas); scene.add(racks.group);
  api.models = racks.counts;
  const length = TUNNEL*2+12, centerZ = 2.8-TUNNEL;
  const RAMP_STEP = RACK.spacing*4, RAMP_Y = RACK.height+0.44, RAMP_START = 1.96;
  const dummy = new THREE.Object3D();
  function instanced(geometry, material, poses) {
    const mesh = new THREE.InstancedMesh(geometry, material, poses.length);
    poses.forEach((p,i) => { dummy.position.set(...p); dummy.rotation.set(0,0,0); dummy.scale.set(1,1,1); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix); });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); scene.add(mesh); return mesh;
  }
  const lampPos = [];
  for (let r = 0; r < RACK.rows/2; r++) for (const x of [-0.52,0.52]) lampPos.push([x,RAMP_Y,RAMP_START-r*RAMP_STEP]);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2,1.35,1.65) });
  const lamps = instanced(new THREE.BoxGeometry(0.048,0.012,1.78),lampMat,lampPos);
  const lampHousing = new THREE.MeshStandardMaterial({ color: 0x48596f, metalness: 0.55, roughness: 0.42 });
  instanced(new THREE.BoxGeometry(0.077,0.028,1.86),lampHousing,lampPos.map(([x,y,z])=>[x,y+0.021,z]));
  const mirrorLampMat = new THREE.MeshBasicMaterial({ color: 0x4a5568 });
  const mirrorLamps = instanced(new THREE.BoxGeometry(0.075,0.014,1.82),mirrorLampMat,lampPos.map(([x,y,z])=>[x,-y,z]));
  // Une paire de rampes orange sur quatre ; même cycle dans les deux sections.
  const orange = new THREE.Color('#ff6a2e'), white = new THREE.Color(1,1,1);
  lampPos.forEach((_,i) => {
    const tint = Math.floor(i/2)%4===1 ? orange : white;
    lamps.setColorAt(i,tint); mirrorLamps.setColorAt(i,tint);
  });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(8,length), new THREE.MeshStandardMaterial({ color: 0x27303d, roughness: 0.88 }));
  ceiling.rotation.x = Math.PI/2; ceiling.position.set(0,RAMP_Y+0.18,centerZ); scene.add(ceiling);
  const trayTex = makeTrayTexture(); trayTex.repeat.set(1,length/RACK.spacing);
  const trayMat = new THREE.MeshStandardMaterial({ map: trayTex, color: 0x8c9cad, roughness: 0.60, metalness: 0.50, side: THREE.DoubleSide });
  for (const side of [-1,1]) {
    const tray = new THREE.Mesh(new THREE.PlaneGeometry(0.34,length),trayMat);
    tray.rotation.x = Math.PI/2; tray.position.set(side*1.40,RACK.height+0.23,centerZ); scene.add(tray);
    for(let k=0;k<3;k++) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.010,0.010,length,5),new THREE.MeshStandardMaterial({color:k===0?0x554669:0x28384c,roughness:0.7}));
      cable.rotation.x=Math.PI/2; cable.position.set(side*1.40+(k-1)*0.06,RACK.height+0.25,centerZ); scene.add(cable);
    }
  }

  const floorMat = new THREE.ShaderMaterial({ transparent:true, depthWrite:false,
    // Huit répétitions exactes par section : les joints restent raccords au retour de caméra.
    uniforms: { uMap:{value:makeFloorTexture()}, uRepeat:{value:new THREE.Vector2(8/4.8,length/TUNNEL*8)},
      uFog:{value:config.fog},uFogColor:{value:new THREE.Color(config.bg)},uMirror:{value:config.mirror} },
    vertexShader:`varying vec2 vUv; varying vec3 vWorld; varying float vDist;
      void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.0); vWorld=wp.xyz;
        vec4 mv=viewMatrix*wp; vDist=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`uniform sampler2D uMap; uniform vec2 uRepeat; uniform float uFog,uMirror;
      uniform vec3 uFogColor; varying vec2 vUv; varying vec3 vWorld; varying float vDist;
      void main(){
        vec3 tex=texture2D(uMap,vUv*uRepeat).rgb;
        float strip=exp(-pow((abs(vWorld.x)-0.52)*2.2,2.0));
        float pool=0.5+0.5*cos((vWorld.z-${RAMP_START.toFixed(3)})*6.283185/${RAMP_STEP.toFixed(3)});
        vec3 col=tex*(0.64+0.30*pool)+vec3(0.016,0.020,0.030)*strip*pool;
        float grazing=1.0-clamp(normalize(cameraPosition-vWorld).y,0.0,1.0);
        float reflection=(0.018+0.12*pow(grazing,2.0))*(0.65+0.35*pool)*uMirror;
        float fog=1.0-exp(-uFog*uFog*vDist*vDist);
        gl_FragColor=vec4(mix(col,uFogColor,fog),1.0-reflection);
      }` });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8,length),floorMat);
  floor.rotation.x=-Math.PI/2; floor.position.set(0,0.003,centerZ); floor.renderOrder=2; scene.add(floor);

  const shaftMat = new THREE.ShaderMaterial({ transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.FrontSide,
    uniforms:{uOpacity:{value:0.016}},
    vertexShader:`varying float vH,vRim,vDist;
      void main(){vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.0);
        vec3 n=normalize(mat3(modelMatrix*instanceMatrix)*normal);
        vRim=abs(dot(n,normalize(cameraPosition-wp.xyz))); vH=uv.y;
        vec4 mv=viewMatrix*wp; vDist=-mv.z; gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uOpacity; varying float vH,vRim,vDist;
      // Le MSAA extrapole parfois le varying hors du triangle : pow(valeur négative, 1.6) produirait un NaN propagé par le bloom.
      void main(){float a=uOpacity*pow(clamp(vRim,0.0,1.0),1.6)*smoothstep(0.0,0.85,vH)*smoothstep(1.2,4.0,vDist)*exp(-0.0025*vDist*vDist);
        gl_FragColor=vec4(0.64,0.72,0.90,a);}` });
  instanced(new THREE.ConeGeometry(0.61,2.26,12,1,true),shaftMat,lampPos.map(([x,y,z])=>[x,y-1.13,z]));

  const ledMat = new THREE.ShaderMaterial({ transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uTime:{value:0},uSize:{value:config.ledSize},uHeight:{value:600},uBlink:{value:config.blink},
      uTraffic:{value:config.traffic},uFog:{value:config.fog},uHardware:{value:0},uMirror:{value:config.mirror},uLoop:{value:0}},
    vertexShader:`attribute vec3 aColor; attribute float aPhase,aTraffic,aDepth,aSide;
      uniform float uTime,uSize,uHeight,uBlink,uTraffic,uFog,uHardware,uMirror,uLoop;
      varying vec3 vColor; varying float vAlpha;
      void main(){
        vec3 p=position; bool mirror=p.y<0.0;
        p.x-=aSide*aDepth*uHardware*(mirror?0.0:1.0);
        vec4 mv=modelViewMatrix*vec4(p,1.0); float dist=max(0.05,-mv.z);
        gl_Position=projectionMatrix*mv;
        float size=uSize*uHeight*3.0/dist;
        gl_PointSize=clamp(size,4.0,12.0);
        float coverage=min(1.0,size/4.0);
        float stepTime=floor(uTime*(4.0+5.0*aPhase)*uBlink+aPhase*31.0);
        if(uLoop>0.0){float steps=max(1.0,floor((4.0+5.0*aPhase)*uBlink*uLoop));stepTime=mod(floor(uTime*steps/uLoop+aPhase*31.0),steps);}
        float burst=step(0.56,fract(sin(stepTime*12.9898+aPhase*78.233)*43758.5453));
        float activity=uBlink>0.0?mix(0.85,0.025+1.1*burst,min(1.0,aTraffic*uTraffic)):0.85;
        float fog=exp(-uFog*uFog*dist*dist);
        vColor=aColor*activity*4.0; vAlpha=fog*coverage*coverage*(mirror?uMirror*0.10:1.0);
      }`,
    fragmentShader:`varying vec3 vColor; varying float vAlpha;
      void main(){float d=length(gl_PointCoord-0.5);
        float core=1.0-smoothstep(0.09,0.20,d);
        float halo=exp(-d*d*22.0)*0.18;
        gl_FragColor=vec4(vColor,(core+halo)*vAlpha);}` });
  let ledPoints;
  rebuildLEDs = () => {
    const pos=[],color=[],phase=[],traffic=[],depth=[],sideAttr=[];
    const colors={ power:new THREE.Color(PALETTES[config.palette]||PALETTES.violet), amber:new THREE.Color('#d5a552'), green:new THREE.Color('#56b598') };
    for (const s of slots) {
      const rnd=mulberry32((seed^(s.r*73856093)^(s.side===1?19349663:97))>>>0);
      for (const led of ledLayouts[s.variant]) {
        if (rnd()>Math.min(1,config.density)) continue;
        const c=colors[led.status];
        const ph=rnd();
        for (const mir of [false,true]) {
          pos.push(s.side*(RACK.x-RACK.depth/2-0.004),mir?-led.y:led.y,s.z+s.side*led.x);
          color.push(c.r,c.g,c.b); phase.push(ph);traffic.push(led.traffic);
          depth.push(led.depth);sideAttr.push(s.side);
        }
      }
    }
    const geometry=new THREE.BufferGeometry();
    for (const [name,values,size] of [['position',pos,3],['aColor',color,3],['aPhase',phase,1],['aTraffic',traffic,1],['aDepth',depth,1],['aSide',sideAttr,1]]) geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,size));
    if (ledPoints) {scene.remove(ledPoints);ledPoints.geometry.dispose();}
    ledPoints=new THREE.Points(geometry,ledMat);ledPoints.frustumCulled=false;scene.add(ledPoints);
  };
  rebuildLEDs();

  const dustGeometry=new THREE.BufferGeometry(), dustPos=[], dustSeed=[], rndDust=mulberry32(4242);
  for(let i=0;i<100;i++){dustPos.push((rndDust()-0.5)*1.8,0.3+rndDust()*2.2,rndDust()*22);dustSeed.push(rndDust());}
  dustGeometry.setAttribute('position',new THREE.Float32BufferAttribute(dustPos,3));dustGeometry.setAttribute('aSeed',new THREE.Float32BufferAttribute(dustSeed,1));
  const dustMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uTime:{value:0},uCamZ:{value:Z_CAM},uDust:{value:config.dust},uHeight:{value:600}},
    vertexShader:`attribute float aSeed;uniform float uTime,uCamZ,uDust,uHeight;varying float vAlpha;
      void main(){vec3 p=position;p.z=uCamZ-mod(p.z+uTime*0.10,22.0);
        p.x+=sin(uTime*0.18+aSeed*30.0)*0.08;vec4 mv=modelViewMatrix*vec4(p,1.0);
        gl_Position=projectionMatrix*mv;gl_PointSize=clamp(0.003*uHeight/max(0.1,-mv.z),1.0,2.5);
        vAlpha=uDust*0.10*smoothstep(0.0,2.0,-mv.z)*(1.0-smoothstep(8.0,20.0,-mv.z));}`,
    fragmentShader:`varying float vAlpha;void main(){gl_FragColor=vec4(0.6,0.7,0.9,smoothstep(0.5,0.1,length(gl_PointCoord-0.5))*vAlpha);}`});
  const dust=new THREE.Points(dustGeometry,dustMat);dust.frustumCulled=false;scene.add(dust);

  let raf=0,last=0,framesInWindow=0,windowStart=0;
  function pose(time=sceneTime, distance=travel, loop=0) {
    const camZ=Z_CAM-distance, framing=cameraFraming(camera.aspect);
    const fov=inspecting?Math.max(70,framing.fov):framing.fov;
    if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();ledMat.uniforms.uHeight.value=dustMat.uniforms.uHeight.value=canvas.height/(2*Math.tan(THREE.MathUtils.degToRad(fov/2)));}
    if(inspecting){
      const rackZ=2.8-Math.round((2.8-camZ+0.55)/RACK.spacing)*RACK.spacing;
      camera.position.set(-0.50,1.12,rackZ+0.95);camera.lookAt(RACK.x-RACK.depth/2,1.12,rackZ);
    }else{
      // Oscillations très lentes, indépendantes de la période du tunnel.
      const phase=loop>0?2*Math.PI*time/loop:0;
      camera.position.set(Math.sin(loop>0?phase:time*0.09)*0.025,framing.height+Math.sin(loop>0?phase:time*0.10)*0.009,camZ);
      camera.lookAt(Math.sin(loop>0?phase:time*0.06)*0.035,framing.targetY,camZ-8);
    }
    racks.setView(camZ);
    ledMat.uniforms.uTime.value=dustMat.uniforms.uTime.value=time;
    ledMat.uniforms.uLoop.value=loop;
    if(loop>0)dustMat.uniforms.uTime.value=2*(1-Math.cos(2*Math.PI*time/loop));
    dustMat.uniforms.uCamZ.value=camZ;
  }
  function draw() {
    const t=performance.now();pose();renderer.info.reset();composer.render();
    stats.ms+=(performance.now()-t-stats.ms)*0.08;
    stats.calls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;stats.frames++;
    if (!canvas.classList.contains('ready')) canvas.classList.add('ready');
  }
  function animate(now) {
    raf=0;if(document.hidden||contextLost)return;
    if(!api.paused)raf=requestAnimationFrame(animate);
    // Une image par rafraîchissement : pas de cadence 28/30 Hz superposée à celle de l'écran.
    const dt=last?Math.min(0.05,(now-last)/1000):0;last=now;
    if(!api.paused){sceneTime+=dt;if(!inspecting)travel=(travel+config.camSpeed*dt)%TUNNEL;}
    draw();framesInWindow++;
    if(!windowStart)windowStart=now;
    if(now-windowStart>=1000){stats.fps=framesInWindow*1000/(now-windowStart);framesInWindow=0;windowStart=now;}
  }
  renderOnce=()=>{last=0;if(!raf&&!document.hidden&&!contextLost)raf=requestAnimationFrame(animate);};
  function resize() {
    const dpr=pixelRatio();
    if (renderer.getPixelRatio() !== dpr) { renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr); }
    renderer.setSize(innerWidth,innerHeight);
    composer.setSize(innerWidth,innerHeight);
    camera.aspect=innerWidth/innerHeight;camera.fov=cameraFraming(camera.aspect).fov;camera.updateProjectionMatrix();
    const height=innerHeight*dpr/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
    ledMat.uniforms.uHeight.value=dustMat.uniforms.uHeight.value=height;
    stats.width=canvas.width;stats.height=canvas.height;renderOnce();
  }
  applyLive=()=>{
    racks.setStyle(config.rackStyle);racks.setMirror(config.mirror!==0);mirrorLamps.visible=config.mirror!==0;
    renderer.setClearColor(config.bg,1);scene.fog.color.set(config.bg);scene.fog.density=config.fog;
    floorMat.uniforms.uFogColor.value.set(config.bg);floorMat.uniforms.uFog.value=config.fog;floorMat.uniforms.uMirror.value=config.mirror;
    ledMat.uniforms.uHardware.value=config.rackStyle==='hardware'?1:0;
    ledMat.uniforms.uFog.value=config.fog;
    ledMat.uniforms.uSize.value=config.ledSize;ledMat.uniforms.uBlink.value=config.blink;
    ledMat.uniforms.uTraffic.value=config.traffic;ledMat.uniforms.uMirror.value=config.mirror;
    dustMat.uniforms.uDust.value=config.dust;
    shaftMat.uniforms.uOpacity.value=config.shaft*0.050;
    lampMat.color.setRGB(1.1*config.ramp,1.25*config.ramp,1.5*config.ramp);
    bloom.strength=config.glow;
    if(veil)veil.style.background=`radial-gradient(ellipse 34% 76% at 50% 48%,rgba(8,10,17,${config.veil}) 0%,rgba(8,10,17,${config.veil*0.60}) 62%,transparent 100%)`;
  };
  capturePoster=async(download=true)=>{
    const inspection=inspecting;inspecting=false;pose(0,0);composer.render();
    const name=`poster-${config.rackStyle==='hardware'?'hardware-':''}${config.palette==='violetPremium'?'pro':'link'}.webp`;
    const image=new Promise(done=>canvas.toBlob(done,'image/webp',0.92));
    inspecting=inspection;renderOnce();
    const blob=await image;
    if(blob&&download){
      const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;
      link.hidden=true;document.body.appendChild(link);link.click();setTimeout(()=>{link.remove();URL.revokeObjectURL(url);},2000);
    }
    return blob;
  };
  // Export hors temps réel : caméra et poussière raccordées, activité des LED périodique.
  captureVideoFrame=(time,duration)=>{
    const inspection=inspecting;inspecting=false;
    pose(time,0.55*(1-Math.cos(2*Math.PI*time/duration)),duration);composer.render();
    inspecting=inspection;
    return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  };
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;cancelAnimationFrame(raf);raf=0;canvas.classList.remove('ready');});
  canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;renderOnce();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(raf);raf=0;stats.fps=0;}
    else{last=0;windowStart=0;framesInWindow=0;renderOnce();}
  });
  window.addEventListener('resize',resize);
  started=true;starting=false;applyLive();resize();
  if(window.DC_PANEL)import('./dc-panel.js').then(({buildPanel})=>buildPanel(api));
  window.dispatchEvent(new CustomEvent('dc:ready'));
}

motion.addEventListener('change',()=>{if(!started&&!motion.matches)init();else renderOnce();});
if(window.DC_PANEL)init();
else if(!motion.matches){
  const idle=()=>{if(motion.matches)return;('requestIdleCallback' in window)?requestIdleCallback(init,{timeout:1500}):setTimeout(init,200);};
  document.readyState==='complete'?idle():window.addEventListener('load',idle,{once:true});
}
