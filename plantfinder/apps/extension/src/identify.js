import { apiPost, el, uiLang, webSearchUrl } from "./common.js";
import { STRINGS, applyStrings } from "./strings.js";

const lang = uiLang();
const t = STRINGS[lang];
applyStrings(t, lang);
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const imageUrl = params.get("imageUrl");

function note(text, kind = "") {
  $("status").replaceChildren(el("p", { class: `notice ${kind}` }, text));
}
function showFallback() {
  $("fallback").hidden = false;
  $("q").focus();
}
$("fallback").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("q").value.trim();
  if (q) location.href = await webSearchUrl({ q, lang });
});

if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
  note(t.unsupported, "error");
  showFallback();
} else {
  $("preview").src = imageUrl;
  $("preview").hidden = false;
  note(t.identifying);
  try {
    const r = await apiPost("/api/identify", { imageUrl });
    if (!r.candidates.length) {
      note(t.noMatch);
      showFallback();
    } else {
      note(r.note === "low_confidence" ? t.lowConfidence : "");
      if (r.note !== "low_confidence") $("status").replaceChildren();
      for (const c of r.candidates) {
        const pct = Math.round(c.score * 100);
        const name = c.he ?? c.commonNames[0] ?? c.scientificName;
        $("candidates").append(
          el(
            "li",
            {},
            el(
              "div",
              {},
              el("strong", {}, el("bdi", {}, name)),
              " ",
              el("i", { lang: "la", dir: "ltr" }, c.scientificName),
              el("div", { class: "meter", role: "img", "aria-label": t.confidence(pct) }, el("span", { style: `inline-size:${pct}%` })),
              el("span", { class: "muted small" }, t.confidence(pct))
            ),
            el(
              "button",
              {
                class: "primary",
                onclick: async () => {
                  location.href = await webSearchUrl({ q: c.he ?? c.scientificName, lang });
                }
              },
              t.confirm
            )
          )
        );
      }
      $("candidates").append(el("li", { class: "muted small" }, "Pl@ntNet"));
    }
  } catch (e) {
    note(e.code === "identify_unavailable" ? t.identifyUnavailable : e.status ? t.imageError : t.unreachable, e.code === "identify_unavailable" ? "" : "error");
    showFallback();
  }
}
