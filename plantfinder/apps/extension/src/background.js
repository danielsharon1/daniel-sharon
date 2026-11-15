import { apiGet, webSearchUrl, uiLang } from "./common.js";

export const MENU_IDS = ["pf-image", "pf-selection", "pf-page"];

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "pf-image", title: chrome.i18n.getMessage("menuImage"), contexts: ["image"] });
    chrome.contextMenus.create({ id: "pf-selection", title: chrome.i18n.getMessage("menuSelection"), contexts: ["selection"] });
    chrome.contextMenus.create({ id: "pf-page", title: chrome.i18n.getMessage("menuPage"), contexts: ["page"] });
  });
}

chrome.runtime.onInstalled.addListener(createMenus);
chrome.runtime.onStartup.addListener(createMenus);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const lang = uiLang();
  if (info.menuItemId === "pf-image" && info.srcUrl) {
    // Only http(s) images can be identified server-side; data:/blob: images stay in the page.
    const isRemote = /^https?:\/\//i.test(info.srcUrl);
    const page = chrome.runtime.getURL(`identify.html?${new URLSearchParams(isRemote ? { imageUrl: info.srcUrl } : { unsupported: "1" })}`);
    await chrome.tabs.create({ url: page, index: tab ? tab.index + 1 : undefined });
    return;
  }
  if (info.menuItemId === "pf-selection" && info.selectionText) {
    const q = info.selectionText.trim().slice(0, 80);
    await chrome.tabs.create({ url: await webSearchUrl({ q, lang }), index: tab ? tab.index + 1 : undefined });
    return;
  }
  if (info.menuItemId === "pf-page" && tab) {
    // activeTab (granted by the context-menu click) gives us the title; no page content is read.
    const title = (tab.title || "").slice(0, 300);
    let q = title.slice(0, 80);
    try {
      const resolved = await apiGet(`/api/resolve?q=${encodeURIComponent(title)}`);
      if (resolved.taxon) q = lang === "he" ? resolved.taxon.he : resolved.taxon.en;
    } catch {
      // API unreachable: fall back to the raw title so the user can edit it in the app
    }
    await chrome.tabs.create({ url: await webSearchUrl({ q, lang }), index: tab.index + 1 });
  }
});
