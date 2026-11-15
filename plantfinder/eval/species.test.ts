import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { evaluateSpecies, type LabeledTitle } from "./species-eval.js";
import { getTaxon } from "../packages/shared/src/index.js";

const load = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8")) as { items: LabeledTitle[] };

/**
 * Regression guard for the labeled evaluation sets (see docs/evaluation.md).
 * Thresholds sit just below the current results so that taxonomy edits cannot silently degrade them.
 * Blind numbers and history: eval/results/SUMMARY.md.
 */
describe("species classification on labeled real titles", () => {
  it("labels only reference known taxa", () => {
    for (const f of ["./species-dev.json", "./species-holdout.json", "./species-holdout2.json"])
      for (const i of load(f).items) if (i.expected) expect(getTaxon(i.expected), `${f}: ${i.expected}`).toBeDefined();
  });
  it.each([
    ["./species-dev.json", 0.95, 0.01],
    ["./species-holdout.json", 0.9, 0.04],
    ["./species-holdout2.json", 0.85, 0.01]
  ])("%s: exact accuracy and unsafe-error rate", (file, minAccuracy, maxUnsafe) => {
    const r = evaluateSpecies(load(file).items);
    expect(r.accuracy).toBeGreaterThanOrEqual(minAccuracy);
    expect(r.unsafeErrorRate).toBeLessThanOrEqual(maxUnsafe);
  });
});
