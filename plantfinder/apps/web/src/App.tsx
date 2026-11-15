import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bucket, ResultItem, SearchResponse, SourcePublicInfo } from "@plantfinder/shared";
import { DICTS, type Lang } from "./i18n";
import { api, ApiError, DEFAULT_PARAMS, fromUrl, IS_STATIC, loadSaved, storeSaved, toQuery, type SavedSearch, type SearchParams } from "./api";
import { forgetPassphrase, loadMeta, storedPassphrase, unlock } from "./static-client";
import { formatDateTime } from "./format";
import { Unlock } from "./components/Unlock";
import { formatDate, formatPrice } from "./format";
import { ListingLabel } from "./components/ListingLabel";
import { DistanceRuler } from "./components/DistanceRuler";
import { Filters } from "./components/Filters";
import { PhotoSearch } from "./components/PhotoSearch";
import { SourcesPanel } from "./components/SourcesPanel";

const BUCKETS: Bucket[] = ["match", "location_unknown", "outside_radius", "related_species"];
const EXAMPLES = ["מונסטרה", "פוטוס מנג'ולה", "Ficus lyrata", "סנסוויריה", "זמיוקולקס"];

function initialLang(urlLang: Lang | null): Lang {
  if (urlLang) return urlLang;
  try {
    const stored = localStorage.getItem("plantfinder.lang");
    if (stored === "en" || stored === "he") return stored;
  } catch {
    /* ignore */
  }
  return "he";
}

export function App() {
  const initial = useMemo(() => fromUrl(window.location.search), []);
  const [lang, setLang] = useState<Lang>(() => initialLang(initial.lang));
  const t = DICTS[lang];
  const [params, setParams] = useState<SearchParams>(() => ({ ...DEFAULT_PARAMS, ...initial }));
  const [draft, setDraft] = useState(initial.q);
  const [plantSuggestions, setPlantSuggestions] = useState<{ id: string; he: string; en: string; scientificName: string }[]>([]);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<SourcePublicInfo[]>([]);
  const [meta, setMeta] = useState<{ dataMode: "live" | "fixture" | "snapshot"; sourcePolicy: string; identifyAvailable: boolean } | null>(null);
  // Static (GitHub Pages) build: the encrypted snapshot must be unlocked before anything else runs.
  const [ready, setReady] = useState(!IS_STATIC);
  const [lockState, setLockState] = useState<{ encrypted: boolean; busy: boolean; error: string | null }>({ encrypted: false, busy: IS_STATIC, error: null });
  const [identifyUrl] = useState(() => new URLSearchParams(window.location.search).get("identifyUrl"));
  const [showSources, setShowSources] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const [saved, setSaved] = useState<SavedSearch[]>(() => loadSaved());
  const [justSaved, setJustSaved] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(() => window.matchMedia?.("(min-width: 960px)").matches ?? true);
  const abort = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = t.dir;
    document.title = lang === "he" ? "PlantFinder — השוואת מחירי צמחים" : "PlantFinder — plant price comparison";
    try {
      localStorage.setItem("plantfinder.lang", lang);
    } catch {
      /* ignore */
    }
  }, [lang, t.dir]);

  const tryUnlock = useCallback(async (passphrase: string | null, remember: boolean) => {
    setLockState((s) => ({ ...s, busy: true, error: null }));
    try {
      await unlock(passphrase, remember);
      setReady(true);
      setLockState((s) => ({ ...s, busy: false }));
    } catch (e) {
      setLockState((s) => ({ ...s, busy: false, error: e instanceof ApiError ? e.code : "snapshot_unavailable" }));
    }
  }, []);

  useEffect(() => {
    if (!IS_STATIC) return;
    loadMeta()
      .then((m) => {
        setLockState((s) => ({ ...s, encrypted: !!m.encryption }));
        const stored = storedPassphrase();
        if (!m.encryption || stored) void tryUnlock(m.encryption ? stored : null, true);
        else setLockState((s) => ({ ...s, busy: false }));
      })
      .catch(() => setLockState((s) => ({ ...s, busy: false, error: "snapshot_unavailable" })));
  }, [tryUnlock]);

  useEffect(() => {
    if (!ready) return;
    api.health().then(setMeta).catch(() => setMeta(null));
    api.sources().then((r) => setSources(r.sources)).catch(() => undefined);
    if (identifyUrl) setShowPhoto(true);
  }, [ready, identifyUrl]);

  // Plant name suggestions for the search box.
  useEffect(() => {
    if (draft.trim().length < 2) return setPlantSuggestions([]);
    const c = new AbortController();
    const timer = setTimeout(() => api.suggest(draft, c.signal).then((r) => setPlantSuggestions(r.taxa)).catch(() => undefined), 150);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [draft]);

  const run = useCallback(
    async (p: SearchParams) => {
      const url = new URL(window.location.href);
      url.search = p.q.trim() ? toQuery(p, lang).toString() : "";
      try {
        window.history.replaceState(null, "", url); // shareable URL; some embedded viewers forbid it
      } catch {
        /* ignore: search still runs */
      }
      if (!p.q.trim()) {
        setResult(null);
        return;
      }
      abort.current?.abort();
      const c = new AbortController();
      abort.current = c;
      setLoading(true);
      setError(null);
      try {
        const r = await api.search(p, lang, c.signal);
        if (!c.signal.aborted) setResult(r);
      } catch (e) {
        if (c.signal.aborted) return;
        setError(e instanceof ApiError ? e.code : "internal_error");
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    },
    [lang]
  );

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => void run(params), 120);
    return () => clearTimeout(timer);
  }, [params, run, ready]);

  const update = (patch: Partial<SearchParams>) => setParams((p) => ({ ...p, ...patch }));
  const submit = (q: string) => {
    setDraft(q);
    update({ q });
    resultsRef.current?.focus({ preventScroll: true });
  };

  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name[lang] ?? id;
  const groups = useMemo(() => {
    const g: Record<Bucket, ResultItem[]> = { match: [], location_unknown: [], outside_radius: [], related_species: [] };
    for (const i of result?.items ?? []) g[i.bucket].push(i);
    return g;
  }, [result]);

  const hasLocation = !!result?.request.location;
  const radius = result?.request.radiusKm ?? null;
  const nearestOutside = groups.outside_radius.reduce<number | null>((m, i) => (i.distanceKm !== null && (m === null || i.distanceKm < m) ? i.distanceKm : m), null);
  const failedSources = result?.sources.filter((s) => s.status === "error" || s.status === "blocked") ?? [];
  const snapshotDate = result?.items.reduce<string | null>((m, i) => (!m || i.provenance.retrievedAt < m ? i.provenance.retrievedAt : m), null);
  const hiddenEntries = result ? (Object.entries(result.hidden) as [keyof SearchResponse["hidden"], number][]).filter(([, n]) => n > 0) : [];
  const activeFilterCount =
    (params.city || params.lat !== null ? 1 : 0) + (params.maxPrice !== null ? 1 : 0) + (params.minPrice !== null ? 1 : 0) + params.sizes.length + params.sellerTypes.length;

  const saveSearch = () => {
    const query = toQuery(params, lang).toString();
    const label = [params.q, params.city, params.maxPrice !== null ? `≤${params.maxPrice}₪` : ""].filter(Boolean).join(", ");
    const next = [{ id: crypto.randomUUID(), label, query, savedAt: new Date().toISOString() }, ...saved.filter((s) => s.query !== query)];
    setSaved(next);
    storeSaved(next);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  const openSaved = (s: SavedSearch) => {
    const p = fromUrl(`?${s.query}`);
    setDraft(p.q);
    setParams({ ...DEFAULT_PARAMS, ...p });
  };

  return (
    <div className="page">
      <a className="skip" href="#results">
        {t.skip}
      </a>
      <header className="masthead">
        <div className="brand">
          <svg className="brand__tag" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M6 3h20v18l-10 9-10-9z" />
            <circle cx="16" cy="9" r="2.5" />
          </svg>
          <span className="brand__name" lang="en" dir="ltr">
            PlantFinder
          </span>
        </div>
        <nav className="masthead__nav">
          <button className="btn btn--quiet" onClick={() => setShowSources(true)}>
            {t.sources}
            {sources.length > 0 && <span className="count">{sources.filter((s) => s.enabled).length}</span>}
          </button>
          <button className="btn btn--quiet" onClick={() => setLang(lang === "he" ? "en" : "he")} lang={lang === "he" ? "en" : "he"}>
            {t.language}
          </button>
          {IS_STATIC && ready && lockState.encrypted && (
            <button
              className="btn btn--quiet"
              title={t.lockHint}
              onClick={() => {
                forgetPassphrase();
                window.location.reload();
              }}
            >
              {t.lock}
            </button>
          )}
        </nav>
      </header>

      {(meta?.dataMode === "fixture" || result?.dataMode === "fixture") && (
        <p className="banner banner--demo" role="note">
          {t.demoBanner(snapshotDate ? formatDate(snapshotDate, lang) : null)}
        </p>
      )}
      {meta?.sourcePolicy === "personal" && meta.dataMode === "live" && (
        <p className="banner" role="note">
          {t.pilotBanner}
        </p>
      )}
      {meta?.dataMode === "snapshot" && result?.snapshotGeneratedAt && (
        <p className="banner" role="note">
          {(import.meta.env.VITE_PF_PREVIEW === "1" ? t.previewBanner : t.snapshotBanner)(formatDateTime(result.snapshotGeneratedAt, lang))}
        </p>
      )}

      {!ready ? (
        <Unlock t={t} busy={lockState.busy} error={lockState.error} onUnlock={(p, r) => void tryUnlock(p, r)} />
      ) : (
        <>
      <section className="hero">
        <p className="hero__tagline">{t.tagline}</p>
        <form
          className="query"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
        >
          <label htmlFor="q" className="sr-only">
            {t.searchLabel}
          </label>
          <input
            id="q"
            className="query__input"
            type="search"
            list="q-list"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={80}
            placeholder={t.searchPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <datalist id="q-list">
            {plantSuggestions.map((s) => (
              <option key={s.id} value={lang === "he" ? s.he : s.en}>
                {s.scientificName}
              </option>
            ))}
          </datalist>
          <div className="query__actions">
            <button className="btn btn--primary" type="submit" disabled={!draft.trim()}>
              {loading ? t.searching : t.search}
            </button>
            <button className="btn" type="button" onClick={() => setShowPhoto(true)}>
              {t.photo}
            </button>
          </div>
        </form>
      </section>

      <div className="layout">
        <aside className="side">
          <details className="side__filters" open={filtersOpen} onToggle={(e) => setFiltersOpen((e.target as HTMLDetailsElement).open)}>
            <summary>
              {t.filters}
              {activeFilterCount > 0 && <span className="count">{activeFilterCount}</span>}
            </summary>
            <Filters params={params} t={t} onChange={update} onError={setError} />
          </details>

          <section className="saved" aria-labelledby="saved-title">
            <h2 id="saved-title">{t.savedSearches}</h2>
            {saved.length === 0 ? (
              <p className="muted small">{t.noSaved}</p>
            ) : (
              <ul>
                {saved.map((s) => (
                  <li key={s.id}>
                    <button className="link" dir="auto" onClick={() => openSaved(s)}>
                      {s.label}
                    </button>
                    <button
                      className="btn btn--quiet btn--small"
                      aria-label={`${t.remove}: ${s.label}`}
                      onClick={() => {
                        const next = saved.filter((x) => x.id !== s.id);
                        setSaved(next);
                        storeSaved(next);
                      }}
                    >
                      {t.remove}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <main id="results" className="results" ref={resultsRef} tabIndex={-1} aria-busy={loading}>
          {error && (
            <p className="notice notice--error" role="alert">
              {t.errors[error] ?? t.errors.internal_error}
            </p>
          )}

          {!result && !loading && (
            <div className="empty">
              <h1>{t.emptyQueryTitle}</h1>
              <p>{t.emptyQueryBody}</p>
              <p className="examples">
                <span className="muted">{t.examples}:</span>{" "}
                {EXAMPLES.map((ex) => (
                  <button key={ex} className="link" onClick={() => submit(ex)}>
                    {ex}
                  </button>
                ))}
              </p>
            </div>
          )}

          {result && (
            <>
              <div className="summary" aria-live="polite">
                <div className="summary__lead">
                  {result.query.taxon && (
                    <p className="summary__taxon">
                      {t.resolvedAs} <strong>{lang === "he" ? result.query.taxon.he : result.query.taxon.en}</strong>{" "}
                      {(lang === "he" ? result.query.taxon.he : result.query.taxon.en) !== result.query.taxon.scientificName && (
                        <i lang="la" dir="ltr">
                          {result.query.taxon.scientificName}
                        </i>
                      )}
                    </p>
                  )}
                  <h1 className="summary__count">
                    {groups.match.length > 0 ? t.summaryMatches(groups.match.length) : t.summaryNone}
                    {(hasLocation && radius !== null) || result.request.maxPrice !== null ? (
                      <span className="summary__scope">
                        {[
                          hasLocation && radius !== null ? t.within(radius, result.request.location!.label) : null,
                          result.request.maxPrice !== null ? t.upTo(formatPrice(result.request.maxPrice, lang)) : null
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    ) : null}
                  </h1>
                  {result.query.note === "genus_default" && result.query.taxon && <p className="muted">{t.genusDefaultNote(result.query.taxon.scientificName)}</p>}
                  {result.query.note === "not_in_taxonomy" && <p className="muted">{t.notInTaxonomy}</p>}
                </div>
                <button className="btn btn--small nowrap" onClick={saveSearch}>
                  {justSaved ? t.saved : t.save}
                </button>
              </div>

              {groups.match.length === 0 && nearestOutside !== null && radius !== null && (
                <p className="notice notice--info">
                  {t.nearestOutside(nearestOutside)}{" "}
                  <button className="link" onClick={() => update({ radiusKm: Math.ceil(nearestOutside / 5) * 5 })}>
                    {t.expandTo(Math.ceil(nearestOutside / 5) * 5)}
                  </button>
                </p>
              )}

              {hasLocation && radius !== null && <DistanceRuler items={result.items} radiusKm={radius} t={t} lang={lang} />}

              {hiddenEntries.length > 0 && (
                <p className="hidden-counts">
                  <span className="muted">{t.hiddenTitle}:</span>{" "}
                  {hiddenEntries.map(([k, n], i) => (
                    <span key={k}>
                      {i > 0 && ", "}
                      {n} {t.hidden[k]}
                    </span>
                  ))}
                  {result.hidden.outOfStock > 0 && (
                    <>
                      {" "}
                      <button className="link" onClick={() => update({ inStockOnly: false })}>
                        {t.showOutOfStock}
                      </button>
                    </>
                  )}
                </p>
              )}

              {failedSources.length > 0 && (
                <p className="notice notice--error">
                  {t.sourceErrors(failedSources.length)}: {failedSources.map((s) => sourceName(s.sourceId)).join(", ")}
                </p>
              )}

              {result.items.length === 0 && <p className="notice notice--info">{t.noResults}</p>}

              {BUCKETS.map((b) =>
                groups[b].length === 0 ? null : b === "related_species" ? (
                  <details key={b} className="bucket bucket--related">
                    <summary>
                      <h2>
                        {t.buckets[b]} <span className="count">{groups[b].length}</span>
                      </h2>
                    </summary>
                    <p className="muted">{t.bucketHelp[b]}</p>
                    <div className="labels">
                      {groups[b].map((i) => (
                        <ListingLabel key={i.id} item={i} t={t} lang={lang} sourceName={sourceName(i.sourceId)} />
                      ))}
                    </div>
                  </details>
                ) : (
                  <section key={b} className={`bucket bucket--${b}`} aria-labelledby={`b-${b}`}>
                    <h2 id={`b-${b}`}>
                      {t.buckets[b]} <span className="count">{groups[b].length}</span>
                    </h2>
                    {t.bucketHelp[b] && <p className="muted">{t.bucketHelp[b]}</p>}
                    <div className="labels">
                      {groups[b].map((i) => (
                        <ListingLabel key={i.id} item={i} t={t} lang={lang} sourceName={sourceName(i.sourceId)} />
                      ))}
                    </div>
                  </section>
                )
              )}
            </>
          )}
        </main>
      </div>
        </>
      )}

      <footer className="footer">
        <p>{t.footer}</p>
        <p className="muted small">{t.attribution}</p>
      </footer>

      <SourcesPanel open={showSources} sources={sources} runs={result?.sources ?? []} t={t} lang={lang} onClose={() => setShowSources(false)} />
      <PhotoSearch
        open={showPhoto}
        available={meta?.identifyAvailable ?? false}
        initialUrl={identifyUrl}
        t={t}
        onClose={() => setShowPhoto(false)}
        onPick={(q) => {
          setShowPhoto(false);
          submit(q);
        }}
      />
    </div>
  );
}
