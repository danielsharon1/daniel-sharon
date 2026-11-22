// Virtual time for deterministic app screen recording (timesnap-style).
// Until __vt.enable() is called everything delegates to the real clock.
(() => {
  if (window.__vt) return;
  const R = {
    setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window), clearInterval: window.clearInterval.bind(window),
    raf: window.requestAnimationFrame.bind(window), caf: window.cancelAnimationFrame.bind(window),
    perfNow: performance.now.bind(performance), Date: window.Date,
  };
  let enabled = false, vnow = 0, perfBase = 0, dateBase = 0, nextId = 1e7;
  const timers = new Map();   // id -> {t, fn, args, interval}
  const rafs = new Map();     // id -> cb
  const realIds = new Map();  // our id -> real id (for timers scheduled while disabled)
  const dateNow = () => enabled ? dateBase + (vnow - perfBase) : R.Date.now();

  class VDate extends R.Date {
    constructor(...a) { if (a.length === 0) super(dateNow()); else super(...a); }
    static now() { return dateNow(); }
  }
  VDate.UTC = R.Date.UTC; VDate.parse = R.Date.parse;
  window.Date = VDate;
  performance.now = () => enabled ? vnow : R.perfNow();

  window.setTimeout = (fn, d = 0, ...args) => {
    const id = nextId++;
    if (!enabled) { realIds.set(id, R.setTimeout(() => { realIds.delete(id); typeof fn === 'function' ? fn(...args) : eval(fn); }, d)); return id; }
    timers.set(id, { t: vnow + Math.max(0, +d || 0), fn, args, interval: 0 }); return id;
  };
  window.setInterval = (fn, d = 0, ...args) => {
    const id = nextId++;
    if (!enabled) { realIds.set(id, R.setInterval(() => fn(...args), d)); return id; }
    const iv = Math.max(1, +d || 0);
    timers.set(id, { t: vnow + iv, fn, args, interval: iv }); return id;
  };
  window.clearTimeout = window.clearInterval = (id) => {
    if (realIds.has(id)) { R.clearTimeout(realIds.get(id)); R.clearInterval(realIds.get(id)); realIds.delete(id); }
    timers.delete(id);
  };
  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    if (!enabled) { realIds.set(id, R.raf((ts) => { realIds.delete(id); cb(ts); })); return id; }
    rafs.set(id, cb); return id;
  };
  window.cancelAnimationFrame = (id) => { if (realIds.has(id)) { R.caf(realIds.get(id)); realIds.delete(id); } rafs.delete(id); };

  const runTimersUntil = (target) => {
    for (let guard = 0; guard < 5000; guard++) {
      let best = null, bestId = null;
      for (const [id, tm] of timers) if (tm.t <= target && (!best || tm.t < best.t)) { best = tm; bestId = id; }
      if (!best) break;
      vnow = Math.max(vnow, best.t);
      if (best.interval) best.t += best.interval; else timers.delete(bestId);
      try { typeof best.fn === 'function' ? best.fn(...best.args) : eval(best.fn); } catch (e) { console.error('vt timer', e); }
    }
  };
  window.__vt = {
    get enabled() { return enabled; },
    now: () => vnow,
    enable() { if (enabled) return; perfBase = vnow = R.perfNow(); dateBase = R.Date.now(); enabled = true; },
    disable() {
      if (!enabled) return; enabled = false;
      for (const [id, tm] of timers) { const d = Math.max(0, tm.t - vnow); realIds.set(id, tm.interval ? R.setInterval(() => tm.fn(...tm.args), tm.interval) : R.setTimeout(() => tm.fn(...tm.args), d)); }
      timers.clear();
      for (const [id, cb] of rafs) realIds.set(id, R.raf(cb)); rafs.clear();
    },
    advance(ms) {
      const target = vnow + ms;
      runTimersUntil(target);
      vnow = target;
      const cbs = [...rafs.values()]; rafs.clear();
      for (const cb of cbs) { try { cb(vnow); } catch (e) { console.error('vt raf', e); } }
      runTimersUntil(target);
      // Web Animations / CSS: step them with virtual time
      try { for (const a of document.getAnimations()) { if (a.playState === 'running') { a.pause(); a.__vt0 = vnow - (a.currentTime || 0); } if (a.__vt0 !== undefined) a.currentTime = vnow - a.__vt0; } } catch (e) {}
    },
    realTick: () => new Promise(r => R.setTimeout(r, 0)),
  };
})();
