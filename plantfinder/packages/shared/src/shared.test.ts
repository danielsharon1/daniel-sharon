import { describe, expect, it } from "vitest";
import {
  classifyText,
  decodeEntities,
  detectProductKind,
  evaluateListings,
  haversineKm,
  normalizeForMatch,
  parseSize,
  resolveQuery,
  suggestTaxa,
  taxonByScientificName,
  TAXA,
  type Listing,
  type SearchRequest,
  type SellerLocation
} from "./index.js";
import { findLocality, suggestLocalities } from "./gazetteer.js";

describe("text normalization", () => {
  it("decodes WordPress entities", () => {
    expect(decodeEntities("מונסטרה מינימה &#8211; רפידופורה")).toBe("מונסטרה מינימה – רפידופורה");
    expect(decodeEntities("כד פיבר בצבע בז&#8217;")).toBe("כד פיבר בצבע בז’");
    expect(decodeEntities("a &amp; b &unknown;")).toBe("a & b &unknown;");
  });
  it("normalizes quotes, finals and punctuation for matching", () => {
    expect(normalizeForMatch("פוטוס מנג׳ולה")).toBe(normalizeForMatch("פוטוס מנג'ולה"));
    expect(normalizeForMatch("Monstera 'Thai'")).toBe("monstera thai");
    expect(normalizeForMatch("גן")).toBe("גנ");
  });
});

describe("taxonomy", () => {
  it("has no ambiguous names (index builds) and unique ids", () => {
    const ids = TAXA.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  const cases: [string, string | null, string?][] = [
    ["מונסטרה", "monstera-deliciosa", "genus-default"],
    ["מונסטרה נאה", "monstera-deliciosa", "genus-default"],
    ["Monstera deliciosa", "monstera-deliciosa", "species"],
    ["מונסטרה דליסיוסה", "monstera-deliciosa", "species"],
    ["מונסטרה מאנקי", "monstera-adansonii", "species"],
    ["מונסטרה מאנקי מאסק", "monstera-adansonii", "species"],
    ["מונסטרה מאנקי מגוונת", "monstera-adansonii", "species"],
    ["מונסטרה מינימה &#8211; רפידופורה טטרספרמה", "rhaphidophora-tetrasperma", "species"],
    ["מונסטרה סטנדליאנה &#8211; פילודנדרון קוברה", "monstera-standleyana", "species"],
    ["מונסטרה מגוונת אלבו תאי קטנסטליישן", "monstera-deliciosa", "cultivar"],
    ["Monstera Thai Constellation", "monstera-deliciosa", "cultivar"],
    ["המונסטרה של סבתא", "monstera-deliciosa", "genus-default"],
    ["מונסטרה פרו", "monstera-karstenianum", "species"],
    ["דרצנה טורנדו למון ליים", "dracaena-fragrans", "cultivar"],
    ["פוטוס מנג'ולה", "epipremnum-aureum", "cultivar"],
    ["פוטוס כסוף", "scindapsus-pictus", "species"],
    ["סנציו כדורי", "curio-rowleyanus", "species"],
    ["פלפלון סיני (Zanthoxylum)", "zanthoxylum", "genus"],
    ["פיקוס כינורי במבינו", "ficus-lyrata", "cultivar"],
    ["פיקוס", "ficus", "genus"],
    ["סנסוויריה לורנטי", "dracaena-trifasciata", "cultivar"],
    ["כד מרובע גלים | פלסטיק | 39x42", null],
    ["מונסטרה b.m.f", "monstera-sp", "genus"], // rare collector plant: never presented as M. deliciosa
    ["מונסטרה פרוזן פרקלס | בייבי", "monstera-sp", "genus"],
    ["מונסטרה נאה | גודל: S", "monstera-deliciosa", "genus-default"],
    ["מונסטרה קוטר 18", "monstera-deliciosa", "genus-default"],
    ["מונסטרה תאי קון | בייבי | מבצע", "monstera-deliciosa", "cultivar"],
    ["מונסטרה אדנסוני מינט", "monstera-adansonii", "species"],
    ["מונסטרה מינט | בינוני", "monstera-deliciosa", "cultivar"],
    ["מונסטרה סילטה פיקנה אוריאה", "monstera-siltepecana", "species"],
    ["Thai basil", "ocimum-basilicum", "species"] // "thai" alone must not trigger Monstera 'Thai Constellation'
  ];
  it.each(cases)("classifies %s", (title, id, level) => {
    const c = classifyText(title);
    expect(c.taxonId).toBe(id);
    if (level) expect(c.level).toBe(level);
  });

  it("resolves Monstera / מונסטרה / Monstera deliciosa to the same target and source terms", () => {
    const queries = ["Monstera", "מונסטרה", "Monstera deliciosa", "monstera deliciosa", "מונסטרה דליסיוזה"];
    const resolved = queries.map((q) => resolveQuery(q));
    for (const r of resolved) {
      expect(r.target?.id).toBe("monstera-deliciosa");
      expect(r.resolved.sourceTerms).toEqual(["מונסטרה", "monstera"]);
    }
  });

  it("suggests taxa by prefix in Hebrew and English", () => {
    expect(suggestTaxa("מונס").map((s) => s.id)).toContain("monstera-deliciosa");
    expect(suggestTaxa("fiddle").map((s) => s.id)).toContain("ficus-lyrata");
  });

  it("maps scientific names from photo identification only when the genus agrees", () => {
    expect(taxonByScientificName("Monstera deliciosa Liebm.")?.id).toBe("monstera-deliciosa");
    expect(taxonByScientificName("Epipremnum aureum (Linden & André) G.S.Bunting")?.id).toBe("epipremnum-aureum");
    expect(taxonByScientificName("Unknownus plantus")).toBeUndefined();
  });
});

describe("product kind", () => {
  it("detects pots and supports even when a plant is named", () => {
    expect(detectProductKind("עמוד טיפוס למונסטרה", [], classifyText("עמוד טיפוס למונסטרה"))).toBe("accessory");
    expect(detectProductKind("כד מרובע גלים | פלסטיק", ["עציצים ואדניות > כדים דקורטיביים"], classifyText("כד"))).toBe("accessory");
  });
  it("detects empty pots and potting mixes (holdout #2 findings)", () => {
    for (const t of ["עציץ זכוכית לסחלב", "תערובת שתילה לסוקולנטים וקקטוסים | 10 ליטר", "עציץ פלסטיק 30"])
      expect(detectProductKind(t, [], classifyText(t)), t).toBe("accessory");
    for (const t of ["תערובת סחלבים", "עציץ מונסטרה", "עציץ פוטוס תלוי"]) expect(detectProductKind(t, [], classifyText(t)), t).toBe("plant");
  });
  it("keeps plant arrangements and plants", () => {
    expect(detectProductKind("קערת סוקולנטים XL", [], classifyText("קערת סוקולנטים"))).toBe("plant");
    expect(detectProductKind("מונסטרה", ["כל הצמחים"], classifyText("מונסטרה"))).toBe("plant");
  });
});

describe("size parsing", () => {
  it.each([
    ["מונסטרה קוטר 18", { potDiameterCm: 18 }],
    ['מונסטרה בגובה 65-75 ס"מ כולל הכלי', { heightCm: { min: 65, max: 75 } }],
    ["קמליה יפנית מיקס צבעים 50 ליטר", { potVolumeL: 50 }],
    ["גודל: XL, כלי: טרקוטה קלאסי", { sizeClass: "XL" }],
    ["pa_גודל: עציץ-קוטר-10", { potDiameterCm: 10 }],
    ["מונסטרה ויאטיוסה | בייבי | מבצע", { sizeClass: "XS" }],
    ["פוטוס מנג'ולה עציץ 12", { potDiameterCm: 12 }],
    ["גודל: small", { sizeClass: "S" }],
    ["pa_גודל: דלי-7-ליטר-עודפים", { potVolumeL: 7 }],
    ["XL", { sizeClass: "XL" }]
  ])("parses %s", (text, expected) => {
    expect(parseSize(text)).toMatchObject(expected);
  });
  it("returns nulls when nothing is stated", () => {
    const s = parseSize("מונסטרה");
    expect(s.sizeClass ?? s.potDiameterCm ?? s.heightCm ?? s.potVolumeL).toBeNull();
  });
});

describe("gazetteer", () => {
  it("finds Netanya by Hebrew and English names", () => {
    const he = findLocality("נתניה");
    expect(he?.en).toBe("Netanya");
    expect(findLocality("netanya")?.id).toBe(he?.id);
    expect(findLocality("Ra'anana")?.he).toBe("רעננה");
  });
  it("suggests localities by prefix", () => {
    expect(suggestLocalities("נתנ")[0]?.he).toBe("נתניה");
  });
  it("computes plausible distances", () => {
    const netanya = findLocality("נתניה")!;
    const givatHen = findLocality("גבעת חן")!;
    const d = haversineKm(netanya, givatHen);
    expect(d).toBeGreaterThan(17);
    expect(d).toBeLessThan(20);
  });
});

function listing(partial: Partial<Listing> & { title: string }): Listing {
  const classification = classifyText(partial.title);
  return {
    id: partial.title,
    sourceId: "test",
    url: `https://example.test/${encodeURIComponent(partial.title)}`,
    imageUrl: null,
    variant: null,
    price: { amount: 100, currency: "ILS", kind: "fixed", regularAmount: null, onSale: false },
    availability: "in_stock",
    size: parseSize(partial.title),
    classification,
    productKind: "plant",
    seller: {
      name: { he: "בדיקה", en: "Test" },
      type: "nursery",
      location: null,
      pickup: "unknown",
      delivery: null
    },
    provenance: { method: "fixture", endpoint: "test", retrievedAt: new Date().toISOString(), demo: true },
    categories: [],
    flags: [],
    ...partial
  };
}

const NETANYA = { lat: 32.33294, lon: 34.85917, label: "נתניה" };
const near = { lat: 32.1631, lon: 34.8742, label: { he: "גבעת חן", en: "Giv'at Hen" }, precision: "address" as const, evidence: "test" };
const far = { lat: 31.78857, lon: 34.7918, label: { he: "גני טל", en: "Ganey Tal" }, precision: "locality" as const, evidence: "test" };

function request(partial: Partial<SearchRequest> = {}): SearchRequest {
  return {
    q: "Monstera",
    location: NETANYA,
    radiusKm: 25,
    maxPrice: 150,
    minPrice: null,
    inStockOnly: true,
    includeRelated: true,
    sizes: [],
    sellerTypes: [],
    sort: "price",
    lang: "he",
    ...partial
  };
}

describe("strict evaluation (Netanya / 25 km / 150 ILS)", () => {
  const target = resolveQuery("Monstera").target;
  const seller = (location: SellerLocation | null) => ({
    name: { he: "x", en: "x" },
    type: "nursery" as const,
    location,
    pickup: "yes" as const,
    delivery: null
  });

  it("never counts unknown or out-of-range locations as confirmed matches", () => {
    const items = [
      listing({ title: "מונסטרה", seller: seller(near) }),
      listing({ title: "מונסטרה נאה", seller: seller(null), url: "https://example.test/unknown" }),
      listing({ title: "מונסטרה דליסיוזה", seller: seller(far), url: "https://example.test/far" })
    ];
    const r = evaluateListings(items, request(), target);
    expect(r.counts).toMatchObject({ match: 1, location_unknown: 1, outside_radius: 1 });
    const match = r.items.find((i) => i.bucket === "match")!;
    expect(match.distanceKm).toBeGreaterThan(17);
    expect(match.distanceKm).toBeLessThan(20);
    expect(r.items.find((i) => i.seller.location === null)?.bucket).toBe("location_unknown");
    expect(r.items.find((i) => i.seller.location === far)?.bucket).toBe("outside_radius");
  });

  it("hides over-budget, out-of-stock, price-unknown and accessories with counts", () => {
    const items = [
      listing({ title: "מונסטרה", seller: seller(near), price: { amount: 170, currency: "ILS", kind: "fixed", regularAmount: null, onSale: false } }),
      listing({ title: "מונסטרה", seller: seller(near), url: "https://example.test/oos", availability: "out_of_stock" }),
      listing({ title: "מונסטרה", seller: seller(near), url: "https://example.test/np", price: { amount: null, currency: "ILS", kind: "unknown", regularAmount: null, onSale: false } }),
      listing({ title: "עמוד טיפוס למונסטרה", seller: seller(near), url: "https://example.test/acc", productKind: "accessory" })
    ];
    const r = evaluateListings(items, request(), target);
    expect(r.items).toHaveLength(0);
    expect(r.hidden).toMatchObject({ overBudget: 1, outOfStock: 1, priceUnknown: 1, accessories: 1 });
  });

  it("separates different species into related_species and drops duplicates", () => {
    const a = listing({ title: "מונסטרה מאנקי", seller: seller(near) });
    const r = evaluateListings([a, a, listing({ title: "פוטוס", seller: seller(near), url: "https://example.test/p" })], request(), target);
    expect(r.counts.related_species).toBe(1);
    expect(r.hidden.duplicates).toBe(1);
    expect(r.hidden.unrelated).toBe(1);
  });

  it("matches text queries for plants outside the taxonomy", () => {
    const r = evaluateListings(
      [listing({ title: "עץ הג׳ירף בונסאי", seller: seller(near) }), listing({ title: "מונסטרה", seller: seller(near), url: "https://example.test/m" })],
      request({ q: "עץ הג'ירף", maxPrice: null }),
      null
    );
    expect(r.items.map((i) => i.title)).toEqual(["עץ הג׳ירף בונסאי"]);
    expect(r.items[0]!.classification.level).toBe("none");
  });
});
