/** Species classification accuracy on a labeled set of real titles. Usage: tsx eval/species-eval.ts [file] */
import { readFileSync } from "node:fs";
import { classifyText, getTaxon } from "../packages/shared/src/index.js";

export interface LabeledTitle {
  source: string;
  title: string;
  expected: string | null;
  labelConfidence: "high" | "medium" | "low";
}

/**
 * "Safe" = exactly right, or correct but less specific (genus predicted, species in that genus expected).
 * "Unsafe" = claims something that is not true (wrong genus, a species that was not stated, or a
 * plant outside the taxonomy attributed to one inside it). Unsafe errors can create false matches.
 */
function isSafe(predicted: string | null, expected: string | null): boolean {
  if (predicted === expected) return true;
  if (predicted === null) return true; // abstaining is never a false claim
  if (expected === null) return false;
  const p = getTaxon(predicted);
  const e = getTaxon(expected);
  if (!p || !e) return false;
  if (p.rank === "genus") return p.genus === e.genus; // right genus, species not claimed
  if (p.rank === "family") return e.id === p.id || e.family === p.genus || e.genus === p.genus; // right family
  return false;
}

export function evaluateSpecies(items: LabeledTitle[]) {
  const rows = items.map((i) => {
    const c = classifyText(i.title);
    const predicted = c.taxonId ?? null;
    const expected = i.expected ?? null;
    return { ...i, predicted, level: c.level, ok: predicted === expected, safe: isSafe(predicted, expected) };
  });
  const acc = (rs: typeof rows) => (rs.length ? rs.filter((r) => r.ok).length / rs.length : 0);
  const confident = rows.filter((r) => r.labelConfidence !== "low");
  return {
    n: rows.length,
    accuracy: acc(rows),
    nConfidentLabels: confident.length,
    accuracyConfidentLabels: acc(confident),
    unsafeErrorRate: rows.length ? rows.filter((r) => !r.safe).length / rows.length : 0,
    errors: rows
      .filter((r) => !r.ok)
      .map((r) => ({ title: r.title, expected: r.expected, predicted: r.predicted, level: r.level, label: r.labelConfidence, safe: r.safe }))
  };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!);
if (isMain) {
  const file = process.argv[2] ?? new URL("./species-dev.json", import.meta.url).pathname;
  const { items } = JSON.parse(readFileSync(file, "utf8")) as { items: LabeledTitle[] };
  for (const i of items) if (i.expected && !getTaxon(i.expected)) console.warn(`unknown label id: ${i.expected}`);
  const r = evaluateSpecies(items);
  console.log(
    JSON.stringify(
      { ...r, accuracy: +r.accuracy.toFixed(3), accuracyConfidentLabels: +r.accuracyConfidentLabels.toFixed(3), unsafeErrorRate: +r.unsafeErrorRate.toFixed(3) },
      null,
      1
    )
  );
}
