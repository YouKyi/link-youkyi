// Une seule implantation pour les textures, les volumes et les voyants.
// Dimensions en mètres : équipements serveurs génériques, baies 42U.
export const RACK = Object.freeze({ units: 42, unit: 0.04445, base: 0.18,
  height: 2.16, width: 0.70, deviceWidth: 0.444, depth: 1.10, x: 1.50, spacing: 0.84, rows: 48 });
export const STYLES = Object.freeze(['graphite', 'hardware']);
export const SCENE_DEFAULTS = Object.freeze({ camSpeed: 0.14, blink: 1.0, density: 0.78,
  ledSize: 0.007, glow: 0.34, fog: 0.052, veil: 0.38, palette: 'violet', bg: '#090b13',
  mirror: 1, ramp: 1.0, shaft: 0.35, dust: 0.30, traffic: 0.95, rackStyle: 'graphite' });
export function mulberry32(s) { return function () {
  s |= 0; s = (s + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ s >>> 15, 1 | s);
  t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}; }

export function rackLayout(variant) {
  const rnd = mulberry32(3000 + variant * 277), devices = [];
  let u = 0, middleSwitch = false;
  const add = (kind, units) => {
    const height = units * RACK.unit - 0.004;
    devices.push({ kind, units, u, height, family: kind === 'server' ? (units === 1 ? 'lff4' : ['sff8','sff16','lff12'][(variant + u) % 3]) : kind === 'storage' ? 'lff24' : kind === 'switch' ? (u < 30 ? 'switch24' : 'switch48') : kind, y: RACK.base + (u + units / 2) * RACK.unit,
      // Un tiroir légèrement avancé rend l'assemblage perceptible en perspective.
      depth: kind === 'blank' ? 0 : (kind === 'storage' ? 0.012 : 0.008) +
        (kind === 'server' && u > 12 && u < 20 && variant % 3 === 0 ? 0.016 : 0) });
    u += units;
  };
  while (u < 36) {
    if (!middleSwitch && u >= 22) { add('switch', 1); add('patch', 1); middleSwitch = true; continue; }
    const r = rnd();
    let kind = r < 0.10 ? 'blank' : (r < (variant % 3 === 1 ? 0.62 : 0.28) ? 'storage' : 'server');
    let units = kind === 'storage' ? 4 : (kind === 'blank' || rnd() < 0.2 ? 1 : 2);
    if (u + units > 36) { units = 36 - u >= 2 ? 2 : 1; kind = units === 2 ? 'server' : 'blank'; }
    add(kind, units);
  }
  for (const kind of ['blank', 'switch', 'patch', 'switch', 'patch', 'blank']) add(kind, 1);
  return devices;
}

export function deviceParts(d) {
  const parts = [];
  const add = (kind, x, y, w, h, depth, format) => parts.push({ kind, x, y: d.y + y, w, h, depth, format });
  if (d.kind === 'switch') {
    const compact = d.family === 'switch24';
    for (let row = 0; row < 2; row++) for (let col = 0; col < (compact ? 12 : 24); col++)
      add('port', compact ? -0.125 + col * 0.021 + Math.floor(col / 6) * 0.008 : -0.176 + col * 0.014,
        (row - 0.5) * 0.016, compact ? 0.014 : 0.0125, 0.011, 0.001, 'rj45');
    for (let row = 0; row < 2; row++) for (let col = 0; col < (compact ? 1 : 2); col++)
      add('port', 0.178 + col * 0.022, (row - 0.5) * 0.016, 0.012, 0.011, 0.001, 'sfp');
  } else if (d.kind === 'patch') {
    for (let col = 0; col < 24; col++) add('port', (col - 11.5) * 0.017, -0.002, 0.014, 0.013, 0.001, 'rj45');
  } else if (d.family?.startsWith('sff')) {
    const count = d.family === 'sff8' ? 8 : 16;
    for (let col = 0; col < count; col++) add('drive', -0.202 + col * 0.018, 0, 0.0155, 0.068, 0.004, 'sff');
  } else if (d.kind === 'server' || d.kind === 'storage') {
    const rows = d.family === 'lff24' ? 6 : d.family === 'lff12' ? 3 : 1;
    for (let row = 0; row < rows; row++) for (let col = 0; col < 4; col++)
      add('drive', (col - 1.5) * 0.106, (row - (rows-1)/2) * 0.027, 0.099, rows === 1 ? 0.025 : 0.023, 0.0045, 'lff');
  }
  return parts;
}

export function deviceLEDs(d) {
  if (d.kind === 'blank' || d.kind === 'patch') return [];
  const leds = deviceParts(d).map((p, i) => ({
    x: p.x + p.w * 0.34, y: d.kind === 'switch' ? p.y + Math.sign(p.y - d.y) * (p.h / 2 + 0.0018) : p.y - p.h * 0.32,
    depth: d.depth + p.depth + 0.0015,
    traffic: 1, status: d.family === 'lff24' && d.u === 0 && i === 23 ? 'amber' : 'green'
  }));
  leds.push({ x: 0.217, y: d.y + d.height * 0.28, depth: d.depth + 0.003,
    traffic: 0, status: 'power' });
  return leds;
}

export function tunnelSlots() {
  const slots = [], period = RACK.rows * RACK.spacing;
  for (let p = 0; p < 2; p++) for (const side of [-1, 1]) for (let r = 0; r < RACK.rows; r++) {
    const rnd = mulberry32(((r * 73856093) ^ (side === 1 ? 19349663 : 97)) >>> 0);
    slots.push({ side, r, p, z: 2.8 - p * period - r * RACK.spacing, variant: Math.floor(rnd() * 8) });
  }
  return slots;
}

export function cameraFraming(aspect) {
  const portrait = Math.max(0, Math.min(1, 1 - aspect));
  return { fov: 58 + portrait * 48, height: 1.34 - portrait * 0.08, targetY: 1.19 };
}
