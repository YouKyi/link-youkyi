import * as THREE from 'three';
import { RACK, rackLayout, deviceParts, deviceLEDs } from './dc-layout.mjs';

// Les pièces d'une baie sont fusionnées par matériau, puis instanciées dans l'allée.
// On conserve de vrais volumes sans créer un objet/draw call par disque ou par port.
function merge(parts) {
  const positions = [], normals = [], uvs = [], colors = [], indices = [];
  for (const { geometry, color } of parts) {
    const offset = positions.length / 3, count = geometry.attributes.position.count;
    positions.push(...geometry.attributes.position.array); normals.push(...geometry.attributes.normal.array);
    uvs.push(...geometry.attributes.uv.array);
    // Conserver les sommets partagés : mêmes triangles, moins de mémoire et de travail dans le vertex shader.
    if (geometry.index) for (const index of geometry.index.array) indices.push(offset + index);
    else for (let i = 0; i < count; i++) indices.push(offset + i);
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) colors.push(c.r, c.g, c.b);
    geometry.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

function reflected(geometry) {
  const g = geometry.clone(); g.scale(1, -1, 1);
  // Inverser le winding dans la géométrie, jamais une échelle négative d'instance.
  const indices = g.index.array;
  for (let i = 0; i < indices.length; i += 3) {
    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  }
  return g;
}

export function buildRackModels(slots, atlas) {
  const group = new THREE.Group(), graphite = new THREE.Group(), hardware = new THREE.Group(), mirror = new THREE.Group();
  group.add(graphite, hardware, mirror);
  const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.65, roughness: 0.48 });
  const faceMat = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.68, metalness: 0.18 });
  const mirrorMat = faceMat.clone(); mirrorMat.color.setScalar(0.30); mirrorMat.roughness = 0.95;
  const plasticMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.06, roughness: 0.76 });
  const shellParts = [], frameColor = 0x34393f, detailedMeshes = [];
  function box(parts, x, y, z, w, h, depth, color, open = false) {
    const geometry = new THREE.BoxGeometry(w, h, depth);
    if (open) { const index = Array.from(geometry.index.array); index.splice(24, 6); geometry.setIndex(index); }
    geometry.translate(x, y, z); parts.push({ geometry, color });
  }
  function bevel(parts, x, y, z, w, h, depth, color, radius = 0.001) {
    const r = Math.min(radius, w/4, h/4, depth/4), shape = new THREE.Shape();
    shape.moveTo(-w/2+r,-h/2+r); shape.lineTo(w/2-r,-h/2+r);
    shape.lineTo(w/2-r,h/2-r); shape.lineTo(-w/2+r,h/2-r); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth-2*r, bevelEnabled: true,
      bevelSize: r, bevelThickness: r, bevelSegments: 1, steps: 1, curveSegments: 1 });
    geometry.translate(x,y,z-depth/2+r); parts.push({geometry,color});
  }
  function screw(parts, x, y, z) {
    const geometry = new THREE.CylinderGeometry(0.0022,0.0022,0.0015,8);
    geometry.rotateX(Math.PI/2); geometry.translate(x,y,z); parts.push({geometry,color:0x778087});
    box(parts,x,y,z+0.0009,0.0025,0.0005,0.0003,0x15191d);
  }
  function face(parts, x, y, z, w, h, variant, holes = []) {
    let geometry;
    if (holes.length) {
      const shape = new THREE.Shape();
      shape.moveTo(x-w/2, y-h/2); shape.lineTo(x+w/2, y-h/2); shape.lineTo(x+w/2, y+h/2); shape.lineTo(x-w/2, y+h/2); shape.closePath();
      for (const p of holes) {
        const hole = new THREE.Path();
        hole.moveTo(p.x-p.w/2, p.y-p.h/2); hole.lineTo(p.x-p.w/2, p.y+p.h/2);
        hole.lineTo(p.x+p.w/2, p.y+p.h/2); hole.lineTo(p.x+p.w/2, p.y-p.h/2); hole.closePath(); shape.holes.push(hole);
      }
      geometry = new THREE.ShapeGeometry(shape); geometry.translate(0, 0, z);
    } else { geometry = new THREE.PlaneGeometry(w, h); geometry.translate(x, y, z); }
    const position = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, ((variant % 4) + 0.5 + position.getX(i) / RACK.width) / 4,
        (1 - Math.floor(variant / 4)) / 2 + position.getY(i) / RACK.height / 2);
    }
    parts.push({ geometry, color: 0xffffff });
  }
  function place(mesh, selected) {
    const m = new THREE.Matrix4();
    selected.forEach((s, i) => {
      m.makeRotationY(-s.side * Math.PI / 2);
      m.setPosition(s.side * (RACK.x - RACK.depth / 2), 0, s.z); mesh.setMatrixAt(i, m);
    });
    mesh.count = selected.length;
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
  }
  function instances(geometry, material, selected, parent) {
    const mesh = new THREE.InstancedMesh(geometry, material, selected.length);
    mesh.userData.slots = selected;
    place(mesh, selected); parent.add(mesh);
    return mesh;
  }

  for (const x of [-0.325, 0.325]) {
    box(shellParts, x, RACK.height/2, -0.52, 0.04, RACK.height, 1.04, 0x212529);
    for (const z of [-0.99, 0.025]) box(shellParts, x, RACK.height/2, z, 0.042, RACK.height, 0.040, frameColor);
    // Une lèvre claire, éclairée par l'environnement, donne l'épaisseur des montants.
    box(shellParts, x + (x > 0 ? -0.019 : 0.019), RACK.height/2, 0.028, 0.002, RACK.height-0.12, 0.005, 0x59636c);
  }
  for (const y of [0.085, RACK.height-0.05]) box(shellParts, 0, y, -0.51, 0.69, 0.07, 1.09, frameColor);
  box(shellParts, 0, RACK.height/2, -1.04, 0.65, RACK.height, 0.018, 0x18232f);
  box(shellParts, 0, 0.025, -0.52, 0.64, 0.05, 1.0, 0x0e1720);
  for (const x of [-0.242,0.242]) box(shellParts,x,1.115,0.001,0.026,1.93,0.018,0x242b31);
  const shell = merge(shellParts);
  instances(shell, solidMat, slots, group);

  const counts = { graphiteTriangles: 0, hardwareTriangles: 0 };
  for (let variant = 0; variant < 8; variant++) {
    const selected = slots.filter(s => s.variant === variant);
    const aFaces = [], aSolids = [], bFaces = [], bSolids = [], bPlastic = [];
    face(aFaces, 0, RACK.height/2, 0.003, 0.63, RACK.height-0.03, variant);
    // Série A : façades texturées, portes encadrées et poignées en volume.
    for (const x of [-0.298, 0.298]) box(aSolids, x, 1.10, 0.015, 0.013, 1.91, 0.023, 0x4e5c6e);
    for (const y of [0.15, 2.05]) box(aSolids, 0, y, 0.016, 0.61, 0.015, 0.026, 0x607084);
    box(aSolids, 0.279, 1.20, 0.043, 0.014, 0.18, 0.028, 0x7b8a9b);
    for (const d of rackLayout(variant)) {
      box(aSolids, 0, d.y-d.height/2, 0.009, RACK.deviceWidth, 0.002, 0.006, 0x11151a);
      if (d.kind === 'blank') {
        face(bFaces,0,d.y,0.007,RACK.deviceWidth,d.height,variant);
        bevel(bSolids,0,d.y,0.003,RACK.deviceWidth,d.height,0.010,0x282d32); continue;
      }
      // Corps en acier, façade indépendante et supports vissés aux rails.
      const networkSwitch=d.kind==='switch',chassisDepth=networkSwitch?0.285:d.kind==='patch'?0.055:0.66;
      box(bSolids,0,d.y,d.depth-chassisDepth/2,RACK.deviceWidth,d.height,chassisDepth,networkSwitch?0x99a2a8:0x4c5258,true);
      const parts = deviceParts(d), ports = parts.filter(p => p.kind === 'port');
      face(bFaces,0,d.y,d.depth+0.0005,RACK.deviceWidth,d.height,variant,ports);
      if(networkSwitch){
        const compact=d.family==='switch24',x=compact?-0.184:-0.206,w=compact?0.030:0.017;
        bevel(bPlastic,x,d.y,d.depth+0.001,w,0.027,0.003,0x111b22);
        face(bFaces,x,d.y,d.depth+0.003,w-0.003,0.023,variant);
        for(const y of [-1,1])box(bSolids,0,d.y+y*(d.height/2-0.001),d.depth+0.001,RACK.deviceWidth,0.0015,0.002,0xa6b0b7);
      }
      for (const p of parts) {
        if (p.kind === 'drive') {
          bevel(bPlastic,p.x,p.y,d.depth+p.depth/2,p.w,p.h,p.depth,0x14191d,0.0008);
          face(bFaces,p.x,p.y,d.depth+p.depth+0.0005,p.w-0.0018,p.h-0.0018,variant);
          // Loquet affleurant et petit verrou coloré, sans grandes poignées répétées.
          const vertical=p.format==='sff';
          bevel(bPlastic,p.x-p.w*0.24,p.y,d.depth+p.depth+0.0007,
            vertical?0.0035:p.w*0.56,vertical?p.h*0.64:0.007,0.0025,0x2c3338,0.0005);
          box(bSolids,p.x-p.w*0.34,p.y-p.h*0.31,d.depth+p.depth+0.002,
            vertical?0.002:0.007,vertical?0.006:0.002,0.001,0x3f6c78);
        } else {
          // Parois intérieures des prises, avec fond en retrait.
          box(bPlastic,p.x,p.y,d.depth-0.008,p.w,p.h,0.016,0x11161a,true);
          for (const y of [-1,1]) box(bSolids,p.x,p.y+y*p.h/2,d.depth+0.0003,p.w,0.0007,0.001,networkSwitch?0x9ba8b0:0x596166);
          if(p.format==='sfp')for(const side of [-1,1])box(bSolids,p.x+side*p.w/2,p.y,d.depth+0.001,0.0008,p.h,0.002,0x97a3ad);
        }
      }
      if (d.family==='sff8' || d.family==='sff16') {
        const start=d.family==='sff8'?-0.055:0.089, width=0.206-start;
        // Deux blocs de ventilation séparés par une nervure visible en perspective.
        for (let i=0;i<2;i++) {
          const x=start+width*(i+0.5)/2;
          bevel(bPlastic,x,d.y,d.depth+0.001,width/2-0.004,d.height-0.012,0.005,0x151a1d);
          face(bFaces,x,d.y,d.depth+0.004,width/2-0.006,d.height-0.014,variant);
        }
      }
      for (const led of deviceLEDs(d)) box(bPlastic,led.x,led.y,led.depth-0.0005,0.003,0.0022,0.0008,0x080c0f);
      for (const side of [-1,1]) {
        bevel(bSolids,side*0.2325,d.y,d.depth+0.001,0.0176,d.height,0.0035,networkSwitch?0x99a2a8:0x4b535a,0.0005);
        for (const y of [-1,1]) screw(bSolids,side*0.2325,d.y+y*d.height*0.31,d.depth+0.004);
      }
    }
    // Brassage branché dans les ports réels, avec boucles et connecteurs compacts.
    const network = rackLayout(variant).filter(d => d.kind === 'switch' || d.kind === 'patch');
    for (let pair=0;pair<network.length/2;pair++) for (let c=0;c<6;c++) {
      const from=network[pair*2],to=network[pair*2+1];
      const ports=deviceParts(from).filter(p=>p.format==='rj45');
      const a=ports[Math.floor(c*ports.length/6)],b=deviceParts(to)[c*4+1];
      const color=c%3===0?0x5c7eae:c%3===1?0x428997:0x706a91;
      const curve=new THREE.CubicBezierCurve3(new THREE.Vector3(a.x,a.y,from.depth+0.012),
        new THREE.Vector3(a.x,a.y-0.037-c*0.003,0.075),
        new THREE.Vector3(b.x,b.y-0.053-c*0.002,0.075),new THREE.Vector3(b.x,b.y,to.depth+0.012));
      bPlastic.push({geometry:new THREE.TubeGeometry(curve,12,0.0018,5,false),color});
      for (const [port,device] of [[a,from],[b,to]]) bevel(bPlastic,port.x,port.y,device.depth+0.008,0.009,0.007,0.016,color);
    }
    face(bFaces, 0, 2.108, 0.040, 0.60, 0.041, variant);
    const ag = merge(aFaces), ad = merge(aSolids), bg = merge(bFaces), bd = merge(bSolids), bp = merge(bPlastic);
    instances(ag, faceMat, selected, graphite); instances(ad, solidMat, selected, graphite);
    // Les façades B conservent leurs positions à toute distance. Seules les petites pièces s'effacent au loin.
    instances(bg, faceMat, selected, hardware);
    detailedMeshes.push(instances(bd, solidMat, selected, hardware),instances(bp, plasticMat, selected, hardware));
    // ponytail: reflet des façades simplifié sous le sol satiné ; réflexion planaire si un sol poli est demandé.
    instances(reflected(ag), mirrorMat, selected, mirror);
    counts.graphiteTriangles += (ag.index.count + ad.index.count) / 3 * selected.length;
    counts.hardwareTriangles += (bg.index.count + bd.index.count + bp.index.count) / 3 * selected.length;
  }
  let style = 'graphite', viewRow = null;
  return { group, counts,
    setStyle(value) { if (style !== value) viewRow = null; style = value; graphite.visible = style !== 'hardware'; hardware.visible = style === 'hardware'; },
    setView(camZ) {
      const row = Math.floor(camZ / RACK.spacing);
      if (row === viewRow) return;
      viewRow = row;
      // ponytail: petits volumes limités à 16 m ; augmenter cette distance si une vue avec zoom est ajoutée.
      const detailed = s => { const distance = row * RACK.spacing - s.z; return distance > -2 && distance < 16; };
      if (style === 'hardware') for (const mesh of detailedMeshes) place(mesh,mesh.userData.slots.filter(detailed));
    },
    setMirror(enabled) { mirror.visible = enabled; }
  };
}
