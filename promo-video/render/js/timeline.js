import { Phone, PH, MINT, SCR_W, SCR_H, APP_TOP } from './phone.js';
import { makeDumbbell, makePlate, makeAppIcon, makeLaptop, makeChart, makeBeam, LAP } from './props.js';
import { clamp, lerp, inv, win, smooth, smoother, easeOut3, easeOut5, easeIn3, easeInOut3, easeInOut5, easeOutBack, keyed, deg } from './util.js';

export async function buildTimeline(ctx) {
  const { THREE, scene, camera, ov, media, aspect, W, H, dom } = ctx;
  const V = aspect === 'v';
  const P = (h, v) => (V ? v : h);
  for (const n of ['onboarding', 'workout', 'nutrition', 'metrics', 'home', 'coach', 'assigned']) await media.seqMeta(n);
  const ev = (n) => media.meta(n).events;
  const taps = (n) => ev(n).filter(e => e.type === 'tap');

  // ---------------- objects ----------------
  const phone = new Phone(); scene.add(phone.group);
  const { W: PW, H: PHh, D: PD } = PH; const zF = PD / 2;

  // ---------------- helpers ----------------
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const local = (obj, x, y, z) => () => { obj.updateMatrixWorld(true); return new THREE.Vector3(x, y, z).applyMatrix4(obj.matrixWorld); };
  function setCam(pos, tgt, fov = 30, roll = 0) {
    camera.position.set(pos[0], pos[1], pos[2]); camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(tgt[0], tgt[1], tgt[2]);
    camera.fov = fov; camera.updateProjectionMatrix();
  }
  // vertical framing: push camera back along view dir and shift target so subject sits lower
  function frame(pos, tgt, { fov = 30, roll = 0, vk = 1.55, vdy = 4.2, vdx = 0 } = {}) {
    if (V) {
      const d = [pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]];
      tgt = [tgt[0] * 0 + vdx, tgt[1] + vdy, tgt[2]]; // re-center horizontally in portrait
      pos = [tgt[0] + d[0] * vk, tgt[1] + d[1] * vk, tgt[2] + d[2] * vk];
    }
    setCam(pos, tgt, fov, roll);
  }

  // ---------------- overlay content ----------------
  const RX = P(W - 150, W - 90);      // right text edge
  // S1
  ov.html({ t0: 0.15, t1: 5.4, cls: '', html: `<div class="label-mono">COACH DANIEL — SPEC.01 / ISO VIEW</div>`, update: (el, t) => { const s = el.style; s.left = P(120, 70) + 'px'; s.top = P(92, 110) + 'px'; s.opacity = win(t, 0.15, 5.4, 0.4, 0.5); } });
  const tb = ov.html({ t0: 0.2, t1: 5.6, html: `<div class="tblock">
      <div><span class="k">PROJECT</span>COACH DANIEL</div><div class="he"><span class="k" style="text-align:left;direction:ltr">TITLE</span>אפליקציית אימון ותזונה</div><div><span class="k">REV</span>A</div>
      <div><span class="k">DWG NO.</span>CD-01</div><div><span class="k">MODULES</span>TRAIN · FOOD · TRACK</div><div><span class="k">SCALE</span>1:1</div></div>`,
    update: (el, t) => { const s = el.style; s.left = P(120, 70) + 'px'; s.top = P(H - 210, H - 260) + 'px'; const p = easeInOut3(inv(0.2, 1.3, t)); s.clipPath = `inset(0 ${100 - p * 100}% 0 0)`; s.opacity = 1 - inv(4.8, 5.6, t); } });
  // registration corners
  ov.html({ t0: 0, t1: 5.8, html: [0, 1, 2, 3].map(i => `<div class="corner" style="${i < 2 ? 'top' : 'bottom'}:${P(48, 60)}px;${i % 2 ? 'right' : 'left'}:${P(48, 40)}px;border-${i < 2 ? 'top' : 'bottom'}-width:2px;border-${i % 2 ? 'right' : 'left'}-width:2px"></div>`).join(''),
    update: (el, t) => { el.style.inset = '0'; el.style.opacity = win(t, 0.0, 5.8, 0.5, 0.6); } });
  ov.text({ t0: 0.3, t1: 3.7, text: 'מסמך טכני · 01', cls: 'mono', size: P(20, 22), pos: { h: { x: RX, y: 318 }, v: { x: RX, y: 260 } }, anim: 'blur', color: '#4fe3c1' });
  ov.text({ t0: 0.55, t1: 3.75, text: 'המאמן שלך.', size: P(132, 128), pos: { h: { x: RX, y: 360 }, v: { x: RX, y: 300 } }, mask: true, stagger: 0.12 });
  ov.text({ t0: 1.45, t1: 3.85, text: 'בכיס.', cls: 'mint', size: P(132, 128), pos: { h: { x: RX, y: 500 }, v: { x: RX, y: 440 } }, mask: true });
  // dims on the drawing
  ov.dim({ t0: 1.3, t1: 3.9, a: local(phone.group, -PW / 2, -PHh / 2, zF), b: local(phone.group, PW / 2, -PHh / 2, zF), offset: -70, label: '71.6 mm', value: (p) => (71.6 * p).toFixed(1) + ' mm' });
  ov.dim({ t0: 1.7, t1: 3.9, a: local(phone.group, PW / 2, PHh / 2, zF), b: local(phone.group, PW / 2, -PHh / 2, zF), offset: -80, label: '146.6 mm', value: (p) => (146.6 * p).toFixed(1) + ' mm' });
  ov.dim({ t0: 2.2, t1: 3.9, a: local(phone.group, PW / 2, PHh / 2 - 1.5, zF), b: local(phone.group, PW / 2, PHh / 2 - 1.5, -zF), offset: 60, label: '8.3', value: (p) => (8.3 * p).toFixed(1) });
  ov.callout({ t0: 2.5, t1: 3.9, anchor: local(phone.group, 0, PHh / 2 - 0.17 - 0.29 - (PHh - PH.SH) / 2, zF), k: 'A-01', label: 'מסך 6.1″', side: 'left', len: 140, rise: -70 });
  // tagline after materialize
  ov.text({ t0: 5.75, t1: 7.95, text: 'תוכנית אימונים.', size: P(104, 104), pos: { h: { x: RX, y: 300 }, v: { x: RX, y: 230 } }, mask: true, stagger: 0.09 });
  ov.text({ t0: 6.25, t1: 8.0, text: 'תפריט.', size: P(104, 104), pos: { h: { x: RX, y: 418 }, v: { x: RX, y: 350 } }, mask: true });
  ov.text({ t0: 6.7, t1: 8.05, text: 'מעקב.', size: P(104, 104), pos: { h: { x: RX, y: 536 }, v: { x: RX, y: 470 } }, mask: true });
  ov.text({ t0: 7.15, t1: 8.1, text: 'במקום אחד.', cls: 'mint', size: P(104, 104), pos: { h: { x: RX, y: 672 }, v: { x: RX, y: 610 } }, anim: 'slam', stagger: 0.08 });

  // ---------------- screen helpers ----------------
  // map video time -> recording frame via piecewise-linear keys [[t, frame], ...]
  const remap = (keys, t) => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 0; i < keys.length - 1; i++) { const [a, fa] = keys[i], [b, fb] = keys[i + 1]; if (t <= b) return fa + (fb - fa) * (t - a) / (b - a); } return keys[keys.length - 1][1]; };
  const tapList = (name, frame, fps = 30) => taps(name).map(e => ({ x: e.x, y: e.y, age: (frame - e.frame) / fps })).filter(e => e.age > -0.3 && e.age < 0.6);
  const boot = (alpha) => ({ alpha, draw: (c, w, h) => {
    const g = c.createLinearGradient(w, 0, 0, h); g.addColorStop(0, '#1B3B47'); g.addColorStop(1, '#0F1D24'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = '700 84px Heebo'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Coach Daniel', w / 2, h / 2 - 40);
  } });
  async function screenFrom(name, f, extra = {}) {
    const img = await media.frame(name, f);
    phone.compose([{ img, alpha: 1 }], { taps: tapList(name, f), ...extra });
  }

  // ---------------- shots ----------------
  const S1 = async (t) => {
    // phone pose
    const k = smoother(inv(0, 8.6, t));
    phone.group.visible = true; phone.group.position.set(0, 0, 0);
    phone.group.rotation.set(lerp(0.13, 0.05, k), lerp(-0.72, -0.3, k), lerp(0.02, 0, k));
    // camera: slow continuous dolly
    const c = keyed([{ t: 0, v: [-3, 6, 50, 7.6, 0.4, 0] }, { t: 4, v: [-1.5, 4, 44, 7.4, 0.2, 0] }, { t: 8.5, v: [1.5, 1.6, 38.5, 7.0, 0.0, 0] }], t);
    frame([c[0], c[1], c[2]], [c[3], c[4], c[5]], { vk: 1.6, vdy: 4.6 });
    // blueprint / materialize
    const m = easeInOut3(inv(3.95, 5.35, t));
    phone.setMaterialize(m);
    phone.setLineProgress(easeInOut3(inv(0.1, 2.3, t)), easeInOut3(inv(0.8, 3.0, t)), easeOut3(inv(0.3, 1.2, t)));
    phone.setLineOpacity(1);
    dom.bgBlue.style.opacity = 1 - smooth(inv(4.3, 5.9, t));
    dom.grid.style.opacity = (1 - smooth(inv(4.2, 5.6, t))) * smooth(inv(0, 0.6, t));
    dom.grid.style.backgroundPosition = `${-camera.position.x * 6}px ${camera.position.y * 6}px`;
    dom.glow.style.opacity = smooth(inv(5.0, 6.5, t)) * 0.9;
    // screen: off -> boot -> login
    const on = inv(5.45, 5.75, t);
    if (t < 6.15) phone.compose([boot(on)], { statusBar: on > 0.5, home: on > 0.5 });
    else { const img = await media.frame('onboarding', remap([[6.15, 0], [7.75, 30], [8.0, 43]], t)); phone.compose([{ img, alpha: 1 }, boot(1 - inv(6.15, 6.45, t))], { taps: tapList('onboarding', remap([[6.15, 0], [7.75, 30], [8.0, 43]], t)) }); }
  };

  // =====================================================================
  // extra objects
  const dumb = makeDumbbell(); scene.add(dumb.group); dumb.group.visible = false;
  const plate = makePlate(9); scene.add(plate.group); plate.group.visible = false;
  const icon = makeAppIcon(); scene.add(icon.group); icon.group.visible = false;
  const lap = makeLaptop(); scene.add(lap.group); lap.group.visible = false;
  const WEIGH = [[70, 73.2], [66, 73.4], [63, 73.3], [59, 73.6], [56, 73.8], [52, 73.7], [49, 74.0], [45, 74.2], [42, 74.1], [38, 74.5], [35, 74.6], [31, 74.8], [28, 74.7], [24, 75.1], [21, 75.2], [17, 75.4], [14, 75.3], [10, 75.6], [7, 75.7], [3, 75.9], [1, 75.8], [0, 76.0]];
  const chart = makeChart(WEIGH, { w: 22, h: 9, y0: 73, y1: 76 }); scene.add(chart.group); chart.group.visible = false;
  const beam = makeBeam(); scene.add(beam.group); beam.group.visible = false;
  // extra phones for S6/S7
  const phones = [phone, new Phone(), new Phone(), new Phone(), new Phone()];
  for (const ph of phones.slice(1)) { scene.add(ph.group); ph.group.visible = false; ph.setMaterialize(1); }
  const phB = phones[1];
  const allObjs = [phone.group, dumb.group, plate.group, icon.group, lap.group, chart.group, beam.group, ...phones.slice(1).map(p => p.group)];

  const invmap = (keys, f) => { for (let i = 0; i < keys.length - 1; i++) { const [a, fa] = keys[i], [b, fb] = keys[i + 1]; if (f >= fa && f <= fb && fb > fa) return a + (b - a) * (f - fa) / (fb - fa); } return keys[keys.length - 1][0]; };
  const fwd = new THREE.Vector3();
  const look = (obj, pos) => { obj.lookAt(pos); };

  // ---------------- S2 content ----------------
  const ONB = [[7.75, 30], [8.0, 44], [12.45, 294], [12.5, 296], [14.85, 369], [15.15, 383], [16.0, 411]];
  const tOnb = (f) => invmap(ONB, f);
  const specRows = [['01', 'שם', 'דניאל', 93], ['02', 'מין', 'זכר', 132], ['03', 'גיל', '29', 169], ['04', 'גובה · משקל', '178 · 76', 218], ['05', 'פעילות', '3–4 בשבוע', 257], ['06', 'מטרה', 'עלייה במסת שריר', 296]];
  ov.text({ t0: 8.15, t1: 12.3, text: '6 שאלות.', size: P(112, 104), pos: { h: { x: RX, y: 196 }, v: { x: RX, y: 190 } }, mask: true });
  ov.text({ t0: 8.55, t1: 12.35, text: 'ומקבלים תוכנית.', cls: 'mint', size: P(112, 104), pos: { h: { x: RX, y: 318 }, v: { x: RX, y: 306 } }, mask: true, stagger: 0.1 });
  ov.html({ t0: 8.6, t1: 12.6, html: `<div class="spec">${specRows.map(r => `<div class="row"><span class="n">${r[0]}</span><span class="l">${r[1]}</span><span class="v">${r[2]}</span></div>`).join('')}</div>`,
    update: (el, t) => { const s = el.style; s.right = (W - RX) + 'px'; s.top = P(500, 470) + 'px'; s.width = P(640, 900) + 'px';
      const rows = el.querySelectorAll('.row'); specRows.forEach((r, i) => { const ti = tOnb(r[3]); const k = easeOut3(inv(ti, ti + 0.35, t)); const o = 1 - inv(12.1, 12.55, t); rows[i].style.opacity = k * o; rows[i].style.transform = `translateX(${(1 - k) * -30}px)`; rows[i].querySelector('.v').style.color = t < ti + 0.5 ? '#4fe3c1' : ''; });
      // underline sweep under rows
    } });
  ov.text({ t0: 12.65, t1: 15.0, text: 'היעדים —', size: P(96, 92), pos: { h: { x: RX, y: 210 }, v: { x: RX, y: 190 } }, mask: true });
  ov.text({ t0: 12.95, t1: 15.05, text: 'מחושבים בשבילך.', cls: 'mint', size: P(96, 92), pos: { h: { x: RX, y: 318 }, v: { x: RX, y: 296 } }, mask: true, stagger: 0.1 });
  ov.html({ t0: 12.9, t1: 15.1, html: `<div style="direction:rtl;text-align:right"><div class="num" style="font:900 190px/0.9 Heebo;letter-spacing:-.03em;font-variant-numeric:tabular-nums">0</div><div class="lab" style="font:400 34px 'IBM Plex Sans Hebrew';color:#8f9a9e;margin-top:14px">קק״ל ליום · חלבון 150 ג׳ · פחמימות 390 ג׳ · שומן 80 ג׳</div></div>`,
    update: (el, t) => { const s = el.style; s.right = (W - RX) + 'px'; s.top = P(470, 450) + 'px'; const k = easeOut5(inv(13.0, 14.1, t)); el.querySelector('.num').textContent = Math.round(2870 * k).toLocaleString('en-US'); s.opacity = inv(12.9, 13.1, t) * (1 - inv(14.8, 15.1, t)); const l = el.querySelector('.lab'); l.style.opacity = inv(13.6, 14.0, t); } });
  const goalsLayer = phone.addLayer({ x: 60, y: 637, w: 1054, h: 730 });
  ov.callout({ t0: 13.4, t1: 14.8, anchor: () => phone.screenWorld(934, 1143, goalsLayer.lift), k: 'P', label: 'חלבון 150 ג׳', side: { h: 'right', v: 'right' }, len: P(160, 120), rise: P(110, 120) });

  const S2 = async (t) => {
    phone.group.visible = true; phone.setMaterialize(1); phone.group.position.set(0, 0, 0);
    const k = smoother(inv(7.0, 15.2, t));
    phone.group.rotation.set(lerp(0.05, 0.02, k), lerp(-0.3, -0.06, k), 0);
    const c = keyed([{ t: 7.0, v: [0.6, 2.2, 40, 7.2, 0.1, 0] }, { t: 8.5, v: [1.5, 1.6, 38.5, 7.0, 0.0, 0] }, { t: 11.0, v: [0.8, 0.9, 30.5, 5.9, -0.2, 0] }, { t: 12.4, v: [0.6, 0.6, 28.0, 5.3, -0.3, 0] }, { t: 14.9, v: [0.4, 0.5, 25.5, 4.6, 0.2, 0] }], t);
    let pos = [c[0], c[1], c[2]], tgt = [c[3], c[4], c[5]];
    if (V) { const d = [pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]]; tgt = [0, tgt[1] + 4.4, 0]; pos = [d[0] * 1.62, tgt[1] + d[1] * 1.62, d[2] * 1.62]; }
    // push into the plan icon (15.0 -> 16.0)
    const pk = easeIn3(inv(14.95, 16.0, t));
    if (pk > 0) {
      const ic = phone.screenWorld(1026, 593);
      phone.group.updateMatrixWorld(true); fwd.set(0, 0, 1).transformDirection(phone.group.matrixWorld);
      const endPos = ic.clone().addScaledVector(fwd, 2.1);
      pos = [lerp(pos[0], endPos.x, pk), lerp(pos[1], endPos.y, pk), lerp(pos[2], endPos.z, pk)];
      tgt = [lerp(tgt[0], ic.x, Math.min(1, pk * 1.6)), lerp(tgt[1], ic.y, Math.min(1, pk * 1.6)), lerp(tgt[2], ic.z, Math.min(1, pk * 1.6))];
    }
    setCam(pos, tgt, 30);
    // goals card lift
    const lift = easeInOut3(inv(13.0, 13.6, t)) * (1 - easeInOut3(inv(14.4, 14.9, t)));
    goalsLayer.set(lift * 1.3, lift > 0 ? 1 : 0, 1 + lift * 0.04);
    dom.glow.style.opacity = 0.9;
    const f = remap(ONB, t);
    const dim = inv(15.5, 15.9, t);
    await screenFrom('onboarding', f, { shade: lift > 0.01 ? [{ x: 60, y: 637, w: 1054, h: 730, a: 0.55 * lift, r: 60 }] : [], overlay: dim > 0 ? (cx, w, h) => { cx.fillStyle = `rgba(5,7,8,${dim})`; cx.fillRect(0, 0, w, h); } : null });
    // flat dumbbell hand-off over the icon glyph
    const hk = inv(15.45, 16.0, t);
    if (hk > 0) {
      dumb.group.visible = true; dumb.setFlat(1);
      phone.group.updateMatrixWorld(true);
      const ic = phone.screenWorld(1026, 593, 0.004);
      const q = phone.group.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -45 * deg));
      // move from glyph toward a point in front of the camera
      const camPos = new THREE.Vector3(...pos); const dirToIcon = ic.clone().sub(camPos).normalize();
      const front = camPos.clone().addScaledVector(dirToIcon, 1.15);
      const e = easeInOut3(hk);
      dumb.group.position.copy(ic).lerp(front, e);
      dumb.group.quaternion.copy(q);
      dumb.group.scale.setScalar(lerp(0.0167, 0.0318, e));
      dumb.flatMat.opacity = Math.min(1, hk * 6);
    }
  };

  // ---------------- S3: dumbbell -> workout -> plate ----------------
  const PHONE3 = new THREE.Vector3(0, 0, -30);
  const PLATE3 = new THREE.Vector3(-6, 0, -70);
  const WK = [[18.6, 32], [19.3, 52], [21.9, 130], [22.2, 140], [24.9, 243]];
  ov.text({ t0: 16.3, t1: 18.35, text: 'כל סט.', size: P(124, 116), pos: { h: { x: RX, y: 250 }, v: { x: RX, y: 230 } }, anim: 'slam' });
  ov.text({ t0: 16.8, t1: 18.4, text: 'כל חזרה.', size: P(124, 116), pos: { h: { x: RX, y: 390 }, v: { x: RX, y: 366 } }, anim: 'slam', stagger: 0.06 });
  ov.text({ t0: 17.3, t1: 18.45, text: 'מתועד.', cls: 'mint', size: P(124, 116), pos: { h: { x: RX, y: 530 }, v: { x: RX, y: 502 } }, anim: 'slam' });
  ov.callout({ t0: 19.55, t1: 21.7, anchor: () => phone.screenWorld(580, 1273), k: 'W-01', label: 'הדגמה לכל תרגיל', side: 'right', len: P(250, 120), rise: P(-120, -150) });
  ov.callout({ t0: 19.95, t1: 21.75, anchor: () => phone.screenWorld(840, 1567), k: 'W-02', label: 'יעד חזרות מהמאמן', side: 'right', len: P(230, 120), rise: P(-30, -40) });
  ov.callout({ t0: 20.35, t1: 21.8, anchor: () => phone.screenWorld(846, 1733), k: 'W-03', label: 'משקל וחזרות בלחיצה', side: 'right', len: P(230, 120), rise: P(90, 110) });
  ov.text({ t0: 22.05, t1: 24.6, text: 'טיימר מנוחה', size: P(112, 104), pos: { h: { x: RX, y: 300 }, v: { x: RX, y: 230 } }, mask: true });
  ov.text({ t0: 22.45, t1: 24.65, text: 'מובנה.', cls: 'mint', size: P(112, 104), pos: { h: { x: RX, y: 424 }, v: { x: RX, y: 350 } }, mask: true });
  ov.text({ t0: 22.8, t1: 24.6, text: 'סיימת סט? הספירה כבר רצה.', cls: 'plex', size: P(36, 38), pos: { h: { x: RX, y: 566 }, v: { x: RX, y: 486 } }, anim: 'blur', stagger: 0.04, color: '#8f9a9e' });

  const S3 = async (t) => {
    dom.glow.style.opacity = 0.9;
    // dumbbell
    dumb.group.visible = true;
    dumb.setFlat(1 - inv(16.0, 16.4, t));
    dumb.group.scale.setScalar(1);
    const spin = (t - 16) * 2.2 + easeOut3(inv(16, 17, t)) * 2;
    const dk = easeInOut3(inv(18.2, 19.3, t));
    dumb.group.position.set(lerp(0, -9.5, dk), lerp(0, 1.2, dk), lerp(0, 14, dk));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25 * smooth(inv(16, 18, t)) + dk * 0.6, 0.9 * easeInOut3(inv(16.1, 18.4, t)) + dk * 0.8, -45 * deg + 0.35 * easeInOut3(inv(16, 18.2, t))));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), spin));
    dumb.group.quaternion.copy(q);
    dumb.group.visible = t < 19.4;
    // phone in the distance
    phone.group.visible = t > 17.6; phone.setMaterialize(1);
    phone.group.position.copy(PHONE3);
    const ex = easeIn3(inv(24.35, 25.55, t)); phone.group.position.x += ex * 26; phone.group.position.z -= ex * 6;
    const pr = smoother(inv(18.4, 25, t));
    phone.group.rotation.set(0.04, lerp(-0.22, 0.12, pr), 0);
    // plate rolls in (24.2 -> 25.9)
    const rk = inv(24.3, 25.85, t); plate.group.visible = t > 24.2;
    const px = lerp(-46, PLATE3.x, easeOut3(rk)) + Math.sin(inv(25.6, 26, t) * Math.PI) * 0.3;
    plate.group.position.set(px, PLATE3.y, PLATE3.z);
    plate.group.rotation.set(0, 0, -(px - PLATE3.x) / 9);
    // camera
    const base = keyed([{ t: 16.0, v: [0, 0, 36.2, 0, 0, 0] }, { t: 17.2, v: [1.8, 0.8, 33.5, 1.6, 0.2, 0] }, { t: 18.2, v: [3.2, 1.4, 31.5, 2.6, 0.2, 0] }, { t: 19.4, v: [1.6, 0.4, -2.0, 5.0, -0.3, -30] }, { t: 22.0, v: [0.9, 0.2, -4.0, 4.7, -0.1, -30] }, { t: 24.4, v: [0.0, 0.1, -5.4, 4.3, 0.1, -30] }, { t: 25.95, v: [PLATE3.x, PLATE3.y, PLATE3.z + 82.4, PLATE3.x, PLATE3.y, PLATE3.z] }], t, smooth);
    let pos = [base[0], base[1], base[2]], tgt = [base[3], base[4], base[5]];
    if (V) {
      if (t < 19.0) { pos = [pos[0] * 1.2, pos[1] + 3.5, pos[2] * 1.55]; tgt = [tgt[0] * 0.2, tgt[1] + 3.5, tgt[2]]; }
      else if (t < 24.4) { const d = [pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]]; tgt = [0, 4.6, -30]; pos = [d[0], tgt[1] + d[1], tgt[2] + d[2] * 1.62]; }
      else { const k2 = inv(24.4, 25.95, t); const d = [pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]]; const tg = lerp3([0, 4.6, -30], [PLATE3.x, PLATE3.y, PLATE3.z], smooth(k2)); tgt = tg; pos = [tg[0] + d[0], tg[1] + d[1], tg[2] + d[2] * lerp(1.62, 1.0, smooth(k2))]; }
    }
    setCam(pos, tgt, 30);
    const f = remap(WK, t);
    if (phone.group.visible) await screenFrom('workout', f);
  };
  const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

  // ---------------- S4: nutrition (ring match) -> flip ----------------
  const NUT = [[26.0, 0], [27.0, 8], [27.8, 33], [28.9, 63], [30.1, 99], [30.55, 120], [31.3, 140], [31.8, 152], [31.81, 164], [33.5, 206]];
  const RING = { x: 936, y: 1104 };
  const nutLayer = phone.addLayer({ x: 50, y: 905, w: 1080, h: 400 }, { radius: 70 });
  const LX = P(1010, W - 90);   // left-column text right edge (16:9)
  ov.text({ t0: 26.55, t1: 28.75, text: 'תפריט מוכן.', size: P(96, 100), pos: { h: { x: LX, y: 250 }, v: { x: LX, y: 220 } }, mask: true });
  ov.text({ t0: 26.95, t1: 28.8, text: 'לפי היעדים שלך.', cls: 'mint', size: P(96, 100), pos: { h: { x: LX, y: 368 }, v: { x: LX, y: 334 } }, mask: true, stagger: 0.09 });
  ov.callout({ t0: 27.85, t1: 28.8, anchor: () => phone.screenWorld(RING.x - 150, RING.y + 60, nutLayer.lift), k: 'N-01', label: 'נותרו 2,220 קק״ל', side: 'left', len: P(150, 120), rise: P(150, 160) });
  ov.text({ t0: 29.0, t1: 31.45, text: 'מסמנים ארוחה —', size: P(88, 92), pos: { h: { x: LX, y: 250 }, v: { x: LX, y: 220 } }, mask: true });
  ov.text({ t0: 29.4, t1: 31.5, text: 'והמספרים מתעדכנים.', cls: 'mint', size: P(88, 92), pos: { h: { x: LX, y: 362 }, v: { x: LX, y: 328 } }, mask: true, stagger: 0.08 });
  ov.text({ t0: 31.9, t1: 33.9, text: 'החלפות מוכנות.', size: P(96, 100), pos: { h: { x: LX, y: 250 }, v: { x: LX, y: 220 } }, mask: true });
  ov.text({ t0: 32.3, t1: 33.95, text: 'בלי לחשב כלום.', cls: 'mint', size: P(96, 100), pos: { h: { x: LX, y: 368 }, v: { x: LX, y: 334 } }, mask: true, stagger: 0.09 });
  ov.text({ t0: 32.6, t1: 33.9, text: 'אותה קבוצת מזון · אותו ערך תזונתי', cls: 'plex', size: P(34, 36), pos: { h: { x: LX, y: 500 }, v: { x: LX, y: 462 } }, anim: 'blur', stagger: 0.03, color: '#8f9a9e' });

  const S4 = async (t) => {
    dom.glow.style.opacity = 0.9;
    phone.group.visible = true; phone.setMaterialize(1); phone.group.position.set(0, 0, 0);
    const turn = easeInOut3(inv(26.2, 28.2, t));
    const flip = easeInOut5(inv(33.7, 35.3, t));
    phone.group.rotation.set(0.03 * turn, lerp(0, 0.26, turn) + flip * (2 * Math.PI - 0.26 - 0.2), 0);
    phone.group.updateMatrixWorld(true);
    // ring-matched start: camera on screen normal through the ring center
    const ring = phone.screenWorld(RING.x, RING.y);
    const startPos = [ring.x, ring.y, ring.z + (V ? 7.29 * 0.5625 / 0.5625 : 7.29)];
    const pull = easeInOut3(inv(26.0, 27.75, t));
    let pos, tgt;
    const endPos = P([-9.5, 1.2, 30], [0, 6.0, 52]), endTgt = P([-7.6, 0.1, 0], [0, 4.3, 0]);
    const drift = smooth(inv(27.7, 33.6, t));
    const e2 = [lerp(endPos[0], endPos[0] - 1.5, drift), lerp(endPos[1], endPos[1] - 0.6, drift), lerp(endPos[2], endPos[2] - 3.5, drift)];
    pos = lerp3(startPos, e2, pull); tgt = lerp3([ring.x, ring.y, ring.z], endTgt, pull);
    // flip: re-center the phone
    const fk = easeInOut3(inv(33.6, 35.3, t));
    if (fk > 0) { pos = lerp3(pos, P([4, 1.2, 33], [0, 6, 54]), fk); tgt = lerp3(tgt, P([7.0, 0.3, 0], [0, 4.4, 0]), fk); }
    setCam(pos, tgt, 30);
    const lift = easeInOut3(inv(27.1, 27.6, t)) * (1 - easeInOut3(inv(28.45, 28.85, t)));
    nutLayer.set(lift * 1.4, lift > 0 ? 1 : 0, 1 + lift * 0.05);
    // screen: nutrition until the phone faces away, then metrics
    const yaw = phone.group.rotation.y % (2 * Math.PI);
    if (flip > 0 && yaw > Math.PI * 0.5 && t > 34.0) await screenFrom('metrics', 0);
    else await screenFrom('nutrition', remap(NUT, t), { shade: lift > 0.01 ? [{ x: 50, y: 905, w: 1080, h: 400, a: 0.6 * lift, r: 70 }] : [] });
  };

  // ---------------- S5: metrics + 3D chart -> blueprint ----------------
  const MET = [[35.2, 0], [36.4, 24], [37.6, 60], [42.5, 120]];
  ov.text({ t0: 38.1, t1: 40.9, text: 'רואים התקדמות.', size: P(92, 96), pos: { h: { x: RX, y: 96 }, v: { x: RX, y: 190 } }, mask: true, stagger: 0.09 });
  ov.text({ t0: 38.55, t1: 40.95, text: 'לא רק מרגישים.', cls: 'mint', size: P(92, 96), pos: { h: { x: RX, y: 202 }, v: { x: RX, y: 300 } }, mask: true, stagger: 0.09 });
  ov.html({ t0: 40.0, t1: 41.2, html: ['משקל', 'היקפים', 'תמונות', 'צעדים', 'שינה'].map(x => `<span class="chip">${x}</span>`).join(''),
    update: (el, t) => { const s = el.style; s.direction = 'rtl'; s.right = (W - RX) + 'px'; s.top = P(996, 1720) + 'px'; [...el.children].forEach((c, i) => { const k = easeOut3(inv(40.0 + i * 0.07, 40.4 + i * 0.07, t)); c.style.opacity = k * (1 - inv(40.9, 41.2, t)); c.style.display = 'inline-block'; c.style.transform = `translateY(${(1 - k) * 20}px)`; }); } });
  const axisEls = chart.levels.map(L => ov.html({ t0: 38.4, t1: 41.0, html: `<div class="axis">${L}</div>` }));
  const dateEls = [['13.9', 0], ['22.11', WEIGH.length - 1]].map(([d, i]) => ({ i, el: ov.html({ t0: 38.4, t1: 41.0, html: `<div class="axis">${d}</div>` }) }));
  ov.callout({ t0: 39.7, t1: 41.0, anchor: () => chart.pointWorld(WEIGH.length - 1, chart.trend[chart.trend.length - 1]), k: '+2.8 KG / 10 WK', label: 'בקצב של המטרה', side: 'left', len: P(110, 140), rise: P(130, 150) });
  let projFn = null;
  const S5 = async (t) => {
    dom.glow.style.opacity = 0.9 * (1 - inv(41.2, 42.0, t));
    phone.group.visible = true; phone.group.position.set(0, 0, 0);
    const k = smooth(inv(35.3, 42, t));
    phone.group.rotation.set(0.02, (2 * Math.PI - 0.2) + lerp(0, 0.06, k), 0);
    const pos = keyed([{ t: 35.3, v: P([4, 1.2, 33], [0, 6, 54]) }, { t: 38, v: P([6.5, 0.6, 36], [1.5, 7.2, 60]) }, { t: 42, v: P([8.5, 0.9, 38], [2.5, 7.8, 63]) }], t);
    const tgt = keyed([{ t: 35.3, v: P([7.0, 0.3, 0], [0, 4.4, 0]) }, { t: 38, v: P([9.5, -0.6, 0], [0, 6.5, 0]) }, { t: 42, v: P([10.5, -0.5, 0], [0, 7.0, 0]) }], t);
    setCam(pos, tgt, 30);
    // blueprint return
    const m = 1 - easeInOut3(inv(41.0, 42.0, t));
    phone.setMaterialize(m); phone.setLineProgress(1 - easeInOut3(inv(42.0, 42.6, t)) ); phone.setLineOpacity(1);
    dom.bgBlue.style.opacity = smooth(inv(41.0, 42.0, t)); dom.grid.style.opacity = smooth(inv(41.2, 42.0, t));
    // chart emergence
    chart.group.visible = t > 37.5;
    const ek = easeInOut5(inv(37.6, 39.0, t));
    phone.group.updateMatrixWorld(true);
    const from = phone.screenWorld((440 + 1040) / 2, (501 + 1003) / 2, 0.05);
    const toLocal = V ? new THREE.Vector3(0.4, 12.2, 3.5) : new THREE.Vector3(14.6, -2.4, 3.5);
    const to = toLocal.clone().applyMatrix4(phone.group.matrixWorld);
    chart.group.position.copy(from).lerp(to, ek);
    const sx0 = (600 / 1179 * PH.SW) / 22, sy0 = (502 / 2556 * PH.SH) / 9, s1 = V ? 0.62 : 0.78;
    chart.group.scale.set(lerp(sx0, s1, ek), lerp(sy0, s1, ek), lerp(sx0, s1, ek));
    chart.group.quaternion.copy(phone.group.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, lerp(0, V ? 0.0 : -0.32, ek), 0)));
    chart.setProgress(lerp(1, 0, 0) * easeInOut3(inv(37.6, 40.0, t)) + (t < 37.6 ? 0 : 0), 1 - inv(40.9, 41.3, t));
    if (t > 41.3) chart.group.visible = false;
    // axis labels
    projFn = projFn || ((v) => { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H }; });
    chart.group.updateMatrixWorld(true);
    axisEls.forEach((a, i) => { const L = chart.levels[i]; const p = projFn(new THREE.Vector3(-11 - 1.2, chart.y(L), 0).applyMatrix4(chart.group.matrixWorld)); const s = a.el.style; s.left = (p.x - 50) + 'px'; s.top = (p.y - 12) + 'px'; s.opacity = inv(38.4, 38.9, t) * (1 - inv(40.8, 41.1, t)); });
    dateEls.forEach(({ i, el }) => { const p = projFn(new THREE.Vector3(chart.x(i), -4.5 - 0.9, 0).applyMatrix4(chart.group.matrixWorld)); const s = el.el.style; s.left = (p.x - 26) + 'px'; s.top = (p.y) + 'px'; s.opacity = inv(38.6, 39.1, t) * (1 - inv(40.8, 41.1, t)); });
    await screenFrom('metrics', remap(MET, t));
  };

  // ---------------- S6: coach studio (laptop) -> assignment beam ----------------
  const COACH = [[44.9, 0], [46.5, 104], [46.55, 105], [47.15, 134], [47.7, 227], [50.9, 426], [51.65, 470], [52.5, 498], [53.25, 545], [53.55, 562], [55.6, 610]];
  const PHB = V ? new THREE.Vector3(0, -1.0, 15) : new THREE.Vector3(22.5, 8.0, 2.0);
  const PHB_ROT = V ? [0.05, 0, 0] : [0.02, -0.42, 0];
  ov.text({ t0: 42.05, t1: 43.65, text: 'ולמאמנים —', size: P(170, 150), pos: { h: { x: W / 2, y: 430, align: 'center' }, v: { x: W / 2, y: 820, align: 'center' } }, anim: 'slam', stagger: 0.1 });
  ov.html({ t0: 43.9, t1: 55.8, html: `<div class="label-mono">COACH STUDIO — CD-02 / EDITOR</div>`, update: (el, t) => { const s = el.style; s.left = P(120, 70) + 'px'; s.top = P(64, 110) + 'px'; s.opacity = win(t, 43.9, 55.8, 0.4, 0.4) * 0.8; } });
  const TB = P(70, 230);
  ov.text({ t0: 45.0, t1: 50.75, text: 'בונים תוכנית פעם אחת.', size: P(78, 84), pos: { h: { x: RX, y: TB }, v: { x: RX, y: TB } }, mask: true, stagger: 0.08 });
  ov.text({ t0: 45.5, t1: 50.8, text: 'שבועות · אימונים · סטים · חזרות · RIR · מנוחה', cls: 'plex', size: P(32, 34), pos: { h: { x: RX, y: TB + 104 }, v: { x: RX, y: TB + 110 } }, anim: 'blur', stagger: 0.04, color: '#8f9a9e' });
  ov.text({ t0: 50.95, t1: 52.7, text: 'מפרסמים גרסה.', size: P(78, 84), pos: { h: { x: RX, y: TB }, v: { x: RX, y: TB } }, mask: true });
  ov.text({ t0: 51.3, t1: 52.75, text: 'כל גרסה נשמרת בהיסטוריה.', cls: 'plex', size: P(32, 34), pos: { h: { x: RX, y: TB + 104 }, v: { x: RX, y: TB + 110 } }, anim: 'blur', stagger: 0.04, color: '#8f9a9e' });
  ov.text({ t0: 52.85, text: 'משייכים למתאמן —', size: P(78, 84), pos: { h: { x: RX, y: TB }, v: { x: RX, y: TB } }, mask: true, t1: 55.15 });
  ov.text({ t0: 54.3, t1: 55.2, text: 'והתוכנית אצלו. מיד.', cls: 'mint', size: P(78, 84), pos: { h: { x: RX, y: TB + 100 }, v: { x: RX, y: TB + 104 } }, mask: true, stagger: 0.08 });
  ov.callout({ t0: 45.4, t1: 46.5, anchor: () => lap.displayWorld(0.42, 0.42), k: 'LIB · 105', label: 'ספריית תרגילים', side: 'left', len: P(170, 120), rise: P(-60, -80) });
  ov.callout({ t0: 48.3, t1: 50.6, anchor: () => lap.displayWorld(0.3, 0.76), k: 'SET TABLE', label: 'כל סט מוגדר עד הסוף', side: 'left', len: P(170, 120), rise: P(70, 90) });
  ov.callout({ t0: 51.7, t1: 52.7, anchor: () => lap.displayWorld(0.133, 0.1), k: 'V2 · 22.11', label: 'גרסה חדשה פורסמה', side: 'right', len: P(150, 110), rise: P(-60, -70) });
  const S6 = async (t) => {
    if (t < 42.45) { await S5(42.0); const o = 1 - inv(42.0, 42.45, t); phone.setLineOpacity(o); dom.bgBlue.style.opacity = 1; dom.grid.style.opacity = 1; return; }
    dom.bgBlue.style.opacity = 1 - smooth(inv(44.3, 45.3, t)); dom.grid.style.opacity = 1 - smooth(inv(44.2, 45.2, t));
    dom.glow.style.opacity = 0.9 * smooth(inv(44.6, 45.6, t));
    lap.group.visible = true; lap.group.position.set(0, 0, 0); lap.group.rotation.set(0, 0, 0);
    lap.setLines(easeInOut3(inv(42.45, 44.2, t)), 1);
    const lm = easeInOut3(inv(43.95, 45.0, t)); lap.setMaterialize(lm);
    // phone B
    phB.group.visible = true; phB.group.position.copy(PHB); phB.group.position.y += Math.sin(t * 1.3) * 0.15;
    phB.group.rotation.set(PHB_ROT[0], PHB_ROT[1] + Math.sin(t * 0.7) * 0.02, PHB_ROT[2]);
    phB.setLineProgress(easeInOut3(inv(42.9, 44.4, t))); phB.setLineOpacity(1);
    phB.setMaterialize(easeInOut3(inv(44.15, 45.2, t)));
    // camera (computed from display-relative targets)
    if (!S6.keys) {
      const nrm = new THREE.Vector3(0, Math.sin(0.22), Math.cos(0.22));
      const at = (u, v, d, off = [0, 0, 0], kv = 1) => { const p = lap.displayWorld(u, v); const c = p.clone().addScaledVector(nrm, d * kv).add(new THREE.Vector3(...off)); return [c.x, c.y, c.z, p.x, p.y, p.z]; };
      const wide = (tx, ty, tz, d, ox = -6, oy = 9) => { const dir = new THREE.Vector3(ox, oy, d).normalize().multiplyScalar(Math.hypot(ox, oy, d)); return [tx + dir.x, ty + dir.y, tz + dir.z, tx, ty, tz]; };
      const kv = V ? 1.9 : 1;
      S6.keys = V ? [
        { t: 42.45, v: wide(0, 7, -6, 120, -8, 22) }, { t: 45.0, v: wide(0, 8, -6, 104, -5, 18) },
        { t: 47.6, v: at(0.33, 0.7, 40, [-2, 2, 0]) }, { t: 50.4, v: at(0.36, 0.72, 37, [1, 1, 0]) },
        { t: 51.3, v: at(0.3, 0.3, 52, [0, 2, 0]) }, { t: 52.6, v: at(0.4, 0.4, 66, [0, 2, 0]) },
        { t: 53.4, v: wide(0, 2.5, 2, 92, 3, 8) }, { t: 55.0, v: wide(0, 0.5, 6, 80, 4, 6) },
      ] : [
        { t: 42.45, v: wide(5, 9, -5, 64, -8, 18) }, { t: 45.0, v: wide(5.5, 11.5, -6, 56, -6, 11) },
        { t: 47.6, v: at(0.33, 0.72, 21, [-1.5, 1.2, 0]) }, { t: 50.4, v: at(0.37, 0.74, 19.5, [1.2, 0.8, 0]) },
        { t: 51.3, v: at(0.3, 0.32, 26, [0, 1.5, 0]) }, { t: 52.6, v: at(0.42, 0.4, 32, [0, 1.5, 0]) },
        { t: 53.4, v: wide(7.5, 11.5, -5, 56, -2, 10) }, { t: 55.0, v: wide(10.5, 11, -3, 52, 2, 8) },
      ];
    }
    const c = keyed(S6.keys, t, smooth);
    let pos = [c[0], c[1], c[2]], tgt = [c[3], c[4], c[5]];
    // final push into phone B screen (match-cut into S7)
    const pk = easeInOut3(inv(55.15, 56.0, t));
    if (pk > 0) {
      phB.group.updateMatrixWorld(true); const sc = phB.screenWorld(589, 1278); fwd.set(0, 0, 1).transformDirection(phB.group.matrixWorld);
      const ep = sc.clone().addScaledVector(fwd, 18);
      pos = lerp3(pos, [ep.x, ep.y, ep.z], pk); tgt = lerp3(tgt, [sc.x, sc.y, sc.z], pk);
    }
    dom.topband.style.opacity = win(t, 44.9, 55.5, 0.4, 0.4);
    setCam(pos, tgt, 30);
    // laptop screen
    const on = inv(44.7, 45.1, t);
    if (t < 44.9) { lap.ctx.fillStyle = '#050505'; lap.ctx.fillRect(0, 0, 2160, 1416); lap.tex.needsUpdate = true; }
    else { const f = remap(COACH, t); const img = await media.frame('coach', f); lap.compose(img, { taps: tapList('coach', f) }); if (on < 1) { lap.ctx.fillStyle = `rgba(0,0,0,${1 - on})`; lap.ctx.fillRect(0, 0, 2160, 1416); } }
    // beam laptop -> phone
    const bh = easeInOut3(inv(53.55, 54.3, t)), bt = easeInOut3(inv(53.85, 54.65, t));
    if (bh > 0 && bt < 1) {
      beam.group.visible = true;
      phB.group.updateMatrixWorld(true);
      beam.setPath(lap.displayWorld(0.793, 0.377), phB.screenWorld(589, 1278, 0.05), V ? 6 : 7);
      beam.set(bh, bt, 1);
    }
    // phone B screen: before -> after assignment
    const flash = Math.max(0, 1 - Math.abs(t - 54.32) / 0.22);
    if (t < 54.3) await (async () => { const img = await media.frame('home', 0); phB.compose([{ img }], {}); })();
    else { const img = await media.frame('assigned', remap([[54.3, 0], [56.0, 40]], t)); phB.compose([{ img }], { overlay: flash > 0 ? (cx, w, h) => { cx.fillStyle = `rgba(160,255,230,${flash * 0.55})`; cx.fillRect(0, 0, w, h); } : null }); }
    phB.updateClip();
  };

  // ---------------- S7: lineup -> end card ----------------
  const LINE = V
    ? [{ p: [-8.5, 0.6, -9], r: 0.32, src: ['workout', 140] }, { p: [8.5, 0.6, -9], r: -0.32, src: ['nutrition', 110] }, { p: [0, 0, 0], r: 0, src: ['assigned', 40] }, { p: [-15, 0, -22], r: 0.5, src: ['onboarding', 330], hide: true }, { p: [15, 0, -22], r: -0.5, src: ['metrics', 60], hide: true }]
    : [{ p: [-24, 0.2, -9], r: 0.5, src: ['onboarding', 330] }, { p: [-12, 0.6, -2.5], r: 0.25, src: ['workout', 140] }, { p: [0, 0, 0], r: 0, src: ['assigned', 40] }, { p: [12, 0.6, -2.5], r: -0.25, src: ['nutrition', 110] }, { p: [24, 0.2, -9], r: -0.5, src: ['metrics', 60] }];
  const order7 = [phones[2], phones[3], phones[0], phones[4], phB];   // phones[0] is the hero (center)
  ov.text({ t0: 56.5, t1: 59.4, text: 'אימונים · תזונה · מדדים · ניהול מאמן', cls: 'med', size: P(46, 44), pos: { h: { x: W / 2, y: 64, align: 'center' }, v: { x: W / 2, y: 250, align: 'center' } }, anim: 'blur', stagger: 0.05, color: '#c9d2d5' });
  ov.text({ t0: 57.1, t1: 59.5, text: 'הכול במקום אחד.', cls: 'mint', size: P(118, 112), pos: { h: { x: W / 2, y: 128, align: 'center' }, v: { x: W / 2, y: 330, align: 'center' } }, anim: 'slam', stagger: 0.08 });
  // end card
  ov.html({ t0: 60.6, t1: 66.5, html: `<div style="text-align:center;width:100%">
      <div class="ttl" style="font:800 ${P(132, 120)}px/1 Heebo;letter-spacing:-.02em;direction:ltr">Coach Daniel</div>
      <div class="tag" style="font:400 ${P(38, 40)}px 'IBM Plex Sans Hebrew';color:#c9d2d5;margin-top:${P(22, 26)}px;direction:rtl">תוכנית אימונים, תפריט ומעקב — במקום אחד</div>
      <div class="cta" style="margin-top:${P(40, 54)}px;direction:rtl"><span class="chip" style="border-color:#4fe3c1;color:#4fe3c1;font-weight:500">נכנסים בלי הרשמה</span><span class="chip" style="font-family:'IBM Plex Mono';direction:ltr">coach-daniel.expo.app</span></div></div>`,
    update: (el, t) => { const s = el.style; s.left = '0'; s.width = W + 'px'; s.top = P(640, 1180) + 'px';
      const a = easeOut5(inv(60.75, 61.5, t)); const ttl = el.querySelector('.ttl'); ttl.style.opacity = a; ttl.style.transform = `translateY(${(1 - a) * 40}px)`; ttl.style.letterSpacing = `${lerp(0.18, -0.02, a)}em`; ttl.style.filter = `blur(${(1 - a) * 10}px)`;
      const b = easeOut3(inv(61.3, 61.9, t)); const tg = el.querySelector('.tag'); tg.style.opacity = b; tg.style.transform = `translateY(${(1 - b) * 20}px)`;
      const c = easeOut3(inv(61.9, 62.5, t)); const ct = el.querySelector('.cta'); ct.style.opacity = c; ct.style.transform = `translateY(${(1 - c) * 20}px)`; } });
  ov.html({ t0: 60.4, t1: 66.5, html: [0, 1, 2, 3].map(i => `<div class="corner" style="${i < 2 ? 'top' : 'bottom'}:${P(48, 60)}px;${i % 2 ? 'right' : 'left'}:${P(48, 40)}px;border-${i < 2 ? 'top' : 'bottom'}-width:2px;border-${i % 2 ? 'right' : 'left'}-width:2px"></div>`).join('') + `<div class="label-mono" style="position:absolute;left:${P(120, 70)}px;bottom:${P(92, 110)}px;opacity:.75">CD-03 / END — REV A · 2026</div>`,
    update: (el, t) => { el.style.inset = '0'; el.style.opacity = inv(60.4, 61.2, t); } });
  const S7 = async (t) => {
    dom.glow.style.opacity = 0.9;
    const out = easeIn3(inv(59.5, 60.5, t));
    for (let i = 0; i < 5; i++) {
      const ph = order7[i], L = LINE[i]; ph.group.visible = !L.hide && out < 0.999; ph.setMaterialize(1);
      const side = Math.sign(L.p[0]) || 0;
      ph.group.position.set(L.p[0] * (1 + out * 1.2) + side * out * 10, L.p[1] + Math.sin(t * 1.1 + i) * 0.18 + (i === 2 ? -out * 2 : 0), L.p[2] - out * (i === 2 ? 45 : 25));
      ph.group.rotation.set(0.03, L.r + Math.sin(t * 0.6 + i) * 0.02 - side * out * 0.6, 0);
    }
    // camera: from hero screen (matches S6 end) pulling back to the lineup
    const hero = order7[2]; hero.group.updateMatrixWorld(true);
    const sc = hero.screenWorld(589, 1278); fwd.set(0, 0, 1).transformDirection(hero.group.matrixWorld);
    const start = sc.clone().addScaledVector(fwd, 18);
    const k = easeInOut3(inv(56.0, 58.4, t));
    const wide = V ? [0, 2.5, 92] : [0, 3.5, 58], wideT = V ? [0, -2.2, -4] : [0, 2.2, -4];
    const drift = smooth(inv(58.4, 66, t));
    let pos = lerp3([start.x, start.y, start.z], [wide[0] + drift * 3, wide[1] + drift * 1.5, wide[2] - drift * 6], k);
    let tgt = lerp3([sc.x, sc.y, sc.z], wideT, k);
    setCam(pos, tgt, 30);
    // icon
    const ik = easeOutBack(inv(60.1, 61.0, t), 1.25); icon.group.visible = t > 60.05;
    icon.group.position.set(0, P(4.2, 7.6), lerp(-30, 0, easeOut5(inv(60.0, 60.9, t))) + drift * 2);
    icon.group.rotation.set(Math.sin(t * 0.9) * 0.06, lerp(-1.6, 0, easeOut5(inv(60.05, 61.2, t))) + Math.sin(t * 0.7) * 0.12, 0);
    icon.group.scale.setScalar(Math.max(0.001, ik) * P(1.3, 1.45));
    dom.grid.style.opacity = 0.35 * inv(60.2, 61.4, t); dom.bgBlue.style.opacity = 0.6 * inv(60.2, 61.4, t);
    // screens
    for (let i = 0; i < 5; i++) { const ph = order7[i]; if (!ph.group.visible) continue; const [n, f] = LINE[i].src; const img = await media.frame(n, f); ph.compose([{ img }], {}); }
    // final fade
    dom.flash.style.background = '#000'; dom.flash.style.mixBlendMode = 'normal'; dom.flash.style.opacity = inv(65.55, 66.0, t);
  };

  const shots = [
    { t0: 0, t1: 8.0, fn: S1 }, { t0: 8.0, t1: 16.0, fn: S2 }, { t0: 16.0, t1: 26.0, fn: S3 }, { t0: 26.0, t1: 35.3, fn: S4 },
    { t0: 35.3, t1: 42.0, fn: S5 }, { t0: 42.0, t1: 56.0, fn: S6 }, { t0: 56.0, t1: 66.01, fn: S7 },
  ];
  const duration = 66;
  async function update(t) {
    for (const o of allObjs) o.visible = false;
    for (const ph of phones) { ph.setMaterialize(1); for (const L of ph.layers) L.set(0, 0); }
    dumb.setFlat(0); beam.group.visible = false;
    dom.flash.style.opacity = 0; dom.flash.style.background = ''; dom.flash.style.mixBlendMode = '';
    dom.bgBlue.style.opacity = 0; dom.grid.style.opacity = 0; dom.glow.style.opacity = 0; dom.topband.style.opacity = 0;
    const s = shots.find(s => t >= s.t0 && t < s.t1) || shots[shots.length - 1];
    await s.fn(t);
    for (const ph of phones) ph.updateClip();
    lap.updateClip();
  }
  return { duration, update };
}
