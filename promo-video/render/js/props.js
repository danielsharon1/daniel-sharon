import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Lines, roundedRectPath, roundedRectShapeArc, v2to3, circlePts } from './lines.js';
import { clamp } from './util.js';

const chrome = () => new THREE.MeshPhysicalMaterial({ color: 0xd8dde2, metalness: 1, roughness: 0.16, envMapIntensity: 1.3 });
const rubber = () => new THREE.MeshPhysicalMaterial({ color: 0x16191b, metalness: 0, roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.5 });

// ---------------- hex dumbbell (axis along X) ----------------
export function makeDumbbell() {
  const g = new THREE.Group(); const solid = new THREE.Group(); const flat = new THREE.Group(); g.add(solid); g.add(flat);
  const mChrome = chrome(), mRub = rubber();
  const mMint = new THREE.MeshPhysicalMaterial({ color: 0x4fe3c1, emissive: 0x2a9c82, emissiveIntensity: 0.5, metalness: 0.2, roughness: 0.3 });
  const flatMat = new THREE.MeshBasicMaterial({ color: 0x4fe3c1, transparent: true, toneMapped: false });
  const parts = [];
  const add = (geo, mat, x, rotZ = true) => { const m = new THREE.Mesh(geo, mat); if (rotZ) m.rotation.z = Math.PI / 2; m.position.x = x; solid.add(m); const f = new THREE.Mesh(geo, flatMat); f.rotation.copy(m.rotation); f.position.copy(m.position); flat.add(f); parts.push(m); return m; };
  add(new THREE.CylinderGeometry(0.42, 0.42, 12.6, 40), mChrome, 0);
  // knurl rings
  for (let i = -5; i <= 5; i++) if (Math.abs(i) > 1) add(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 32), mChrome, i * 0.48);
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.95, 0.95, 0.5, 40), mChrome, s * 6.05);
    const hex = add(new THREE.CylinderGeometry(3.15, 3.15, 3.5, 6), mRub, s * 8.1); hex.rotation.y = Math.PI / 6;
    add(new THREE.CylinderGeometry(1.45, 1.45, 0.12, 40), mChrome, s * 9.9);
    add(new THREE.TorusGeometry(1.55, 0.09, 12, 48).rotateY(Math.PI / 2), mMint, s * 9.9, false);
  }
  return { group: g, solid, flat, flatMat, setFlat(a) { flatMat.opacity = a; flat.visible = a > 0.002; solid.visible = a < 0.998; } };
}

// ---------------- bumper plate (axis along Z) ----------------
export function makePlate(R = 9) {
  const g = new THREE.Group();
  const prof = [[2.5, -1.5], [3.7, -1.5], [3.9, -1.05], [R - 1.0, -1.05], [R - 0.35, -1.45], [R, -1.2], [R, 1.2], [R - 0.35, 1.45], [R - 1.0, 1.05], [3.9, 1.05], [3.7, 1.5], [2.5, 1.5], [2.5, -1.5]].map(([r, z]) => new THREE.Vector2(r, z));
  const rub = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), rubber()); rub.rotation.x = Math.PI / 2; g.add(rub);
  const hubProf = [[1.25, -1.62], [2.6, -1.62], [2.6, 1.62], [1.25, 1.62], [1.25, -1.62]].map(([r, z]) => new THREE.Vector2(r, z));
  const hub = new THREE.Mesh(new THREE.LatheGeometry(hubProf, 96), chrome()); hub.rotation.x = Math.PI / 2; g.add(hub);
  // text ring
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
  x.translate(512, 512); x.fillStyle = '#4fe3c1'; x.font = '700 64px "IBM Plex Mono"'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const txt = ' COACH DANIEL · 20 KG · COACH DANIEL · 20 KG ·'; const n = txt.length;
  for (let i = 0; i < n; i++) { x.save(); x.rotate(i / n * Math.PI * 2); x.fillText(txt[i], 0, -395); x.restore(); }
  x.strokeStyle = 'rgba(79,227,193,.6)'; x.lineWidth = 5; x.beginPath(); x.arc(0, 0, 455, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(0, 0, 335, 0, Math.PI * 2); x.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  for (const s of [1, -1]) { const ring = new THREE.Mesh(new THREE.PlaneGeometry(R * 2 * 0.95, R * 2 * 0.95), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false })); ring.position.z = s * 1.07; if (s < 0) ring.rotation.y = Math.PI; g.add(ring); }
  return { group: g, R };
}

// ---------------- app icon (3D) ----------------
export function iconCanvas(size = 1024) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, '#3fae8e'); g.addColorStop(1, '#0b5b46'); x.fillStyle = g; x.fillRect(0, 0, size, size);
  const r = x.createRadialGradient(size * 0.3, size * 0.25, 10, size * 0.3, size * 0.25, size * 0.8); r.addColorStop(0, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = r; x.fillRect(0, 0, size, size);
  x.translate(size / 2, size / 2); x.rotate(-Math.PI / 4.6); x.fillStyle = '#e8faf4'; const u = size / 180;
  x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 18 * u; x.shadowOffsetY = 6 * u;
  const rr = (cx, cy, w, h, rad) => { x.beginPath(); x.roundRect(cx - w / 2, cy - h / 2, w, h, rad); x.fill(); };
  rr(0, 0, 70 * u, 9 * u, 4 * u);
  for (const s of [-1, 1]) { rr(s * 34 * u, 0, 12 * u, 46 * u, 5 * u); rr(s * 46 * u, 0, 10 * u, 34 * u, 4.5 * u); rr(s * 55 * u, 0, 7 * u, 12 * u, 3 * u); }
  return c;
}
export function makeAppIcon() {
  const g = new THREE.Group(); const S = 6, T = 1.1;
  const body = new THREE.Mesh(new RoundedBoxGeometry(S, S, T, 8, 1.35), new THREE.MeshPhysicalMaterial({ color: 0x177a60, metalness: 0.1, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 }));
  g.add(body);
  const tex = new THREE.CanvasTexture(iconCanvas()); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const fg = new THREE.ShapeGeometry(roundedRectShapeArc(S - 0.02, S - 0.02, 1.33), 24);
  const p = fg.attributes.position, uv = fg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / S + 0.5, p.getY(i) / S + 0.5);
  const face = new THREE.Mesh(fg, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.6 }));
  face.position.z = T / 2 + 0.005; g.add(face);
  return { group: g };
}

// ---------------- laptop ----------------
export const LAP = { BW: 31.2, BD: 21.6, BH: 0.95, LW: 31.2, LH: 20.6, LT: 0.5, DW: 28.6, DH: 28.6 / (2160 / 1416) };
export function makeLaptop() {
  const { BW, BD, BH, LW, LH, LT, DW, DH } = LAP;
  const g = new THREE.Group(); const solid = new THREE.Group(); const lineGroup = new THREE.Group(); g.add(solid); g.add(lineGroup);
  const clipSolid = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e3), clipLines = new THREE.Plane(new THREE.Vector3(0, -1, 0), -1e3);
  const alu = new THREE.MeshPhysicalMaterial({ color: 0x3b3f45, metalness: 1, roughness: 0.36, envMapIntensity: 1.0 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(BW, BH, BD, 4, 0.42), alu); base.position.y = BH / 2; solid.add(base);
  // keyboard deck texture
  const kc = document.createElement('canvas'); kc.width = 2048; kc.height = 1426; const k = kc.getContext('2d');
  k.fillStyle = '#33373c'; k.fillRect(0, 0, 2048, 1426);
  k.fillStyle = '#121416'; k.beginPath(); k.roundRect(150, 70, 1748, 690, 18); k.fill();
  const rows = [14, 14, 14, 13, 12]; let yy = 92;
  for (let r = 0; r < 6; r++) { const n = r === 0 ? 14 : rows[Math.min(4, r - 1)] || 12; const h = r === 0 ? 70 : 104; const kw = (1700 - (n - 1) * 14) / n; for (let i = 0; i < n; i++) { k.fillStyle = '#1d2023'; k.beginPath(); k.roundRect(174 + i * (kw + 14), yy, kw, h, 10); k.fill(); } yy += h + 12; }
  k.fillStyle = '#3d4248'; k.strokeStyle = '#2a2e32'; k.lineWidth = 4; k.beginPath(); k.roundRect(624, 820, 800, 520, 26); k.fill(); k.stroke();
  const ktex = new THREE.CanvasTexture(kc); ktex.colorSpace = THREE.SRGBColorSpace; ktex.anisotropy = 8;
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.8, BD - 0.8), new THREE.MeshPhysicalMaterial({ map: ktex, metalness: 0.4, roughness: 0.55 }));
  deck.rotation.x = -Math.PI / 2; deck.position.y = BH + 0.02; solid.add(deck);
  // lid
  const hinge = new THREE.Group(); hinge.position.set(0, BH, -BD / 2 + 0.35); g.add(hinge);
  const lidSolid = new THREE.Group(); hinge.add(lidSolid);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(LW, LH, LT, 4, 0.22), alu); lid.position.set(0, LH / 2, -LT / 2); lidSolid.add(lid);
  const bezel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShapeArc(LW - 0.3, LH - 0.3, 0.55), 16), new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.2, clearcoat: 1 }));
  bezel.position.set(0, LH / 2, 0.01); lidSolid.add(bezel);
  const canvas = document.createElement('canvas'); canvas.width = 2160; canvas.height = 1416; const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true }));
  disp.position.set(0, LH / 2 + 0.35, 0.03); lidSolid.add(disp);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(LW - 0.3, LH - 0.3), new THREE.MeshPhysicalMaterial({ color: 0, roughness: 0.05, clearcoat: 1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 0.025 }));
  glass.position.set(0, LH / 2, 0.02); glass.visible = false;
  const mats = [alu, deck.material, bezel.material, disp.material, glass.material];
  for (const m of mats) m.clippingPlanes = [clipSolid];
  // blueprint lines (base box + lid + display + trackpad)
  const box = (w, h, d, cx, cy, cz) => { const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2; const V = (a, b, c) => new THREE.Vector3(a, b, c); return [[V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), V(x0, y0, z0)], [V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1), V(x0, y1, z0)], [V(x0, y0, z0), V(x0, y1, z0)], [V(x1, y0, z0), V(x1, y1, z0)], [V(x1, y0, z1), V(x1, y1, z1)], [V(x0, y0, z1), V(x0, y1, z1)]]; };
  const baseLines = new Lines([...box(BW, BH, BD, 0, BH / 2, 0),
    v2to3(roundedRectPath(12, 7.8, 0.4, 4), 0).map(v => new THREE.Vector3(v.x, BH + 0.01, v.y + 5.9)),
    v2to3(roundedRectPath(BW - 3.6, 7.3, 0.3, 4), 0).map(v => new THREE.Vector3(v.x, BH + 0.01, v.y - 4.6))], { width: 1.5 });
  const lidLines = new Lines([...box(LW, LH, LT, 0, LH / 2, -LT / 2), v2to3(roundedRectPath(DW, DH, 0.2, 2), 0.02).map(v => new THREE.Vector3(v.x, v.y + LH / 2 + 0.35, 0.02))], { width: 1.5 });
  const lidLineGroup = new THREE.Group(); hinge.add(lidLineGroup); lidLineGroup.add(lidLines.object); lineGroup.add(baseLines.object);
  for (const l of [baseLines, lidLines]) l.material.clippingPlanes = [clipLines];
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(BW * 1.4, 0.6), new THREE.MeshBasicMaterial({ color: 0x9ff5df, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  scan.renderOrder = 10; g.add(scan);
  const L = {
    group: g, hinge, canvas, ctx, tex, disp, lines: [baseLines, lidLines], lidLineGroup, lidSolid, solid, scan,
    setOpen(a) { hinge.rotation.x = a; },
    setLines(p, o = 1) { baseLines.setProgress(Math.min(1, p * 1.4)); lidLines.setProgress(Math.max(0, p * 1.4 - 0.4)); baseLines.opacity = o; lidLines.opacity = o; },
    // m: 0 lines only, 1 solid only; scan sweeps bottom -> top in world Y (height of laptop ~22)
    setMaterialize(m) {
      L._m = m; solid.visible = lidSolid.visible = m > 0.001; lineGroup.visible = lidLineGroup.visible = m < 0.999;
      scan.visible = m > 0.001 && m < 0.999; L._y = -1 + m * 24; scan.position.set(0, L._y, 0); scan.rotation.x = -Math.PI / 2;
    },
    updateClip() {
      g.updateMatrixWorld(true);
      const y = L._m >= 0.999 ? 1e3 : (L._m <= 0.001 ? -1e3 : L._y);
      const w = new THREE.Vector3(0, y, 0).applyMatrix4(g.matrixWorld).y;
      clipSolid.set(new THREE.Vector3(0, -1, 0), w); clipLines.set(new THREE.Vector3(0, 1, 0), -w);
    },
    displayWorld(u, v) { g.updateMatrixWorld(true); return new THREE.Vector3((u - 0.5) * DW, (0.5 - v) * DH + LH / 2 + 0.35, 0.02).applyMatrix4(disp.parent.matrixWorld); },
    compose(img, { taps = [], url = 'coach-daniel.expo.app/admin/editor' } = {}) {
      const c = ctx; c.fillStyle = '#0b0d0e'; c.fillRect(0, 0, 2160, 1416);
      // browser bar (dark)
      c.fillStyle = '#1a1d1f'; c.fillRect(0, 0, 2160, 66); c.fillStyle = '#2a2e31'; c.fillRect(0, 65, 2160, 1);
      for (const [i, col] of ['#ff5f57', '#febc2e', '#28c840'].entries()) { c.fillStyle = col; c.beginPath(); c.arc(34 + i * 30, 33, 9, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#0f1112'; c.beginPath(); c.roundRect(680, 14, 800, 38, 19); c.fill();
      c.fillStyle = '#9aa3a8'; c.font = '400 22px "IBM Plex Mono"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(url, 1080, 34);
      if (img) c.drawImage(img, 0, 66, 2160, 1350);
      for (const t of taps) { const x = t.x * 1.5, y = t.y * 1.5 + 66; let a = t.age < 0 ? 0.35 * clamp(1 + t.age / 0.15) : 0.35 * (1 - clamp(t.age / 0.4)); const r = t.age < 0 ? 30 : 30 + 50 * clamp(t.age / 0.4); if (a > 0.003) { c.fillStyle = `rgba(79,227,193,${a * 0.8})`; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); } }
      tex.needsUpdate = true;
    },
  };
  L.setOpen(-0.22); L.setMaterialize(1);
  return L;
}

// ---------------- 3D weight chart ----------------
export function makeChart(data, { w = 22, h = 9, y0 = 73, y1 = 76.2 } = {}) {
  const g = new THREE.Group();
  const x = (d) => (d / (data.length - 1) - 0.5) * w;
  const y = (v) => ((v - y0) / (y1 - y0) - 0.5) * h;
  // trend (EMA)
  let ema = data[0][1]; const trend = data.map(([d, v], i) => { ema = i ? ema + 0.32 * (v - ema) : v; return ema; });
  const pts = trend.map((v, i) => new THREE.Vector3(x(i), y(v), 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const SEG = 400, RAD = 10;
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, SEG, 0.13, RAD, false), new THREE.MeshBasicMaterial({ color: 0x4fe3c1, toneMapped: false }));
  g.add(tube);
  const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, SEG, 0.42, RAD, false), new THREE.MeshBasicMaterial({ color: 0x4fe3c1, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  g.add(glow);
  // area under curve
  const shape = new THREE.Shape(); shape.moveTo(x(0), -h / 2); for (const p of curve.getPoints(200)) shape.lineTo(p.x, p.y); shape.lineTo(x(data.length - 1), -h / 2); shape.lineTo(x(0), -h / 2);
  const ag = new THREE.ShapeGeometry(shape, 1); const pa = ag.attributes.position; const cols = new Float32Array(pa.count * 4);
  for (let i = 0; i < pa.count; i++) { const a = clamp((pa.getY(i) + h / 2) / h) * 0.32; cols.set([0.31, 0.89, 0.76, a], i * 4); }
  ag.setAttribute('color', new THREE.BufferAttribute(cols, 4));
  const areaMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, clippingPlanes: [] });
  const area = new THREE.Mesh(ag, areaMat); area.position.z = -0.05; g.add(area);
  // raw points
  const dots = []; const dg = new THREE.SphereGeometry(0.16, 16, 12); const dm = new THREE.MeshBasicMaterial({ color: 0xb9c3c7, toneMapped: false });
  data.forEach(([d, v], i) => { const m = new THREE.Mesh(dg, dm); m.position.set(x(i), y(v), 0.1); g.add(m); dots.push(m); });
  // grid lines
  const gl = []; const levels = [73, 74, 75, 76];
  for (const L of levels) gl.push([new THREE.Vector3(-w / 2 - 0.6, y(L), -0.1), new THREE.Vector3(w / 2 + 0.6, y(L), -0.1)]);
  const grid = new Lines(gl, { width: 1, opacity: 0.35, color: 0x9ff5df });
  g.add(grid.object);
  const clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0); areaMat.clippingPlanes = [clip];
  const C = {
    group: g, levels, y, x, n: data.length, trend, grid,
    setProgress(p, o = 1) {
      const n = Math.round(SEG * clamp(p)) * RAD * 6;
      tube.geometry.setDrawRange(0, n); glow.geometry.setDrawRange(0, n);
      tube.visible = glow.visible = n > 0;
      dots.forEach((d, i) => { const k = clamp((p * (data.length - 1) - i + 1.5) / 1.5); d.scale.setScalar(Math.max(0.0001, k)); d.visible = k > 0.01; });
      g.updateMatrixWorld(true);
      const xe = x(0) + (x(data.length - 1) - x(0)) * clamp(p);
      const pt = new THREE.Vector3(xe, 0, 0).applyMatrix4(g.matrixWorld); const nrm = new THREE.Vector3(-1, 0, 0).transformDirection(g.matrixWorld);
      clip.setFromNormalAndCoplanarPoint(nrm, pt);
      areaMat.opacity = o; tube.material.opacity = o; grid.opacity = 0.35 * o;
    },
    headWorld(p) { const i = clamp(p) * (data.length - 1); const v = curve.getPoint(clamp(p)); return v.applyMatrix4(g.matrixWorld); },
    pointWorld(i, val) { return new THREE.Vector3(x(i), y(val), 0).applyMatrix4(g.matrixWorld); },
  };
  return C;
}

// ---------------- data beam ----------------
export function makeBeam() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x9ff5df, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const mat2 = new THREE.MeshBasicMaterial({ color: 0x4fe3c1, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  let tube, glow, SEG = 220, RAD = 8;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 16), mat); g.add(head);
  return {
    group: g,
    setPath(a, b, lift = 8) {
      if (tube) { g.remove(tube); g.remove(glow); tube.geometry.dispose(); glow.geometry.dispose(); }
      const m1 = a.clone().lerp(b, 0.33).add(new THREE.Vector3(0, lift, 2)), m2 = a.clone().lerp(b, 0.66).add(new THREE.Vector3(0, lift * 0.8, 2));
      this.curve = new THREE.CatmullRomCurve3([a, m1, m2, b]);
      tube = new THREE.Mesh(new THREE.TubeGeometry(this.curve, SEG, 0.07, RAD, false), mat); glow = new THREE.Mesh(new THREE.TubeGeometry(this.curve, SEG, 0.3, RAD, false), mat2);
      g.add(tube); g.add(glow);
    },
    set(headP, tailP, o = 1) {
      if (!tube) return; const s = Math.round(SEG * clamp(tailP)) * RAD * 6, e = Math.round(SEG * clamp(headP)) * RAD * 6;
      for (const m of [tube, glow]) m.geometry.setDrawRange(s, Math.max(0, e - s));
      mat.opacity = o; mat2.opacity = 0.25 * o; head.position.copy(this.curve.getPoint(clamp(headP))); head.visible = headP > 0.001 && headP < 0.999 && o > 0;
      g.visible = o > 0.001 && e > s;
    },
  };
}
