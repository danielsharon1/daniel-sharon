// usage: node render/qa_layout.js <h|v> [step=3]
const { chromium } = require('playwright');
(async () => {
  const aspect = process.argv[2] || 'v', step = +(process.argv[3] || 3);
  const W = aspect === 'v' ? 1080 : 1920, H = aspect === 'v' ? 1920 : 1080;
  // safe zones: 9:16 keeps clear of platform UI (top bar, caption area, right action column)
  const SAFE = aspect === 'v' ? { x0: 60, x1: 960, y0: 200, y1: 1560 } : { x0: 60, x1: W - 60, y0: 40, y1: H - 40 };
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.goto(`http://localhost:8123/render/index.html?aspect=${aspect}`);
  await p.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const issues = new Map();
  for (let f = 0; f < 66 * 30; f += step) {
    const els = await p.evaluate(f => window.qaLayout(f), f);
    for (const e of els) {
      const bad = [];
      if (e.x0 < SAFE.x0) bad.push(`L${e.x0}`); if (e.x1 > SAFE.x1) bad.push(`R${e.x1}`);
      if (e.y0 < SAFE.y0) bad.push(`T${e.y0}`); if (e.y1 > SAFE.y1) bad.push(`B${e.y1}`);
      if (bad.length) { const k = e.txt; const cur = issues.get(k) || { first: f / 30, last: f / 30, bad: new Set(), n: 0 }; cur.last = f / 30; cur.n++; bad.forEach(x => cur.bad.add(x.replace(/\d+/, '') + '')); cur.ex = bad.join(' '); issues.set(k, cur); }
    }
  }
  for (const [k, v] of issues) console.log(`${v.first.toFixed(2)}-${v.last.toFixed(2)}s  [${v.ex}]  "${k}"  (${v.n} samples)`);
  console.log('issues:', issues.size);
  await b.close();
})();
