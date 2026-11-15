// Shared helpers for the extension pages and the service worker. No secrets live here:
// the extension only talks to the PlantFinder API, which holds any provider keys server-side.

export const DEFAULT_API = "http://localhost:8787";

export async function getApiBase() {
  const { apiBase } = await chrome.storage.sync.get({ apiBase: DEFAULT_API });
  return normalizeBase(apiBase) ?? DEFAULT_API;
}

/** Accept only http(s) origins; strip paths so we never build URLs from arbitrary input. */
export function normalizeBase(value) {
  try {
    const u = new URL(String(value).trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export async function apiGet(path) {
  const base = await getApiBase();
  const res = await fetch(base + path, { credentials: "omit" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || "request_failed"), { code: body.error || "request_failed", status: res.status });
  return body;
}

export async function apiPost(path, payload) {
  const base = await getApiBase();
  const res = await fetch(base + path, {
    method: "POST",
    credentials: "omit",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || "request_failed"), { code: body.error || "request_failed", status: res.status });
  return body;
}

/** URL of the web app search page (served by the same API host). */
export async function webSearchUrl(params) {
  const base = await getApiBase();
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  return `${base}/?${q.toString()}`;
}

export function uiLang() {
  return (chrome.i18n?.getUILanguage?.() || navigator.language || "he").toLowerCase().startsWith("he") ? "he" : "en";
}

export function formatPrice(amount, lang) {
  return new Intl.NumberFormat(lang === "he" ? "he-IL" : "en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/** Build DOM safely (text only, never innerHTML with remote data). */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c instanceof Node ? c : String(c));
  return node;
}

/** Only ever link to https listing URLs returned by the API. */
export function safeHref(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
