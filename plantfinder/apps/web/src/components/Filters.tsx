import { useEffect, useRef, useState } from "react";
import type { SellerType, SizeClass, SortKey } from "@plantfinder/shared";
import type { Dict } from "../i18n";
import { api, type SearchParams } from "../api";

interface Props {
  params: SearchParams;
  t: Dict;
  onChange: (patch: Partial<SearchParams>) => void;
  onError: (code: string) => void;
}

const RADII = [5, 10, 15, 25, 30, 40, 60, 100];
const SIZES: SizeClass[] = ["XS", "S", "M", "L", "XL", "XXL"];
const SELLERS: SellerType[] = ["nursery", "online_store"];
const SORTS: SortKey[] = ["price", "distance", "freshness", "relevance"];

function NumberField({ id, label, value, onCommit }: { id: string; label: string; value: number | null; onCommit: (v: number | null) => void }) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => setDraft(value === null ? "" : String(value)), [value]);
  const commit = () => {
    const v = draft.trim() === "" ? null : Math.max(0, Math.round(Number(draft)));
    if (v === null || Number.isFinite(v)) onCommit(v);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={10}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </div>
  );
}

export function Filters({ params, t, onChange, onError }: Props) {
  const [cityDraft, setCityDraft] = useState(params.city);
  const [cities, setCities] = useState<{ id: number; he: string; en: string }[]>([]);
  const [locating, setLocating] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const usingGeo = !params.city && params.lat !== null;

  useEffect(() => setCityDraft(params.city), [params.city]);

  useEffect(() => {
    if (cityDraft.trim().length < 2) return setCities([]);
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    const timer = setTimeout(() => {
      api
        .suggest(cityDraft, c.signal)
        .then((r) => setCities(r.cities))
        .catch(() => undefined);
    }, 150);
    return () => clearTimeout(timer);
  }, [cityDraft]);

  const commitCity = () => {
    if (cityDraft.trim() !== params.city) onChange({ city: cityDraft.trim(), lat: null, lon: null });
  };

  const locate = () => {
    if (!("geolocation" in navigator)) return onError("geolocation");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ city: "", lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 });
      },
      () => {
        setLocating(false);
        onError("geolocation");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 }
    );
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="filters">
      <fieldset className="group">
        <legend>{t.field.locality}</legend>
        <div className="field">
          <label htmlFor="f-city">{t.city}</label>
          <input
            id="f-city"
            list="f-city-list"
            autoComplete="off"
            placeholder={usingGeo ? t.myLocationActive : t.cityPlaceholder}
            value={cityDraft}
            onChange={(e) => {
              setCityDraft(e.target.value);
              // Selecting a datalist option fires change with the full value: commit right away.
              if (cities.some((c) => c.he === e.target.value || c.en === e.target.value)) onChange({ city: e.target.value, lat: null, lon: null });
            }}
            onBlur={commitCity}
            onKeyDown={(e) => e.key === "Enter" && commitCity()}
          />
          <datalist id="f-city-list">
            {cities.map((c) => (
              <option key={c.id} value={c.he}>
                {c.en}
              </option>
            ))}
          </datalist>
        </div>
        <div className="row">
          <button type="button" className="btn btn--small" onClick={locate} disabled={locating} aria-pressed={usingGeo}>
            {locating ? t.locating : usingGeo ? t.myLocationActive : t.myLocation}
          </button>
          {(params.city || usingGeo) && (
            <button type="button" className="btn btn--small btn--quiet" onClick={() => onChange({ city: "", lat: null, lon: null })}>
              {t.clearLocation}
            </button>
          )}
        </div>
        <div className="field">
          <label htmlFor="f-radius">{t.radius}</label>
          <select id="f-radius" value={params.radiusKm ?? ""} onChange={(e) => onChange({ radiusKm: e.target.value ? Number(e.target.value) : null })}>
            {RADII.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="group">
        <legend>{t.price}</legend>
        <div className="row row--fields">
          <NumberField id="f-min" label={t.minPrice} value={params.minPrice} onCommit={(v) => onChange({ minPrice: v })} />
          <NumberField id="f-max" label={t.maxPrice} value={params.maxPrice} onCommit={(v) => onChange({ maxPrice: v })} />
        </div>
      </fieldset>

      <fieldset className="group">
        <legend>{t.size}</legend>
        <div className="chips">
          {SIZES.map((s) => (
            <label key={s} className="chip">
              <input type="checkbox" checked={params.sizes.includes(s)} onChange={() => onChange({ sizes: toggle(params.sizes, s) })} />
              <span>{t.sizes[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="group">
        <legend>{t.sellerType}</legend>
        <div className="chips">
          {SELLERS.map((s) => (
            <label key={s} className="chip">
              <input type="checkbox" checked={params.sellerTypes.includes(s)} onChange={() => onChange({ sellerTypes: toggle(params.sellerTypes, s) })} />
              <span>{t.sellerTypes[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="group">
        <legend className="sr-only">{t.filters}</legend>
        <label className="check">
          <input type="checkbox" checked={params.inStockOnly} onChange={(e) => onChange({ inStockOnly: e.target.checked })} />
          {t.inStockOnly}
        </label>
        <label className="check">
          <input type="checkbox" checked={params.includeRelated} onChange={(e) => onChange({ includeRelated: e.target.checked })} />
          {t.includeRelated}
        </label>
      </fieldset>

      <div className="field">
        <label htmlFor="f-sort">{t.sort}</label>
        <select id="f-sort" value={params.sort} onChange={(e) => onChange({ sort: e.target.value as SortKey })}>
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t.sorts[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
