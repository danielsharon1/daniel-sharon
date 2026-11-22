import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setLineResolution } from './lines.js';
import { Overlay } from './overlay.js';
import { buildTimeline } from './timeline.js';

const params = new URLSearchParams(location.search);
const aspect = params.get('aspect') === 'v' ? 'v' : 'h';
const W = aspect === 'v' ? 1080 : 1920, H = aspect === 'v' ? 1920 : 1080;
const stage = document.getElementById('stage'); stage.style.width = W + 'px'; stage.style.height = H + 'px'; stage.classList.add(aspect);
document.body.style.width = W + 'px'; document.body.style.height = H + 'px';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.localClippingEnabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
setLineResolution(W, H);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment(); 
scene.environment = pmrem.fromScene(room, 0.035).texture;
scene.environmentIntensity = 0.9;
const camera = new THREE.PerspectiveCamera(30, W / H, 0.25, 900);

// lights: key, cool fill, mint rim
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-8, 12, 14); scene.add(key);
const rim = new THREE.DirectionalLight(0x4fe3c1, 3.2); rim.position.set(14, 4, -10); scene.add(rim);
const rim2 = new THREE.DirectionalLight(0x9fd8ff, 1.2); rim2.position.set(-14, -6, -8); scene.add(rim2);
scene.add(new THREE.AmbientLight(0xffffff, 0.15));

// ---------- media: recorded frame sequences ----------
const cache = new Map(); const order = [];
async function loadImg(url) {
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img ' + url)); im.src = url; });
  cache.set(url, p); order.push(url);
  while (order.length > 48) cache.delete(order.shift());
  return p;
}
const meta = {};
async function seqMeta(name) { if (!meta[name]) meta[name] = await (await fetch(`rec/${name}/events.json`)).json(); return meta[name]; }
const media = {
  frame: (name, i) => { const m = meta[name]; const n = m ? m.frames : 1e9; const k = Math.max(0, Math.min(n - 1, Math.round(i))); return loadImg(`rec/${name}/f${String(k).padStart(5, '0')}.png`); },
  img: (url) => loadImg(url),
  meta: (name) => meta[name], seqMeta,
};

const ov = new Overlay(document.getElementById('ov'), W, H, aspect);
const dom = { bg: document.getElementById('bg'), bgBlue: document.getElementById('bgBlue'), grid: document.getElementById('grid'), glow: document.getElementById('glow'), flash: document.getElementById('flash'), vignette: document.getElementById('vignette'), topband: document.getElementById('topband') };

const tl = await buildTimeline({ THREE, scene, camera, renderer, ov, media, aspect, W, H, dom, lights: { key, rim, rim2 } });
const tmpV = new THREE.Vector3();
const project = (v) => { tmpV.copy(v).project(camera); return { x: (tmpV.x + 1) / 2 * W, y: (1 - tmpV.y) / 2 * H, z: tmpV.z }; };

window.DURATION = tl.duration;
window.renderFrame = async (f, fps = 30) => {
  const t = f / fps;
  await tl.update(t);
  camera.updateMatrixWorld(true);
  ov.update(t, project);
  renderer.render(scene, camera);
  return true;
};
// layout QA: bounding boxes of every visible overlay text element at frame f (no GL render)
window.qaLayout = async (f, fps = 30) => {
  const t = f / fps; await tl.update(t); camera.updateMatrixWorld(true); ov.update(t, project);
  const eff = (el) => { let o = 1; for (let e = el; e && e.id !== 'stage'; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= +cs.opacity; } return o; };
  const out = [];
  const leaves = [...document.querySelectorAll('#ov .ki, #ov .co-label, #ov .kh *')].filter(e => e.classList.contains('ki') || e.classList.contains('co-label') || (e.children.length === 0 && e.textContent.trim()) || e.classList.contains('chip'));
  const textRect = (e) => { if (e.classList.contains('co-label') || e.classList.contains('chip')) return e.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(e); return rg.getBoundingClientRect(); };
  for (const e of leaves) {
    const o = eff(e); if (o < 0.12) continue; const r = textRect(e); if (r.width < 2) continue;
    let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    const m = e.closest('.kw.mask'); if (m) { const q = m.getBoundingClientRect(); x0 = Math.max(x0, q.left); y0 = Math.max(y0, q.top); x1 = Math.min(x1, q.right); y1 = Math.min(y1, q.bottom); if (x1 - x0 < 2 || y1 - y0 < 4) continue; }
    out.push({ txt: e.textContent.trim().slice(0, 40), x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x1), y1: Math.round(y1), o: +o.toFixed(2) });
  }
  return out;
};
await document.fonts.ready;
for (const f of ['900 40px Heebo', '700 40px Heebo', '500 40px Heebo', '300 40px Heebo', '400 20px "IBM Plex Mono"', '500 20px "IBM Plex Mono"', '400 20px "IBM Plex Sans Hebrew"', '500 20px "IBM Plex Sans Hebrew"']) await document.fonts.load(f, 'אבג abc 123');
window.ready = true;
