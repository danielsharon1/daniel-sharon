import type { Classification, ProductKind } from "./types.js";
import { tokenize } from "./text.js";

/** Title head words that denote a non-plant product (pots, supports, soil, tools...). */
const ACCESSORY_HEADS = new Set(
  [
    "כד", "כדים", "אדנית", "אדניות", "מעמד", "מעמדים", "תחתית", "תחתיות", "עמוד", "עמודי", "מקל", "מקלות",
    "דשן", "דשנים", "אדמה", "מצע", "כלי", "כלים", "מתלה", "מגדל", "טפטפת", "מזלף", "משפך", "מספריים", "מזמרה",
    "כפפות", "גיפט", "כרטיס", "תרסיס", "ריסוס", "קוקוס", "פרלייט", "ורמיקוליט", "חצץ", "חלוקי", "אבני", "פסל",
    "מנורת", "נורת", "תאורת", "ערכת", "סט", "שובר", "מארז", "שלט", "צינור", "ממטרה", "טיימר", "מחשב",
    "pot", "pots", "planter", "stand", "soil", "fertilizer", "moss", "pole", "gift"
  ].map((w) => tokenize(w)[0]!)
);

/** Plant arrangement heads that would otherwise look like containers ("קערת סוקולנטים"). */
const PLANT_ARRANGEMENT = ["סוקולנט", "סוקולנטים", "צמחים", "צמח", "קקטוסים", "תבלינים", "בונסאי"].map((w) => tokenize(w)[0]!);

const PLANT_CATEGORY = /צמח|צמחי|שתיל|עצי|עצים|בונסאי|סוקולנט|קקטוס|תבלין|פרחים|plant|tree|bonsai|succulent/i;
const ACCESSORY_CATEGORY = /כדים|כלים|עציצים ריקים|עציצים ואדניות|אדניות|אביזר|דשן|אדמה|השקיה|ציוד|כלי עבודה|גיפט|כרטיס|pots|planters|accessor/i;

export function detectProductKind(title: string, categories: string[], classification: Classification): ProductKind {
  const tokens = tokenize(title);
  const head = tokens[0];
  if (head && ACCESSORY_HEADS.has(head)) {
    const arrangement = tokens.slice(1, 4).some((t) => PLANT_ARRANGEMENT.includes(t));
    if (!arrangement) return "accessory";
  }
  const cats = categories.join(" | ");
  if (classification.taxonId) {
    // A named plant whose only categories are accessories (e.g. "עמוד טיפוס מונסטרה" filed under accessories).
    if (cats && ACCESSORY_CATEGORY.test(cats) && !PLANT_CATEGORY.test(cats)) return "accessory";
    return "plant";
  }
  if (tokens.some((t) => PLANT_ARRANGEMENT.includes(t))) return "plant";
  if (cats && PLANT_CATEGORY.test(cats)) return "plant";
  if (cats && ACCESSORY_CATEGORY.test(cats)) return "accessory";
  return "unknown";
}
