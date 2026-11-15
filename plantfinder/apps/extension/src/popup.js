import { el, formatPrice, resolveTitle, safeHref, searchPlants, uiLang, webSearchUrl } from "./common.js";
import { STRINGS, applyStrings } from "./strings.js";

const lang = uiLang();
const t = STRINGS[lang];
applyStrings(t, lang);

const $ = (id) => document.getElementById(id);
const status = $("status");
const results = $("results");
const openAll = $("openAll");
let lastParams = null;

const saved = await chrome.storage.local.get({ lastCity: "", lastMax: "", lastRadius: "25" });
$("city").value = saved.lastCity;
$("max").value = saved.lastMax;
$("radius").value = saved.lastRadius;
$("q").focus();

function setStatus(text, kind = "") {
  status.replaceChildren(text ? el("p", { class: `notice ${kind}` }, text) : "");
}

async function search(q) {
  const city = $("city").value.trim();
  const max = $("max").value.trim();
  const radius = $("radius").value;
  await chrome.storage.local.set({ lastCity: city, lastMax: max, lastRadius: radius });
  const params = { q, lang, ...(city ? { city, radiusKm: radius } : {}), ...(max ? { maxPrice: max } : {}) };
  lastParams = params;
  setStatus(t.searching);
  results.replaceChildren();
  openAll.hidden = true;
  try {
    const r = await searchPlants(params);
    const shown = r.items.filter((i) => i.bucket !== "related_species").slice(0, 6);
    const matches = r.items.filter((i) => i.bucket === "match").length;
    setStatus([r.dataMode === "fixture" ? `${t.demo} ` : "", matches ? t.matches(matches) : t.noMatches].join(""));
    if (r.snapshotGeneratedAt) results.before(el("p", { class: "muted small" }, t.snapshotAt(new Date(r.snapshotGeneratedAt).toLocaleString(lang === "he" ? "he-IL" : "en-GB"))));
    for (const i of shown) {
      const href = safeHref(i.url);
      const where = i.distanceKm !== null ? t.km(i.distanceKm) : i.seller.location ? "" : t.unknownLoc;
      results.append(
        el(
          "li",
          {},
          el("a", { href: href ?? "#", target: "_blank", rel: "noopener" }, el("bdi", {}, i.title)),
          el("span", { class: "price" }, i.price.amount === null ? "—" : `${i.price.kind === "from" ? t.from : ""}${formatPrice(i.price.amount, lang)}`),
          el("span", { class: "bucket" }, [i.seller.name[lang], where].filter(Boolean).join(", "))
        )
      );
    }
    openAll.hidden = false;
  } catch (e) {
    setStatus(t[e.code] ?? t.unreachable, "error");
  }
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("q").value.trim();
  if (q) void search(q);
});

$("usePage").addEventListener("click", async () => {
  // activeTab: the popup was opened by the user on this tab, so its title is available.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const resolved = resolveTitle(tab?.title || "");
  if (!resolved.taxon) return setStatus(t.noTitle);
  $("q").value = lang === "he" ? resolved.taxon.he : resolved.taxon.en;
  void search($("q").value);
});

openAll.addEventListener("click", async () => {
  if (lastParams) await chrome.tabs.create({ url: await webSearchUrl(lastParams) });
});
$("options").addEventListener("click", () => chrome.runtime.openOptionsPage());
