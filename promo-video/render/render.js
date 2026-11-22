// Parallel deterministic renderer with a chunk queue (balanced load).
// usage: node render/render.js <h|v> <outdir> [workers=3] [step=1] [from=0] [to=end] [chunk=60]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const path = require('path');
const [aspect = 'h', outDir = 'out', workers = '3', step = '1', from = '0', to = '', chunkSize = '60'] = process.argv.slice(2);
const W = aspect === 'v' ? 1080 : 1920, H = aspect === 'v' ? 1920 : 1080, FPS = 30;
const GRAIN = process.env.GRAIN ?? '3';
fs.mkdirSync(outDir, { recursive: true });
const total = Math.round(66 * FPS), end = to ? +to : total;
const all = []; for (let f = +from; f < end; f += +step) all.push(f);
const chunks = []; for (let i = 0; i < all.length; i += +chunkSize) chunks.push(all.slice(i, i + +chunkSize));
let next = 0; const t0 = Date.now(); let doneFrames = 0;
const segName = (i) => path.join(outDir, `seg_${aspect}_${String(i).padStart(3, '0')}.mp4`);
async function encodeChunk(p, idx) {
  const frames = chunks[idx]; const seg = segName(idx);
  if (fs.existsSync(seg) && fs.statSync(seg).size > 1000 && process.env.RESUME) return;
  const vf = +GRAIN > 0 ? ['-vf', `noise=alls=${GRAIN}:allf=t`] : [];
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS / +step), '-c:v', 'png', '-i', '-', ...vf,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(FPS / +step), seg + '.tmp.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (const f of frames) {
    await p.evaluate(f => window.renderFrame(f), f);
    const buf = await p.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    doneFrames++;
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  fs.renameSync(seg + '.tmp.mp4', seg);
  const el = (Date.now() - t0) / 1000;
  console.log(`chunk ${idx + 1}/${chunks.length} done · ${doneFrames}/${all.length} frames · ${(el / 60).toFixed(1)} min · eta ${((all.length - doneFrames) * el / doneFrames / 60).toFixed(1)} min`);
}
async function worker(k) {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', e => console.log(`[w${k}] PAGEERROR`, e.message));
  await p.goto(`http://localhost:8123/render/index.html?aspect=${aspect}`);
  await p.waitForFunction(() => window.ready === true, null, { timeout: 180000 });
  while (next < chunks.length) { const idx = next++; await encodeChunk(p, idx); }
  await b.close();
}
(async () => {
  await Promise.all([...Array(+workers).keys()].map(worker));
  fs.writeFileSync(path.join(outDir, `list_${aspect}.txt`), chunks.map((_, i) => `file '${path.resolve(segName(i))}'`).join('\n'));
  console.log('done in', ((Date.now() - t0) / 60000).toFixed(1), 'min');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
