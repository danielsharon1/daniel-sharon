import type { SellerInfo, SourceStatus } from "@plantfinder/shared";

/**
 * Source registry. Every field here is backed by evidence recorded in docs/source-audit.md.
 * status:
 *  - partner: written permission / feed agreement on file (none yet)
 *  - pilot:   public structured endpoint, robots.txt allows it, no anti-bot bypass; usable for a
 *             personal/private pilot only until permission is obtained (terms restrict reuse)
 *  - pending: technically possible but not implemented or needs review
 *  - rejected: blocked by anti-bot protection, robots.txt or terms — never accessed
 */
export type Platform = "woocommerce" | "shopify" | "wix" | "custom" | "facebook" | "yad2";

export interface SourceDef {
  id: string;
  name: { he: string; en: string };
  homepage: string;
  platform: Platform;
  status: SourceStatus;
  /** Base URL used by the adapter (no trailing slash). */
  apiBase?: string;
  seller: SellerInfo;
  /** Why a source is pending/rejected (shown in the coverage panel). */
  note?: string;
  audit: {
    robots: string;
    terms: string;
    permission: string;
    method: string;
    checkedAt: string;
  };
}

const CHECKED = "2026-11-14";

export const SOURCES: SourceDef[] = [
  {
    id: "hamashtela",
    name: { he: "המשתלה (בונסאי שופ) – גבעת חן", en: "HaMashtela (Bonsai Shop) – Giv'at Hen" },
    homepage: "https://hamashtela.co.il/",
    platform: "woocommerce",
    status: "pilot",
    apiBase: "https://hamashtela.co.il",
    seller: {
      name: { he: "המשתלה (בונסאי שופ)", en: "HaMashtela (Bonsai Shop)" },
      type: "nursery",
      location: {
        lat: 32.1630855,
        lon: 34.8742432,
        label: { he: "מושב גבעת חן (ליד רעננה)", en: "Moshav Giv'at Hen (near Ra'anana)" },
        precision: "address",
        evidence: "Google Maps embed on https://hamashtela.co.il/הוראות-הגעה/ (checked 2026-11-14)"
      },
      pickup: "by_appointment",
      delivery: {
        he: "משלוחים מנתניה עד אשקלון, מינימום הזמנה 150 ₪",
        en: "Delivery from Netanya to Ashkelon, minimum order ₪150",
        evidence: "https://hamashtela.co.il/shipping/ (page modified 2020-06-25)"
      }
    },
    audit: {
      robots: "Allows /wp-json/ (disallows only /wp-admin/, add-to-cart and WooCommerce upload dirs)",
      terms: "/terms reviewed: no clause on copying or automated access found",
      permission: "None on file — outreach required before public use",
      method: "WooCommerce Store API (public, unauthenticated): /wp-json/wc/store/v1/products?search=",
      checkedAt: CHECKED
    }
  },
  {
    id: "gankasumnh",
    name: { he: "משתלת הגן הקסום של נקודת חן", en: "HaGan HaKasum (Nekudat Hen) nursery" },
    homepage: "https://gankasumnh.co.il/",
    platform: "woocommerce",
    status: "pilot",
    apiBase: "https://gankasumnh.co.il",
    seller: {
      name: { he: "הגן הקסום של נקודת חן", en: "HaGan HaKasum (Nekudat Hen)" },
      type: "nursery",
      location: {
        lat: 32.06533,
        lon: 34.89027,
        label: { he: "צומת כפר מעש (ליד קריית אונו)", en: "Kfar Ma'as junction (near Kiryat Ono)" },
        precision: "locality",
        evidence: "Site 'About' page states the nursery is at Kfar Ma'as – Kiryat Ono junction; coordinates = GeoNames locality Ma'as (294401)"
      },
      pickup: "yes",
      delivery: {
        he: "משלוחים לגוש דן והמרכז (פ\"ת, בקעת אונו, ראש העין, ת\"א ועוד) לפי תקנון המשלוחים",
        en: "Delivery to Gush Dan / central Israel (Petah Tikva, Bik'at Ono, Rosh HaAyin, Tel Aviv…) per shipping terms",
        evidence: "https://gankasumnh.co.il/תקנון-משלוחים/ (modified 2025-04-22)"
      }
    },
    audit: {
      robots: "Allows /wp-json/ (Yoast default + WooCommerce dirs)",
      terms: "Only shipping terms published; no clause on copying or automated access found",
      permission: "None on file — outreach required before public use",
      method: "WooCommerce Store API (public, unauthenticated)",
      checkedAt: CHECKED
    }
  },
  {
    id: "mermel",
    name: { he: "משתלת מרמלשטיין – גני טל", en: "Mermelstein nursery – Ganei Tal" },
    homepage: "https://mermel-nursery.co.il/",
    platform: "woocommerce",
    status: "pilot",
    apiBase: "https://mermel-nursery.co.il",
    seller: {
      name: { he: "משתלת מרמלשטיין", en: "Mermelstein nursery" },
      type: "nursery",
      location: {
        lat: 31.78857,
        lon: 34.7918,
        label: { he: "גני טל (5 דק' מגדרה)", en: "Ganei Tal (5 min from Gedera)" },
        precision: "locality",
        evidence: "Terms list address 'הגפן 5 גני טל'; coordinates = GeoNames locality Ganey Tal (11979647)"
      },
      pickup: "yes",
      delivery: {
        he: "משלוחים לאזורים נבחרים (גדרה, רחובות, אשדוד, ראשל\"צ ועוד) לפי מדיניות המשלוחים",
        en: "Delivery to selected areas (Gedera, Rehovot, Ashdod, Rishon LeZion…) per shipping policy",
        evidence: "https://mermel-nursery.co.il/מדיניות-משלוחים-והחזרות/ (modified 2026-11-08)"
      }
    },
    audit: {
      robots: "Allow: / ; Content-Signal: search=yes, ai-input=yes, ai-train=no",
      terms: "Terms prohibit copying/republishing site content without permission (IP clause)",
      permission: "None on file — required before any public use",
      method: "WooCommerce Store API (public, unauthenticated)",
      checkedAt: CHECKED
    }
  },
  {
    id: "netaplants",
    name: { he: "נטע – צמחים לבית", en: "Neta plants" },
    homepage: "https://netaplants.co.il/",
    platform: "woocommerce",
    status: "pilot",
    apiBase: "https://netaplants.co.il",
    seller: {
      name: { he: "נטע (netaplants)", en: "Neta (netaplants)" },
      type: "online_store",
      location: null, // online store; no public pickup address published
      pickup: "no",
      delivery: {
        he: "משלוח עד הבית 30 ₪ (חינם מעל 290 ₪); ימי משלוח לפי יעד בקופה",
        en: "Home delivery ₪30 (free over ₪290); delivery days by destination at checkout",
        evidence: "https://netaplants.co.il/shipment/ (modified 2025-07-09)"
      }
    },
    audit: {
      robots: "Allows all incl. named AI agents; Content-Signal: search=yes, ai-input=yes, ai-train=no",
      terms: "Terms §7: site limited to personal use; no copying/public display or commercial use without prior written permission",
      permission: "None on file — required before any public use",
      method: "WooCommerce Store API (public, unauthenticated)",
      checkedAt: CHECKED
    }
  },
  {
    id: "rootine",
    name: { he: "רוטין", en: "Rootine" },
    homepage: "https://rootine.co.il/",
    platform: "shopify",
    status: "pilot",
    apiBase: "https://rootine.co.il",
    seller: {
      name: { he: "רוטין (Rootine)", en: "Rootine" },
      type: "online_store",
      location: {
        lat: 31.97102,
        lon: 34.78939,
        label: { he: "ראשון לציון (משרדים, איסוף בתיאום בלבד)", en: "Rishon LeZion (offices, pickup by arrangement only)" },
        precision: "locality",
        evidence: "Contact page: offices at שדה נחום 10 ראשון לציון, no walk-in; coordinates = GeoNames locality Rishon LeZion (293703)"
      },
      pickup: "by_appointment",
      delivery: {
        he: "משלוח עד הבית (לפי מדיניות המשלוחים באתר)",
        en: "Home delivery (per the store's shipping policy)",
        evidence: "https://rootine.co.il/pages/מדיניות-משלוחים"
      }
    },
    audit: {
      robots: "Shopify default: public products crawlable; agents.md asks agents to identify themselves (Web Bot Auth for server-to-server)",
      terms: "Terms §1.3/§14: no copying or use of site content without prior written permission",
      permission: "None on file — required before any public use; Web Bot Auth not yet implemented",
      method: "Shopify public catalog JSON: /products.json (cached 6h)",
      checkedAt: CHECKED
    }
  },
  {
    id: "grdntlv",
    name: { he: "GRDN גרדן תל אביב", en: "GRDN Garden Tel Aviv" },
    homepage: "https://grdntlv.co.il/",
    platform: "shopify",
    status: "pilot",
    apiBase: "https://grdntlv.co.il",
    seller: {
      name: { he: "GRDN", en: "GRDN" },
      type: "online_store",
      location: null, // no physical address published
      pickup: "unknown",
      delivery: {
        he: "משלוחים בגוש דן והשרון (רשימת יישובים באתר; נתניה אינה ברשימה)",
        en: "Delivery in Gush Dan and Sharon (city list on site; Netanya not listed)",
        evidence: "https://grdntlv.co.il/pages/איזורי-החלוקה-שלנו"
      }
    },
    audit: {
      robots: "Shopify default: public products crawlable; agents.md asks agents to identify themselves",
      terms: "Terms: personal use only; no copying/public display or commercial use without prior written permission",
      permission: "None on file — required before any public use",
      method: "Shopify public catalog JSON: /products.json (cached 6h)",
      checkedAt: CHECKED
    }
  },
  // ---- Not integrated (documented decisions) ------------------------------------------------------
  ...(
    [
      ["plantit", "PLANT IT", "https://www.plantit.co.il/", "custom", "Cloudflare bot challenge on every request — not bypassed"],
      ["azurflowers", "Azur Flowers", "https://azurflowers.co.il/", "custom", "Cloudflare bot challenge — not bypassed"],
      ["flowernet", "Flowernet", "https://www.flowernet.co.il/", "custom", "Cloudflare bot challenge — not bypassed"],
      ["gan-yarak", "גן ירק", "https://www.gan-yarak.co.il/", "woocommerce", "robots.txt disallows /wp- (incl. REST API) and search pages"],
      ["etshasadeh", "עץ השדה", "https://etshasadeh.co.il/", "woocommerce", "Connection reset during audit; delivers only to the north"],
      ["facebook", "Facebook Marketplace / groups", "https://www.facebook.com/marketplace/", "facebook", "No authorized API for Marketplace listings; terms prohibit automated collection"],
      ["yad2", "Yad2", "https://www.yad2.co.il/", "yad2", "Terms prohibit automated collection; bot protection; requires written permission/partnership"]
    ] as const
  ).map(
    ([id, name, homepage, platform, reason]): SourceDef => ({
      id,
      name: { he: name, en: name },
      homepage,
      platform,
      status: "rejected",
      seller: { name: { he: name, en: name }, type: platform === "yad2" || platform === "facebook" ? "classifieds" : "online_store", location: null, pickup: "unknown", delivery: null },
      audit: { robots: "—", terms: "—", permission: "Not authorized", method: "Not integrated", checkedAt: CHECKED },
      note: reason
    })
  ),
  ...(
    [
      ["hagananplants", "משתלת הגנן", "https://www.hagananplants.co.il/", "wix", "Wix store: no public catalog API; would need per-page structured-data crawl from sitemap — not implemented"],
      ["hadarnoy", "משתלת הדר נוי", "https://www.hadarnoy.co.il/", "custom", "Custom (Vercel) site, no structured endpoint identified yet"]
    ] as const
  ).map(
    ([id, name, homepage, platform, reason]): SourceDef => ({
      id,
      name: { he: name, en: name },
      homepage,
      platform,
      status: "pending",
      seller: { name: { he: name, en: name }, type: "nursery", location: null, pickup: "unknown", delivery: null },
      audit: { robots: "Allows crawling", terms: "Not yet reviewed in depth", permission: "None", method: "Not integrated", checkedAt: CHECKED },
      note: reason
    })
  )
];

export function getSource(id: string): SourceDef | undefined {
  return SOURCES.find((s) => s.id === id);
}
