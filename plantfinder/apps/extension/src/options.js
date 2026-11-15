import { el, getApiBase, getPassphrase, normalizeBase, uiLang } from "./common.js";
import { STRINGS, applyStrings } from "./strings.js";

const lang = uiLang();
const t = STRINGS[lang];
applyStrings(t, lang);
const input = document.getElementById("apiBase");
input.value = await getApiBase();
const pass = document.getElementById("passphrase");
pass.value = (await getPassphrase()) ?? "";
document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const base = normalizeBase(input.value);
  const status = document.getElementById("status");
  if (!base) return status.replaceChildren(el("p", { class: "notice error" }, t.invalidUrl));
  await chrome.storage.sync.set({ apiBase: base });
  // The passphrase never syncs across devices: local storage only.
  await chrome.storage.local.set({ passphrase: pass.value });
  input.value = base;
  status.replaceChildren(el("p", { class: "notice" }, t.saved));
});
