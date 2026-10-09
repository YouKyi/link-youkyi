import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RACK, STYLES, SCENE_DEFAULTS, rackLayout, deviceParts, deviceLEDs, tunnelSlots, cameraFraming } from '../assets/vendor/dc-layout.mjs';

// Vérifie le contrat partagé entre façades, châssis 3D et voyants.
for (let v = 0; v < 8; v++) {
  const devices = rackLayout(v);
  assert.deepEqual(devices, rackLayout(v), 'Implantation déterministe pour comparer A/B et capturer les posters');
  assert.equal(devices.reduce((sum, d) => sum + d.units, 0), 42);
  const network=devices.filter(d=>d.kind==='switch'||d.kind==='patch');
  assert.deepEqual(network.map(d=>d.kind),['switch','patch','switch','patch','switch','patch']);
  assert(network[0].y>1.1&&network[0].y<1.5,'Un switch doit rester visible à hauteur du regard');
  let previousTop = 0;
  for (const d of devices) {
    if(d.kind==='server')assert([1,2].includes(d.units),'Les serveurs utilisent des châssis 1U ou 2U');
    if(d.kind==='switch'){
      const parts=deviceParts(d),compact=d.family==='switch24';
      assert.equal(parts.filter(p=>p.format==='rj45').length,compact?24:48);
      assert.equal(parts.filter(p=>p.format==='sfp').length,compact?2:4);
      assert.equal(deviceLEDs(d).filter(l=>l.traffic>0).length,parts.length,'Chaque port a son voyant d’activité');
    }
    assert(d.y - d.height / 2 >= previousTop, `Chevauchement dans la baie ${v}`);
    previousTop = d.y + d.height / 2;
    assert(previousTop < RACK.height);
    for (const p of deviceParts(d)) {
      assert(Math.abs(p.x) + p.w / 2 <= RACK.deviceWidth/2, 'Une pièce dépasse du châssis');
      assert(Math.abs(p.y - d.y) + p.h / 2 <= d.height / 2, 'Une pièce dépasse en hauteur');
    }
    for (const led of deviceLEDs(d)) {
      assert(Math.abs(led.x) < RACK.deviceWidth/2 && Math.abs(led.y - d.y) < d.height / 2);
      assert(led.depth >= d.depth, 'Le voyant doit rester devant son équipement');
      assert(led.traffic>=0&&led.traffic<=1);
    }
    if(d.kind==='server'||d.kind==='storage'){
      const expected={sff8:8,sff16:16,lff4:4,lff12:12,lff24:24}[d.family];
      assert.equal(deviceParts(d).length,expected,'Nombre de cartouches par famille');
      assert(deviceLEDs(d).filter(l=>l.status!=='power').every(l=>l.traffic>0),'Les voyants des disques doivent aussi être animés');
      assert.equal(deviceLEDs(d).find(l=>l.status==='power').traffic,0,'Le témoin système reste stable');
    }
  }
}
const slots = tunnelSlots(), period = RACK.rows * RACK.spacing;
assert.equal(RACK.rows % 16, 0, 'Le cycle des rampes orange doit se raccorder au retour du travelling');
assert.equal(slots.length, RACK.rows * 4);
for (const a of slots.filter(s => s.p === 0)) {
  const b = slots.find(s => s.p === 1 && s.side === a.side && s.r === a.r);
  assert.equal(a.variant, b.variant);
  assert(Math.abs(a.z - b.z - period) < 1e-10, 'Raccord périodique des deux sections');
}
const desktop = cameraFraming(16/9), mobile = cameraFraming(390/844);
assert(mobile.fov > desktop.fov && mobile.fov < 100, 'Cadrage portrait distinct, sans ultra grand-angle');
for (const config of [SCENE_DEFAULTS, JSON.parse(readFileSync(new URL('../config/pro.json', import.meta.url))).dc]) {
  assert(STYLES.includes(config.rackStyle));
  for (const key of ['camSpeed', 'fog', 'ledSize', 'glow', 'ramp']) assert(Number.isFinite(config[key]) && config[key] > 0);
}
// Même importmap que le navigateur, pour valider la géométrie sans GPU ni dépendance supplémentaire.
const modelURL = new URL('../assets/vendor/dc-racks.js', import.meta.url);
const modelSource = readFileSync(modelURL, 'utf8')
  .replace("from 'three'", `from ${JSON.stringify(new URL('three/three.module.js', modelURL).href)}`)
  .replace("from './dc-layout.mjs'", `from ${JSON.stringify(new URL('dc-layout.mjs', modelURL).href)}`);
const { buildRackModels } = await import('data:text/javascript;base64,' + Buffer.from(modelSource).toString('base64'));
const models = buildRackModels(slots, null);
models.group.traverse(mesh => {
  if (!mesh.isMesh) return;
  const { index, attributes: { position: p, normal: n } } = mesh.geometry;
  assert(index && index.count % 3 === 0, 'Triangles indexés complets');
  for (const attribute of Object.values(mesh.geometry.attributes)) assert.equal(attribute.count, p.count);
  for (const vertex of index.array) assert(vertex < p.count, 'Index hors de la géométrie fusionnée');
  for (let i = 0; i < index.count; i += 3) {
    const [a, b, c] = index.array.subarray(i, i + 3);
    const ux = p.getX(b)-p.getX(a), uy = p.getY(b)-p.getY(a), uz = p.getZ(b)-p.getZ(a);
    const vx = p.getX(c)-p.getX(a), vy = p.getY(c)-p.getY(a), vz = p.getZ(c)-p.getZ(a);
    const facing = (uy*vz-uz*vy)*n.getX(a) + (uz*vx-ux*vz)*n.getY(a) + (ux*vy-uy*vx)*n.getZ(a);
    assert(facing >= -1e-8, 'Orientation des faces et des reflets incohérente');
  }
});
console.log('Scène : 8 baies 42U, switches, pièces/LED, tunnel, cadrage mobile, index et orientation des reflets vérifiés.');
