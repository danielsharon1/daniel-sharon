// Deterministic app screen recorder. A scene script drives the real app with
// Playwright while virtual time advances exactly 1/fps per captured frame.
const { chromium, devices } = require('playwright');
const fs = require('fs'); const path = require('path');

const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

async function createRecorder({ out, fps = 30, storageState, saveState, device = 'iPhone 14 Pro', viewport, dpr, safeArea = { top: 59, bottom: 34 }, format = 'png', colorScheme = 'dark' }) {
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (/^f\d+\.(png|jpg)$/.test(f)) fs.unlinkSync(path.join(out, f));
  const browser = await chromium.launch();
  const base = viewport ? { viewport, deviceScaleFactor: dpr || 2, isMobile: false, hasTouch: false } : { ...devices[device], viewport: { width: 393, height: 793 }, screen: { width: 393, height: 852 } };
  if (dpr) base.deviceScaleFactor = dpr;
  const ctx = await browser.newContext({ ...base, colorScheme, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', ...(storageState && fs.existsSync(storageState) ? { storageState } : {}) });
  await ctx.addInitScript({ path: path.join(__dirname, 'vt-init.js') });
  await ctx.addInitScript(() => {
    const css = '::-webkit-scrollbar{display:none!important;width:0!important;height:0!important} *{scrollbar-width:none!important;caret-color:transparent!important}';
    const add = () => { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 200)));
  const cdp = await ctx.newCDPSession(page);
  if (safeArea && !viewport) {
    try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: safeArea.top, bottom: safeArea.bottom, left: 0, right: 0 } }); console.log('safe-area override ok'); }
    catch (e) { console.log('safe-area override unavailable:', e.message.slice(0, 120)); }
  }
  let frame = 0; const events = [];
  const dt = 1000 / fps;
  const settle = async () => { await page.evaluate(async () => { await window.__vt.realTick(); await window.__vt.realTick(); }); };
  const capture = async (speed = 1) => {
    await page.evaluate((ms) => window.__vt.advance(ms), dt * speed);
    await settle();
    const f = path.join(out, `f${String(frame).padStart(5, '0')}.${format}`);
    await page.screenshot({ path: f, type: format === 'jpg' ? 'jpeg' : 'png', ...(format === 'jpg' ? { quality: 92 } : {}) });
    frame++;
  };
  const rec = {
    page, ctx, cdp, fps,
    get frame() { return frame; },
    mark(name, extra = {}) { events.push({ type: 'mark', name, frame, ...extra }); },
    async goto(url) { await page.goto(url, { waitUntil: 'networkidle' }); },
    async ready() { for (let i = 0; i < 40; i++) { const t = await page.evaluate(() => document.body.innerText); if (!t.includes('טוען') && !t.includes('מכינים')) break; await page.waitForTimeout(400); } await page.waitForTimeout(1000); },
    async dismissTour() {
      for (let k = 0; k < 2; k++) {
        try { await page.getByText('דילוג', { exact: true }).first().waitFor({ timeout: 4500 }); } catch { continue; }
        await page.getByText('דילוג', { exact: true }).first().click(); await page.waitForTimeout(900);
      }
    },
    async enable() { await page.evaluate(() => window.__vt.enable()); },
    async disable() { await page.evaluate(() => window.__vt.disable()); },
    // capture `sec` seconds of frames
    async hold(sec, { speed = 1 } = {}) { const n = Math.round(sec * fps); for (let i = 0; i < n; i++) await capture(speed); },
    // let the app do real-time work (network) without advancing video time
    async offline(fn) { await page.evaluate(() => window.__vt.disable()); await fn(); await page.evaluate(() => window.__vt.enable()); },
    async box(locator) { const b = await locator.boundingBox(); if (!b) throw new Error('no box'); return b; },
    // tap: visual press lead-in, then click, logged for the compositor's touch indicator
    async tap(locator, { lead = 0.25, after = 0 } = {}) {
      const b = await rec.box(locator); const x = b.x + b.width / 2, y = b.y + b.height / 2;
      events.push({ type: 'tap', frame: frame + Math.round(lead * fps), x, y });
      await rec.hold(lead);
      await locator.click({ noWaitAfter: true, force: true, timeout: 5000 });
      await settle();
      if (after) await rec.hold(after);
    },
    async type(locator, text, { cps = 12 } = {}) {
      await locator.focus();
      const chars = [...text]; let cur = '';
      for (const ch of chars) { cur += ch; await locator.fill(cur); await settle(); await rec.hold(1 / cps); }
    },
    // smooth programmatic scroll of the scroll container that contains `locator` (or the main one)
    async scroll(dy, sec, { selector } = {}) {
      const handle = await page.evaluateHandle((sel) => {
        const cands = [...document.querySelectorAll(sel || '*')].filter(e => { const s = getComputedStyle(e); return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 20 && e.getBoundingClientRect().height > 300; });
        cands.sort((a, b) => b.clientHeight - a.clientHeight); return cands[0] || document.scrollingElement;
      }, selector);
      const start = await handle.evaluate(e => e.scrollTop);
      const maxS = await handle.evaluate(e => e.scrollHeight - e.clientHeight); dy = Math.max(-start, Math.min(dy, maxS - start));
      const n = Math.round(sec * fps);
      events.push({ type: 'scroll', frame, dy, frames: n });
      for (let i = 1; i <= n; i++) { await handle.evaluate((e, v) => { e.scrollTop = v; }, start + dy * ease(i / n)); await capture(); }
    },
    events,
    async close() {
      fs.writeFileSync(path.join(out, 'events.json'), JSON.stringify({ fps, frames: frame, events, viewport: page.viewportSize(), dpr: base.deviceScaleFactor }, null, 1));
      if (saveState) await ctx.storageState({ path: saveState });
      await browser.close();
      console.log(`recorded ${frame} frames -> ${out}`);
    },
  };
  return rec;
}
module.exports = { createRecorder, ease };
