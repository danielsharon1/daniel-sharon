# Architecture proposal

apps/web (Next.js) and apps/extension (Chrome MV3) -> services/api (typed REST) -> source adapter interface -> normalized listing schema -> search/filter/ranking -> optional Postgres and cache. Server-side photo identification provider and opt-in geocoding. Do not embed service keys in extension or client. Prefer user-initiated refresh plus sensible caching to minimize load.
