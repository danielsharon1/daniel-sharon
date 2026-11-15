import type { GeoPoint } from "./types.js";

const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle distance in km. Only call with grounded coordinates. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rough bounding box of Israel incl. the Golan and Eilat; used to reject nonsense coordinates. */
export function isPlausibleIsraelPoint(p: GeoPoint): boolean {
  return p.lat >= 29.3 && p.lat <= 33.5 && p.lon >= 34.0 && p.lon <= 36.0;
}
