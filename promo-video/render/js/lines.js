import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

export const RES = new THREE.Vector2(1920, 1080);
const mats = [];
export function setLineResolution(w, h) { RES.set(w, h); for (const m of mats) m.resolution.copy(RES); }

// polylines: array of arrays of THREE.Vector3. Draws progressively in the given order.
export class Lines {
  constructor(polylines, { color = 0x4fe3c1, width = 1.6, opacity = 1, dashed = false, dashSize = 0.3, gapSize = 0.15, depthTest = true } = {}) {
    const pos = [];
    for (const pl of polylines) for (let i = 0; i < pl.length - 1; i++) pos.push(pl[i].x, pl[i].y, pl[i].z, pl[i + 1].x, pl[i + 1].y, pl[i + 1].z);
    this.count = pos.length / 6;
    this.geometry = new LineSegmentsGeometry(); this.geometry.setPositions(pos);
    this.material = new LineMaterial({ color, linewidth: width, transparent: true, opacity, dashed, dashSize, gapSize, depthTest, depthWrite: false, worldUnits: false });
    this.material.resolution.copy(RES); mats.push(this.material);
    this.object = new LineSegments2(this.geometry, this.material);
    if (dashed) this.object.computeLineDistances();
    this.object.renderOrder = 5;
    this.setProgress(1);
  }
  setProgress(p) { this.geometry.instanceCount = Math.max(0, Math.round(this.count * Math.min(1, Math.max(0, p)))); this.object.visible = p > 0 && this.material.opacity > 0.001; }
  set opacity(o) { this.material.opacity = o; this.object.visible = o > 0.001 && this.geometry.instanceCount > 0; }
}

export function roundedRectPath(w, h, r, segs = 10) {
  // returns points (clockwise from top-middle) on rounded rect centered at origin in XY
  const pts = []; const hw = w / 2, hh = h / 2;
  const corner = (cx, cy, a0) => { for (let i = 0; i <= segs; i++) { const a = a0 - (i / segs) * Math.PI / 2; pts.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a))); } };
  pts.push(new THREE.Vector2(0, hh));
  corner(hw - r, hh - r, Math.PI / 2);
  corner(hw - r, -hh + r, 0);
  corner(-hw + r, -hh + r, -Math.PI / 2);
  corner(-hw + r, hh - r, Math.PI);
  pts.push(new THREE.Vector2(0, hh));
  return pts;
}
export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape(); const hw = w / 2, hh = h / 2;
  s.moveTo(-hw + r, -hh); s.lineTo(hw - r, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r); s.quadraticCurveTo(hw, hh, hw - r, hh); s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r); s.lineTo(-hw, -hh + r); s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}
// smooth (arc-based) rounded rect shape
export function roundedRectShapeArc(w, h, r) {
  const s = new THREE.Shape(); const hw = w / 2, hh = h / 2;
  s.moveTo(-hw + r, -hh); s.lineTo(hw - r, -hh); s.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
  s.lineTo(hw, hh - r); s.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false); s.lineTo(-hw + r, hh);
  s.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false); s.lineTo(-hw, -hh + r); s.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
export const v2to3 = (pts, z = 0) => pts.map(p => new THREE.Vector3(p.x, p.y, z));
export function circlePts(cx, cy, r, z = 0, segs = 48, axis = 'z') {
  const pts = [];
  for (let i = 0; i <= segs; i++) { const a = (i / segs) * Math.PI * 2; const u = cx + r * Math.cos(a), v = cy + r * Math.sin(a); pts.push(axis === 'z' ? new THREE.Vector3(u, v, z) : new THREE.Vector3(z, v, u)); }
  return pts;
}
