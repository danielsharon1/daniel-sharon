import type { SizeClass, SizeInfo } from "./types.js";
import { lightNormalize, tokenize } from "./text.js";

const CLASS_WORDS: [SizeClass, string[]][] = [
  ["XXL", ["xxl", "ענק", "ענקית", "ענקי"]],
  ["XL", ["xl", "אקסטרה לארג", "extra large"]],
  ["XS", ["xs", "בייבי", "baby"]],
  ["S", ["קטן", "קטנה", "small", "סמול"]],
  ["M", ["בינוני", "בינונית", "medium", "מדיום"]],
  ["L", ["גדול", "גדולה", "large", "לארג"]]
];

const LETTER_CLASS: Record<string, SizeClass> = { xs: "XS", s: "S", m: "M", l: "L", xl: "XL", xxl: "XXL" };

function inRange(n: number, min: number, max: number): boolean {
  return Number.isFinite(n) && n >= min && n <= max;
}

/**
 * Parse plant/pot size information from a product title and/or variant label.
 * Only explicit statements are used — nothing is inferred from price or images.
 */
export function parseSize(...texts: (string | null | undefined)[]): SizeInfo {
  const info: SizeInfo = { sizeClass: null, potDiameterCm: null, heightCm: null, potVolumeL: null, evidence: [] };
  for (const raw of texts) {
    if (!raw) continue;
    const t = lightNormalize(raw).replace(/["']/g, "");

    if (info.potDiameterCm === null) {
      const m =
        /קוטר[\s-]*(?:של[\s-]*)?(?:עציץ[\s-]*)?(\d{1,3})/.exec(t) ??
        /(\d{1,3})\s*(?:סמ|cm)\s*קוטר/.exec(t) ??
        /(?:^|[\s(])(?:עציץ|כלי)[\s-]+(\d{1,2})(?![\d.]|\s*(?:ליטר|ל\b|-\s*\d))/.exec(t);
      if (m && inRange(Number(m[1]), 5, 120)) {
        info.potDiameterCm = Number(m[1]);
        info.evidence.push(m[0].trim());
      }
    }

    if (info.heightCm === null) {
      const m =
        /גובה[\s-]*(?:של[\s-]*)?(?:כ[\s-]*)?(\d{1,3})(?:\s*-\s*(\d{1,3}))?/.exec(t) ??
        /(?<!קוטר\s*)(\d{2,3})\s*-\s*(\d{2,3})\s*(?:סמ|cm)/.exec(t);
      if (m) {
        const a = Number(m[1]);
        const b = m[2] ? Number(m[2]) : a;
        if (inRange(a, 5, 600) && inRange(b, a, 600)) {
          info.heightCm = { min: a, max: b };
          info.evidence.push(m[0].trim());
        }
      } else {
        const meters = /(\d(?:\.\d{1,2})?)\s*(?:מטר|מ׳|m\b)/.exec(t);
        if (meters && inRange(Number(meters[1]), 0.2, 6)) {
          const cm = Math.round(Number(meters[1]) * 100);
          info.heightCm = { min: cm, max: cm };
          info.evidence.push(meters[0].trim());
        }
      }
    }

    if (info.potVolumeL === null) {
      const m = /(\d{1,3})[\s-]*ליטר/.exec(t);
      if (m && inRange(Number(m[1]), 1, 500)) {
        info.potVolumeL = Number(m[1]);
        info.evidence.push(m[0].trim());
      }
    }

    if (info.sizeClass === null) {
      const attr = /גודל\s*:\s*([a-z]{1,3}|[א-ת]+)/.exec(t);
      const attrValue = attr?.[1];
      const bare = t.trim(); // a variant label that is just "L" / "XL"
      if (attrValue && LETTER_CLASS[attrValue]) {
        info.sizeClass = LETTER_CLASS[attrValue]!;
        info.evidence.push(attr[0]);
      } else if (LETTER_CLASS[bare]) {
        info.sizeClass = LETTER_CLASS[bare]!;
        info.evidence.push(bare);
      } else {
        const tokens = tokenize(t);
        const joined = ` ${tokens.join(" ")} `;
        for (const [cls, words] of CLASS_WORDS) {
          const hit = words.find((w) => joined.includes(` ${tokenize(w).join(" ")} `));
          if (hit) {
            info.sizeClass = cls;
            info.evidence.push(hit);
            break;
          }
        }
      }
    }
  }
  return info;
}

export function hasSizeInfo(s: SizeInfo): boolean {
  return s.sizeClass !== null || s.potDiameterCm !== null || s.heightCm !== null || s.potVolumeL !== null;
}
