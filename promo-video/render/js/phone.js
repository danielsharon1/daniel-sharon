import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Lines, roundedRectPath, roundedRectShapeArc, v2to3, circlePts } from './lines.js';
import { clamp } from './util.js';

export const MINT = 0x4fe3c1;
const SCR_W = 1179, SCR_H = 2556, APP_TOP = 177;   // app viewport recorded at 393x793 @3x, placed under a 59pt status bar

// Phone dimensions in cm
export const PH = { W: 7.16, H: 14.66, D: 0.83, R: 1.12, SW: 6.56, SR: 0.84 };
PH.SH = PH.SW * SCR_H / SCR_W;

function glassMaterial() {
  // additive reflection-only glass sheet: black base adds nothing, only specular env reflections show
  return new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.06, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 0.025 });
}

export class Phone {
  constructor({ finish = 0x2e3236 } = {}) {
    this.group = new THREE.Group();
    this.solid = new THREE.Group(); this.group.add(this.solid);
    this.lineGroup = new THREE.Group(); this.group.add(this.lineGroup);
    this.clipSolid = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e3);
    this.clipLines = new THREE.Plane(new THREE.Vector3(0, -1, 0), -1e3);
    this.solidMats = []; this.lineObjs = [];
    const { W, H, D, R, SW, SH, SR } = PH;

    // ---- body (extruded rounded rect with bevel)
    const bev = 0.11;
    const shape = roundedRectShapeArc(W - 2 * bev, H - 2 * bev, R - bev);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: D - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 6, curveSegments: 40 });
    geo.translate(0, 0, -(D - 2 * bev) / 2);
    const side = new THREE.MeshPhysicalMaterial({ color: finish, metalness: 1, roughness: 0.26, clearcoat: 0.3, envMapIntensity: 1.25 });
    const back = new THREE.MeshPhysicalMaterial({ color: 0x1c1f22, metalness: 0.2, roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.3 });
    this.body = new THREE.Mesh(geo, [back, side]); this.solid.add(this.body);
    this.solidMats.push(side, back);

    // ---- front glass (black) + screen
    const fz = D / 2 + 0.002;
    const front = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShapeArc(W - 0.14, H - 0.14, R - 0.07), 40), new THREE.MeshPhysicalMaterial({ color: 0x030303, roughness: 0.15, metalness: 0, clearcoat: 1 }));
    front.position.z = fz; this.solid.add(front); this.solidMats.push(front.material);

    this.canvas = document.createElement('canvas'); this.canvas.width = SCR_W; this.canvas.height = SCR_H;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.tex.minFilter = THREE.LinearMipmapLinearFilter; this.tex.generateMipmaps = true;
    const sgeo = new THREE.ShapeGeometry(roundedRectShapeArc(SW, SH, SR), 40);
    // UVs from positions
    const p = sgeo.attributes.position, uv = sgeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / SW + 0.5, p.getY(i) / SH + 0.5);
    this.screenMat = new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false, transparent: true });
    this.screen = new THREE.Mesh(sgeo, this.screenMat); this.screen.position.z = fz + 0.008; this.solid.add(this.screen);
    this.solidMats.push(this.screenMat);
    // controlled fake reflection: a soft diagonal sheen that slides with the phone's rotation
    const shc = document.createElement('canvas'); shc.width = 512; shc.height = 1024; const sx = shc.getContext('2d');
    const sg = sx.createLinearGradient(0, 0, 512, 1024);
    sg.addColorStop(0.0, 'rgba(255,255,255,0)'); sg.addColorStop(0.40, 'rgba(255,255,255,0)'); sg.addColorStop(0.47, 'rgba(255,255,255,0.55)');
    sg.addColorStop(0.53, 'rgba(255,255,255,0.18)'); sg.addColorStop(0.62, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    sx.fillStyle = sg; sx.fillRect(0, 0, 512, 1024);
    this.sheenTex = new THREE.CanvasTexture(shc); this.sheenTex.wrapS = THREE.ClampToEdgeWrapping;
    const gg = new THREE.ShapeGeometry(roundedRectShapeArc(SW, SH, SR), 40);
    { const p = gg.attributes.position, uv = gg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / SW + 0.5, p.getY(i) / SH + 0.5); }
    this.glass = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ map: this.sheenTex, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.glass.position.z = fz + 0.02; this.glass.renderOrder = 6; this.solid.add(this.glass); this.solidMats.push(this.glass.material);

    // ---- buttons
    const btnMat = side;
    const addBtn = (x, y, h) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.12, h, 0.32, 3, 0.05), btnMat); b.position.set(x, y, 0); this.solid.add(b); return b; };
    addBtn(W / 2 + 0.03, 2.9, 2.1);            // power
    addBtn(-W / 2 - 0.03, 3.9, 0.75);          // action
    addBtn(-W / 2 - 0.03, 2.55, 1.25);         // vol+
    addBtn(-W / 2 - 0.03, 1.0, 1.25);          // vol-

    // ---- camera module on back
    const camMat = new THREE.MeshPhysicalMaterial({ color: 0x24282c, metalness: 0.3, roughness: 0.35, clearcoat: 1 });
    const plate = new THREE.Mesh(new RoundedBoxGeometry(3.55, 3.55, 0.16, 4, 0.7), camMat);
    plate.position.set(-W / 2 + 0.45 + 1.78, H / 2 - 0.45 - 1.78, -D / 2 - 0.05); this.solid.add(plate); this.solidMats.push(camMat);
    const lensRing = new THREE.MeshPhysicalMaterial({ color: 0x3a3f44, metalness: 1, roughness: 0.25 });
    const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x05070a, metalness: 0.2, roughness: 0.05, clearcoat: 1, iridescence: 0.6, iridescenceIOR: 1.6 });
    this.solidMats.push(lensRing, lensGlass);
    for (const [lx, ly] of [[-0.78, 0.78], [-0.78, -0.82], [0.85, 0]]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.68, 0.22, 48), lensRing); ring.rotation.x = Math.PI / 2;
      ring.position.set(plate.position.x + lx, plate.position.y + ly, -D / 2 - 0.2); this.solid.add(ring);
      const g = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), lensGlass); g.rotation.y = Math.PI;
      g.position.set(plate.position.x + lx, plate.position.y + ly, -D / 2 - 0.312); this.solid.add(g);
    }
    for (const m of this.solidMats) { m.clippingPlanes = [this.clipSolid]; }

    // ---- blueprint lines
    const zF = D / 2, zB = -D / 2;
    const outer = roundedRectPath(W, H, R, 12);
    const scr = roundedRectPath(SW, SH, SR, 10);
    const isl = roundedRectPath(1.98, 0.58, 0.29, 8).map(q => new THREE.Vector2(q.x, q.y + SH / 2 - 0.17 - 0.29));
    const lines = [];
    lines.push(v2to3(outer, zF));
    lines.push(v2to3(outer, zB));
    for (const [x, y] of [[0, H / 2], [0, -H / 2], [W / 2, 0], [-W / 2, 0], [W / 2 - R * 0.29, H / 2 - R * 0.29], [-W / 2 + R * 0.29, H / 2 - R * 0.29], [W / 2 - R * 0.29, -H / 2 + R * 0.29], [-W / 2 + R * 0.29, -H / 2 + R * 0.29]]) lines.push([new THREE.Vector3(x, y, zF), new THREE.Vector3(x, y, zB)]);
    this.outline = new Lines(lines, { width: 1.7, opacity: 1 });
    this.detail = new Lines([v2to3(scr, zF + 0.01), v2to3(isl, zF + 0.01),
      ...[[2.9, 2.1, 1], [3.9, 0.75, -1], [2.55, 1.25, -1], [1.0, 1.25, -1]].map(([y, h, s]) => v2to3(roundedRectPath(0.32, h, 0.12, 4), 0).map(v => new THREE.Vector3(s * (W / 2 + 0.06), y + v.y, v.x))),
    ], { width: 1.2, opacity: 0.85 });
    this.hidden = new Lines([v2to3(roundedRectPath(3.55, 3.55, 0.7, 8).map(q => new THREE.Vector2(q.x + plate.position.x, q.y + plate.position.y)), zB - 0.13),
      ...[[-0.78, 0.78], [-0.78, -0.82], [0.85, 0]].map(([lx, ly]) => circlePts(plate.position.x + lx, plate.position.y + ly, 0.66, zB - 0.31, 40))], { width: 1.0, opacity: 0.3, dashed: true, dashSize: 0.16, gapSize: 0.12 });
    this.center = new Lines([[new THREE.Vector3(0, H / 2 + 1.3, zF), new THREE.Vector3(0, -H / 2 - 1.3, zF)], [new THREE.Vector3(-W / 2 - 1.3, 0, zF), new THREE.Vector3(W / 2 + 1.3, 0, zF)]], { width: 1.0, opacity: 0.55, dashed: true, dashSize: 0.55, gapSize: 0.18 });
    for (const l of [this.outline, this.detail, this.center, this.hidden]) { l.material.clippingPlanes = [this.clipLines]; this.lineGroup.add(l.object); this.lineObjs.push(l); }

    // ---- scan glow
    const glowTex = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(79,227,193,0)'); gr.addColorStop(0.5, 'rgba(160,255,230,1)'); gr.addColorStop(1, 'rgba(79,227,193,0)'); g.fillStyle = gr; g.fillRect(0, 0, 8, 256); const t = new THREE.CanvasTexture(c); return t; })();
    this.scan = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, 0.55), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.scan2 = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, 2.4), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    for (const s of [this.scan, this.scan2]) { s.position.z = D / 2 + 0.05; s.renderOrder = 10; s.visible = false; this.group.add(s); }

    this.layers = [];
    this.setMaterialize(1);
  }
  // m: 0 = blueprint only, 1 = solid only; in between a horizontal scan (top->bottom) reveals the solid
  setMaterialize(m, { lineOpacity = 1 } = {}) {
    const { H } = PH;
    const y = H / 2 + 0.6 - m * (H + 1.2);   // scan y in local coords
    this._scanY = y; this._m = m; this._lineOpacity = lineOpacity;
    this.solid.visible = m > 0.001;
    const showLines = m < 0.999 && lineOpacity > 0.001;
    this.lineGroup.visible = showLines;
    this.scan.visible = this.scan2.visible = m > 0.001 && m < 0.999;
    this.scan.position.y = this.scan2.position.y = y;
  }
  setLineProgress(outline, detail = outline, center = outline) { this.outline.setProgress(outline); this.detail.setProgress(detail); this.center.setProgress(center); this.hidden.setProgress(detail); }
  setLineOpacity(o) { this.outline.opacity = o; this.detail.opacity = 0.85 * o; this.center.opacity = 0.55 * o; this.hidden.opacity = 0.3 * o; }
  // must be called after world matrices are updated
  updateClip() {
    this.group.updateMatrixWorld(true);
    const e = new THREE.Euler().setFromQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()), 'YXZ'); this.sheenTex.offset.set(-e.y * 0.6 + e.x * 0.3, e.x * 0.4);
    const m = this.group.matrixWorld;
    const y = (this._m >= 0.999) ? -1e3 : (this._m <= 0.001 ? 1e3 : this._scanY);
    const lp = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y); this.clipSolid.copy(lp).applyMatrix4(m);
    const lq = new THREE.Plane(new THREE.Vector3(0, -1, 0), y); this.clipLines.copy(lq).applyMatrix4(m);
  }
  // canvas px -> local coords on the screen surface
  screenLocal(px, py, lift = 0) { return new THREE.Vector3((px / SCR_W - 0.5) * PH.SW, (0.5 - py / SCR_H) * PH.SH, PH.D / 2 + 0.012 + lift); }
  screenWorld(px, py, lift = 0) { this.group.updateMatrixWorld(true); return this.screenLocal(px, py, lift).applyMatrix4(this.group.matrixWorld); }

  // ---------- screen compositor ----------
  // sources: [{img, alpha, y (app-px offset), kind:'app'|'full'}], opts: {taps:[{x,y,age}], statusBar, dim}
  compose(sources, { taps = [], statusBar = true, island = true, home = true, bg = '#0b0d0e', overlay = null, shade = [] } = {}) {
    const c = this.ctx;
    c.globalAlpha = 1; c.fillStyle = bg; c.fillRect(0, 0, SCR_W, SCR_H);
    for (const s of sources) {
      if (!s || (s.alpha ?? 1) <= 0) continue;
      c.globalAlpha = s.alpha ?? 1;
      if (s.draw) { s.draw(c, SCR_W, SCR_H); continue; }
      if (s.kind === 'full') c.drawImage(s.img, 0, 0, SCR_W, SCR_H);
      else {
        // app frame (1179x2379) below the status bar; extend its top row into the bar area for continuity
        c.drawImage(s.img, 0, APP_TOP + (s.dy || 0), SCR_W, s.img.height * SCR_W / s.img.width);
        // status-bar strip: solid app background (like the real iOS 'black' status bar) - no stretched pixels
        c.fillStyle = bg; c.fillRect(0, 0, SCR_W, APP_TOP);
      }
    }
    c.globalAlpha = 1;
    for (const r of shade) { c.fillStyle = `rgba(0,0,0,${r.a})`; c.beginPath(); c.roundRect(r.x, r.y, r.w, r.h, r.r || 40); c.fill(); }
    if (overlay) overlay(c, SCR_W, SCR_H);
    // taps
    for (const t of taps) {
      const x = t.x * 3, y = t.y * 3 + APP_TOP;
      let r, a;
      if (t.age < 0) { const k = clamp(1 + t.age / 0.18); r = 70 - 18 * k; a = 0.28 * k; }
      else { const k = clamp(t.age / 0.42); r = 52 + 90 * k; a = 0.32 * (1 - k); }
      if (a <= 0.003) continue;
      c.fillStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = `rgba(255,255,255,${a * 1.4})`; c.lineWidth = 4; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    }
    if (statusBar) this.drawStatusBar(c);
    if (island) { c.fillStyle = '#000'; c.beginPath(); c.roundRect(SCR_W / 2 - 190, 33, 380, 112, 56); c.fill(); }
    if (home) { c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.roundRect(SCR_W / 2 - 205, SCR_H - 26, 410, 15, 8); c.fill(); }
    this.tex.needsUpdate = true;
    for (const L of this.layers) L.refresh(this.canvas);
  }
  drawStatusBar(c) {
    c.fillStyle = '#fff'; c.font = '600 51px "Heebo", sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center';
    c.fillText('9:41', 190, 92);
    // signal
    const bx = 860; for (let i = 0; i < 4; i++) { c.beginPath(); c.roundRect(bx + i * 20, 104 - (12 + i * 9), 13, 12 + i * 9, 3); c.fill(); }
    // wifi
    c.save(); c.translate(985, 108); c.lineCap = 'round';
    for (const [r, w] of [[38, 9], [24, 9]]) { c.lineWidth = w; c.strokeStyle = '#fff'; c.beginPath(); c.arc(0, 0, r, -Math.PI * 0.78, -Math.PI * 0.22); c.stroke(); }
    c.beginPath(); c.arc(0, -4, 6, 0, Math.PI * 2); c.fill(); c.restore();
    // battery
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 4; c.beginPath(); c.roundRect(1040, 75, 78, 37, 11); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.roundRect(1046, 81, 60, 25, 6); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.roundRect(1122, 86, 6, 15, 3); c.fill();
  }
  // a floating copy of a screen region (exploded UI). rect in canvas px.
  addLayer(rect, { radius = 42 } = {}) {
    const c = document.createElement('canvas'); c.width = rect.w; c.height = rect.h;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const w = rect.w / SCR_W * PH.SW, h = rect.h / SCR_H * PH.SH;
    const g = new THREE.ShapeGeometry(roundedRectShapeArc(w, h, radius / SCR_W * PH.SW), 16);
    const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 8; mesh.visible = false;
    // soft shadow
    const sc = document.createElement('canvas'); sc.width = 64; sc.height = 64; const sg = sc.getContext('2d'); const gr = sg.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.25, h * 1.35), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, opacity: 0 }));
    shadow.renderOrder = 7; shadow.visible = false;
    const center = this.screenLocal(rect.x + rect.w / 2, rect.y + rect.h / 2);
    mesh.position.copy(center); shadow.position.copy(center);
    this.group.add(shadow); this.group.add(mesh);
    const L = {
      rect, mesh, shadow, ctx: c.getContext('2d'), tex, center, lift: 0,
      refresh(src) { if (!mesh.visible) return; L.ctx.clearRect(0, 0, rect.w, rect.h); L.ctx.drawImage(src, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h); tex.needsUpdate = true; },
      set(lift, opacity = 1, scale = 1, extra = {}) {
        L.lift = lift; mesh.visible = shadow.visible = opacity > 0.001 && lift > 0.0001;
        mesh.position.set(center.x + (extra.dx || 0), center.y + (extra.dy || 0), center.z + lift);
        mesh.scale.setScalar(scale); mesh.rotation.set(extra.rx || 0, extra.ry || 0, extra.rz || 0);
        mat.opacity = opacity; shadow.material.opacity = 0.7 * opacity * Math.min(1, lift / 0.5);
        shadow.position.set(center.x + (extra.dx || 0) * 0.6 + lift * 0.08, center.y + (extra.dy || 0) * 0.6 - lift * 0.18, center.z + 0.02);
        shadow.scale.setScalar(scale * (1 + lift * 0.08));
      },
    };
    this.layers.push(L);
    return L;
  }
}
export { SCR_W, SCR_H, APP_TOP };
