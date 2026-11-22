export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));           // normalized progress of x in [a,b]
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const easeOut3 = (t) => 1 - Math.pow(1 - t, 3);
export const easeOut5 = (t) => 1 - Math.pow(1 - t, 5);
export const easeIn3 = (t) => t * t * t;
export const easeInOut3 = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeInOut5 = (t) => t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2;
export const easeOutBack = (t, s = 1.6) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const expoInOut = (t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
export const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const deg = Math.PI / 180;
export const pad5 = (n) => String(n).padStart(5, '0');
// window: 0 before a, ramps to 1 over [a, a+fi], holds, ramps down over [b-fo, b]
export const win = (t, a, b, fi = 0.3, fo = 0.3) => Math.min(inv(a, a + fi, t), 1 - inv(b - fo, b, t));
// Catmull-Rom through keyframes [{t, v:[..]}], value at time t (clamped)
export function keyed(keys, t, ease = (x) => x) {
  if (t <= keys[0].t) return keys[0].v.slice();
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].v.slice();
  let i = 0; while (t > keys[i + 1].t) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
  const u = ease((t - k1.t) / (k2.t - k1.t));
  return k1.v.map((_, j) => {
    const p0 = k0.v[j], p1 = k1.v[j], p2 = k2.v[j], p3 = k3.v[j];
    const u2 = u * u, u3 = u2 * u;
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
  });
}
// deterministic pseudo-random
export function rand(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
