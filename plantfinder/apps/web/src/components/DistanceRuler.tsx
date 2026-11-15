import type { ResultItem } from "@plantfinder/shared";
import type { Dict, Lang } from "../i18n";

interface Props {
  items: ResultItem[];
  radiusKm: number;
  t: Dict;
  lang: Lang;
}

/**
 * Where each seller sits relative to the chosen radius. Only sellers with a verified location are
 * plotted; the rest are named underneath so it is clear they were not placed by guesswork.
 */
export function DistanceRuler({ items, radiusKm, t, lang }: Props) {
  const sellers = new Map<string, { name: string; km: number; inRange: boolean }>();
  const unknown = new Set<string>();
  for (const i of items) {
    if (i.bucket === "related_species") continue;
    const name = i.seller.name[lang];
    if (i.distanceKm === null) unknown.add(name);
    else if (!sellers.has(name)) sellers.set(name, { name, km: i.distanceKm, inRange: i.distanceKm <= radiusKm });
  }
  const placed = [...sellers.values()].sort((a, b) => a.km - b.km);
  if (placed.length === 0 && unknown.size === 0) return null;
  const maxKm = Math.max(radiusKm * 1.6, ...placed.map((p) => p.km)) * 1.05;
  const pos = (km: number) => `${Math.min(100, (km / maxKm) * 100)}%`;
  // Keep labels inside the track: near either end, align the label to the dot instead of centring it.
  const anchor = (km: number) => (km / maxKm > 0.7 ? "end" : km / maxKm < 0.15 ? "start" : "");

  return (
    <figure className="ruler" aria-label={t.field.distance}>
      <div className="ruler__track">
        <span className="ruler__zero" aria-hidden="true">0</span>
        <span className="ruler__radius" style={{ insetInlineStart: pos(radiusKm) }}>
          {t.kmAway(radiusKm)}
        </span>
        <ol className="ruler__marks">
          {placed.map((p, idx) => (
            <li
              key={p.name}
              className={`ruler__mark ${p.inRange ? "in" : "out"} ${idx % 2 ? "alt" : ""} ${anchor(p.km)}`}
              style={{ insetInlineStart: pos(p.km) }}
            >
              <span className="ruler__dot" aria-hidden="true" />
              <span className="ruler__text">
                <span className="ruler__name">{p.name}</span> <b>{t.kmAway(p.km)}</b>
              </span>
            </li>
          ))}
        </ol>
      </div>
      {/* Narrow screens: names move out of the track into this legend (visual duplicate, hidden from AT). */}
      <ul className="ruler__legend" aria-hidden="true">
        {placed.map((p) => (
          <li key={p.name} className={p.inRange ? "in" : "out"}>
            {p.name} <b>{t.kmAway(p.km)}</b>
          </li>
        ))}
      </ul>
      {unknown.size > 0 && (
        <figcaption className="ruler__unknown">
          {t.buckets.location_unknown}: {[...unknown].join(", ")}
        </figcaption>
      )}
    </figure>
  );
}
