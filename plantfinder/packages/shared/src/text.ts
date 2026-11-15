/** Text normalization for Hebrew/English plant names and product titles. */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  times: "×",
  shy: ""
};

/** Decode HTML entities as returned by WooCommerce/WordPress titles (e.g. "&#8211;"). */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? whole;
  });
}

/** Strip HTML tags (for short descriptions); not a sanitizer — output is always rendered as text. */
export function stripTags(input: string): string {
  return decodeEntities(input.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

const FINAL_LETTERS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
// Hebrew points/cantillation (niqqud) and the Hebrew punctuation marks maqaf/geresh/gershayim handled below.
const NIQQUD = /[֑-ֽֿ-ׂׄ-ׇ]/g;

/**
 * Light normalization that keeps digits, ranges and units readable:
 * entities decoded, NFKC, lower-cased, niqqud removed, quote variants unified.
 */
export function lightNormalize(input: string): string {
  return decodeEntities(input)
    .normalize("NFKC")
    .toLowerCase()
    .replace(NIQQUD, "")
    .replace(/[׳’‘`´]/g, "'") // geresh variants -> '
    .replace(/[״“”]|''/g, '"') // gershayim variants -> "
    .replace(/[־‐-―]/g, "-") // maqaf and dashes -> -
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Aggressive normalization for name matching: removes quotes/apostrophes,
 * turns punctuation into spaces and maps Hebrew final letters to their base form.
 * "מונסטרה מאנקי – Monstera 'Adansonii'" -> "מונסטרה מאנקי monstera adansonii"
 */
export function normalizeForMatch(input: string): string {
  return lightNormalize(input)
    .replace(/["']/g, "")
    .replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c] ?? c)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  const n = normalizeForMatch(input);
  return n ? n.split(" ") : [];
}

/** Common one-letter Hebrew prefixes (ה, ו, ב, ל, מ, ש, כ) that attach to nouns. */
const HEBREW_PREFIXES = new Set(["ה", "ו", "ב", "ל", "מ", "ש", "כ"]);

function tokenEquals(token: string, target: string, allowPrefix: boolean): boolean {
  if (token === target) return true;
  if (!allowPrefix) return false;
  return (
    token.length === target.length + 1 && HEBREW_PREFIXES.has(token[0]!) && /[א-ת]/.test(target[0]!) && token.slice(1) === target
  );
}

/**
 * Find a phrase (already tokenized) inside a token list. The first token may carry
 * a single Hebrew prefix letter. Returns the index of the first matching token or -1.
 */
export function findPhrase(tokens: readonly string[], phrase: readonly string[]): number {
  if (phrase.length === 0 || phrase.length > tokens.length) return -1;
  outer: for (let i = 0; i + phrase.length <= tokens.length; i++) {
    if (!tokenEquals(tokens[i]!, phrase[0]!, true)) continue;
    for (let j = 1; j < phrase.length; j++) {
      if (tokens[i + j] !== phrase[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export function containsHebrew(input: string): boolean {
  return /[א-ת]/.test(input);
}
