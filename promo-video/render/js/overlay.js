// DOM/SVG overlay: kinetic typography, technical callouts, dimension lines.
import { clamp, inv, easeOut3, easeOut5, easeInOut3, easeOutBack, lerp } from './util.js';

const SVGNS = 'http://www.w3.org/2000/svg';
export class Overlay {
  constructor(root, W, H, aspect) {
    this.W = W; this.H = H; this.aspect = aspect; this.root = root;
    this.svg = document.createElementNS(SVGNS, 'svg'); this.svg.setAttribute('width', W); this.svg.setAttribute('height', H);
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`); this.svg.classList.add('ov-svg'); root.appendChild(this.svg);
    this.svg.innerHTML = `<defs><linearGradient id="coGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0"><stop offset="0" stop-color="#4fe3c1"/><stop offset="1" stop-color="#4fe3c1"/></linearGradient></defs>`;
    this.layer = document.createElement('div'); this.layer.className = 'ov-layer'; root.appendChild(this.layer);
    this.items = [];
  }
  P(spec) { // pick per-aspect value: spec may be {h:..., v:...}
    return spec && typeof spec === 'object' && ('h' in spec || 'v' in spec) && !Array.isArray(spec) ? (this.aspect === 'v' ? (spec.v ?? spec.h) : spec.h) : spec;
  }
  // ---------------- kinetic text ----------------
  text(o) {
    const el = document.createElement('div'); el.className = 'kt ' + (o.cls || ''); this.layer.appendChild(el);
    const dir = o.dir || (/[֐-׿]/.test(o.text) ? 'rtl' : 'ltr');
    el.dir = dir;
    const parts = o.chars ? [...o.text] : o.text.split(' ');
    const spans = parts.map((w, i) => {
      const outer = document.createElement('span'); outer.className = 'kw' + (o.mask ? ' mask' : '');
      const inner = document.createElement('span'); inner.className = 'ki'; inner.textContent = w;
      if (o.accent && o.accent.includes(i)) inner.classList.add('accent');
      outer.appendChild(inner); el.appendChild(outer);
      if (!o.chars && i < parts.length - 1) el.appendChild(document.createTextNode(' '));
      return inner;
    });
    const it = { kind: 'text', o, el, spans };
    this.items.push(it); return it;
  }
  _updText(it, t) {
    const o = it.o; const pos = this.P(o.pos);
    const t0 = o.t0, t1 = o.t1 ?? 1e9;
    const vis = t >= t0 - 0.001 && t <= t1 + (o.exitDur ?? 0.45);
    it.el.style.display = vis ? 'block' : 'none'; if (!vis) return;
    const size = (this.P(o.size) ?? 96) * (/(plex|med|mono)/.test(o.cls || '') ? 1 : 1.22);
    const st = it.el.style;
    st.fontSize = size + 'px'; st.left = st.right = 'auto';
    const x = pos.x, y = pos.y, align = pos.align || o.align || 'right';
    st.top = y + 'px';
    if (align === 'right') { st.right = (this.W - x) + 'px'; st.textAlign = 'right'; }
    else if (align === 'left') { st.left = x + 'px'; st.textAlign = 'left'; }
    else { st.left = (x - 2000) + 'px'; st.width = '4000px'; st.textAlign = 'center'; }
    if (pos.width) { st.width = pos.width + 'px'; if (align === 'right') st.right = (this.W - x) + 'px'; }
    if (o.color) st.color = o.color;
    const n = it.spans.length, stag = o.stagger ?? 0.07, dur = o.dur ?? 0.55;
    const exitDur = o.exitDur ?? 0.45;
    it.spans.forEach((s, i) => {
      const order = o.reverseOrder ? n - 1 - i : i;
      const ti = o.times ? o.times[i] : t0 + order * stag;
      let p = clamp((t - ti) / dur);
      let e = clamp((t - t1 - order * (o.exitStagger ?? 0.03)) / exitDur);
      const a = o.anim || 'rise';
      let tf = '', op = 1, blur = 0;
      if (a === 'rise') { const k = easeOut5(p); tf = `translateY(${(1 - k) * 105}%)`; op = o.mask ? 1 : k; if (!o.mask) blur = (1 - k) * 8; }
      else if (a === 'slam') { const k = easeOut5(p); tf = `scale(${lerp(this.aspect === 'v' ? 1.3 : 1.9, 1, k)})`; op = clamp(p * 3); blur = (1 - k) * 16; }
      else if (a === 'blur') { const k = easeOut3(p); tf = `translateX(${(1 - k) * (it.el.dir === 'rtl' ? -40 : 40)}px)`; op = k; blur = (1 - k) * 14; }
      else if (a === 'drop') { const k = easeOutBack(p, 1.3); tf = `translateY(${(1 - k) * -60}%) rotate(${(1 - clamp(k)) * -6}deg)`; op = clamp(p * 4); }
      else if (a === 'type') { op = p > 0 ? 1 : 0; }
      if (e > 0) {
        const ee = easeInOut3(e);
        const ex = o.exit || (a === 'slam' ? 'fade' : 'rise');
        if (ex === 'rise') { tf += ` translateY(${-ee * 105}%)`; op *= o.mask ? 1 : 1 - ee; if (!o.mask) blur += ee * 8; }
        else if (ex === 'fade') { op *= 1 - ee; blur += ee * 10; }
        else if (ex === 'drop') { tf += ` translateY(${ee * 105}%)`; }
      }
      s.style.transform = tf; s.style.opacity = op; s.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
    });
    if (o.update) o.update(it, t);
  }
  // ---------------- free element (HTML) ----------------
  html(o) { const el = document.createElement('div'); el.className = 'kh ' + (o.cls || ''); el.innerHTML = o.html || ''; if (o.dir) el.dir = o.dir; this.layer.appendChild(el); const it = { kind: 'html', o, el }; this.items.push(it); return it; }
  _updHtml(it, t) { const o = it.o; const vis = t >= o.t0 && t <= (o.t1 ?? 1e9); it.el.style.display = vis ? 'block' : 'none'; if (vis && o.update) o.update(it.el, t, this); }
  // ---------------- callout (leader line from a projected 3D anchor to a label) ----------------
  callout(o) {
    const g = document.createElementNS(SVGNS, 'g'); this.svg.appendChild(g);
    const path = document.createElementNS(SVGNS, 'path'); path.setAttribute('class', 'co-line'); g.appendChild(path);
    const dot = document.createElementNS(SVGNS, 'circle'); dot.setAttribute('class', 'co-dot'); dot.setAttribute('r', 6); g.appendChild(dot);
    const ring = document.createElementNS(SVGNS, 'circle'); ring.setAttribute('class', 'co-ring'); g.appendChild(ring);
    const lab = document.createElement('div'); lab.className = 'co-label'; lab.dir = 'rtl';
    lab.innerHTML = `<div class="co-t">${o.label}</div>`; this.layer.appendChild(lab);
    const it = { kind: 'callout', o, g, path, dot, ring, lab }; this.items.push(it); return it;
  }
  _updCallout(it, t, project) {
    const o = it.o; const t1 = o.t1 ?? 1e9;
    const vis = t >= o.t0 && t <= t1 + 0.4;
    it.g.style.display = vis ? '' : 'none'; it.lab.style.display = vis ? 'flex' : 'none'; if (!vis) return;
    const a = project(o.anchor());
    const at = this.P(o.at);
    const side = at ? at.side : (this.P(o.side) || 'left'); const L = at ? 90 : (this.P(o.len) ?? 220); const rise = at ? (at.y - a.y) : (this.P(o.rise) ?? -90);
    const sx = side === 'left' ? -1 : 1;
    const end = at ? [at.x, at.y] : [a.x + sx * Math.abs(rise) * 0.9 + sx * L, a.y + rise];
    const pIn = easeInOut3(clamp((t - o.t0) / 0.55));
    const pOut = clamp((t - t1) / 0.4);
    const c1 = [a.x + sx * Math.abs(rise) * 0.15, a.y + rise * 0.85], c2 = [end[0] - sx * L * 0.65, end[1]];
    it.path.setAttribute('d', `M${a.x},${a.y} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${end[0]},${end[1]}`);
    const tot = it.path.getTotalLength();
    it.path.style.strokeDasharray = `${tot}`; it.path.style.strokeDashoffset = `${tot * (1 - pIn)}`;
    it.path.style.opacity = 1 - pOut;
    it.dot.setAttribute('r', 7); it.dot.setAttribute('cx', a.x); it.dot.setAttribute('cy', a.y); it.dot.style.opacity = clamp(pIn * 4) * (1 - pOut);
    const rp = clamp((t - o.t0) / 0.9);
    it.ring.setAttribute('cx', a.x); it.ring.setAttribute('cy', a.y); it.ring.setAttribute('r', 8 + 22 * easeOut3(rp)); it.ring.style.opacity = (1 - rp) * 0.9 * (1 - pOut);
    const lp = easeOut3(clamp((t - o.t0 - 0.35) / 0.45));
    const ls = it.lab.style; ls.top = end[1] + 'px';
    if (sx < 0) { ls.right = (this.W - end[0] + 2) + 'px'; ls.left = 'auto'; ls.flexDirection = 'row'; } else { ls.left = (end[0] + 2) + 'px'; ls.right = 'auto'; ls.flexDirection = 'row-reverse'; }
    ls.opacity = lp * (1 - pOut); ls.transform = `translateY(-50%) translateX(${(1 - lp) * sx * 18}px) scale(${0.92 + 0.08 * lp})`; ls.transformOrigin = sx < 0 ? 'right center' : 'left center';
  }
  // ---------------- dimension line between two projected anchors ----------------
  dim(o) {
    const g = document.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'dim'); this.svg.appendChild(g);
    const mk = (tag, cls) => { const e = document.createElementNS(SVGNS, tag); if (cls) e.setAttribute('class', cls); g.appendChild(e); return e; };
    const it = { kind: 'dim', o, g, ext1: mk('line', 'dim-ext'), ext2: mk('line', 'dim-ext'), main: mk('line', 'dim-main'), ar1: mk('path', 'dim-ar'), ar2: mk('path', 'dim-ar') };
    it.lab = document.createElement('div'); it.lab.className = 'dim-label'; it.lab.textContent = o.label; this.layer.appendChild(it.lab);
    this.items.push(it); return it;
  }
  _updDim(it, t, project) {
    const o = it.o; const t1 = o.t1 ?? 1e9; const vis = t >= o.t0 && t <= t1 + 0.4;
    it.g.style.display = vis ? '' : 'none'; it.lab.style.display = vis ? 'block' : 'none'; if (!vis) return;
    const A = project(o.a()), B = project(o.b());
    let dx = B.x - A.x, dy = B.y - A.y; const len = Math.hypot(dx, dy) || 1; const ux = dx / len, uy = dy / len;
    const nx = -uy * (o.offset ?? 40), ny = ux * (o.offset ?? 40);
    const a2 = { x: A.x + nx, y: A.y + ny }, b2 = { x: B.x + nx, y: B.y + ny };
    const p = easeInOut3(clamp((t - o.t0) / 0.7)); const out = clamp((t - t1) / 0.4);
    const set = (e, x1, y1, x2, y2) => { e.setAttribute('x1', x1); e.setAttribute('y1', y1); e.setAttribute('x2', x2); e.setAttribute('y2', y2); };
    const ext = (o.offset ?? 40) >= 0 ? 1 : -1;
    set(it.ext1, A.x + nx * 0.15, A.y + ny * 0.15, A.x + nx * (1 + 0.25 * ext * Math.sign(o.offset ?? 40)), A.y + ny * (1 + 0.25));
    set(it.ext2, B.x + nx * 0.15, B.y + ny * 0.15, B.x + nx * 1.25, B.y + ny * 1.25);
    const mx = (a2.x + b2.x) / 2, my = (a2.y + b2.y) / 2;
    const h = p / 2;
    set(it.main, mx - dx * h, my - dy * h, mx + dx * h, my + dy * h);
    const arrow = (x, y, dirx, diry) => { const s = 13, w = 5; return `M${x},${y} L${x - dirx * s - diry * w},${y - diry * s + dirx * w} L${x - dirx * s + diry * w},${y - diry * s - dirx * w}Z`; };
    it.ar1.setAttribute('d', arrow(mx - dx * h, my - dy * h, -ux, -uy)); it.ar2.setAttribute('d', arrow(mx + dx * h, my + dy * h, ux, uy));
    it.g.style.opacity = (p > 0 ? 1 : 0) * (1 - out);
    const ls = it.lab.style; ls.left = mx + 'px'; ls.top = my + 'px';
    let ang = Math.atan2(dy, dx) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    ls.transform = `translate(-50%,-50%) rotate(${ang}deg)`; ls.opacity = clamp((p - 0.6) / 0.4) * (1 - out);
    if (o.value) it.lab.textContent = o.value(clamp((p - 0.3) / 0.7));
  }
  update(t, project) {
    for (const it of this.items) {
      if (it.kind === 'text') this._updText(it, t);
      else if (it.kind === 'html') this._updHtml(it, t);
      else if (it.kind === 'callout') this._updCallout(it, t, project);
      else if (it.kind === 'dim') this._updDim(it, t, project);
    }
  }
}
