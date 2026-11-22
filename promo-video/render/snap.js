// Quick preview: node snap.js <aspect h|v> <t1,t2,...> <outdir>
const { chromium } = require('playwright');
(async () => {
  const [aspect, ts, out] = [process.argv[2] || 'h', process.argv[3] || '0', process.argv[4] || '/tmp/snap'];
  require('fs').mkdirSync(out, { recursive: true });
  const W = aspect === 'v' ? 1080 : 1920, H = aspect === 'v' ? 1920 : 1080;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text().slice(0, 300)); });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(`http://localhost:8123/render/index.html?aspect=${aspect}`);
  await p.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  for (const t of ts.split(',').map(Number)) {
    const t0 = Date.now();
    await p.evaluate(f => window.renderFrame(f), Math.round(t * 30));
    await p.screenshot({ path: `${out}/${aspect}_${t.toFixed(2)}.png` });
    console.log('t', t, (Date.now() - t0) + 'ms');
  }
  await b.close();
})();
