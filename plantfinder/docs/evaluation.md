# Evaluation

Detailed numbers: `eval/results/SUMMARY.md`. Raw outputs: `eval/results/*.json`.

## 1. Species classification (offline, labelled real titles)

**Data.** Real product titles recorded from the six pilot sources on 2026-11-14/15. Three sets:

| Set | File | Titles | Plant groups |
|---|---|---|---|
| Dev | `eval/species-dev.json` | 119 | Monstera, pothos, ficus, sansevieria, ZZ, calathea, alocasia |
| Holdout #1 | `eval/species-holdout.json` | 79 | Aglaonema, Philodendron, Hoya, Peperomia, Schefflera, Dracaena, Begonia |
| Holdout #2 | `eval/species-holdout2.json` | 56 (+2 non-plants) | Orchids, Syngonium, Anthurium, Spathiphyllum, Yucca, Crassula, Aloe, cacti |

Titles are a deterministic sample, stratified by source.

**Labelling rules.** The label is the most specific taxonomy id that is *correct*. It is genus-level when the
title doesn't state the species. A plain generic name follows Israeli trade convention (plain "מונסטרה" =
*M. deliciosa*). `null` means the plant is not in the taxonomy (for example Cordyline sold as "דרצנה").
Each label carries a confidence (high, medium, low). Labels were written by the implementing engineer from
title text. **They are not a horticulturist's review**; a spot check by a domain expert is recommended.

**Protocol.** Each holdout was labelled blind (titles only), scored once, and only then used for fixes. A
holdout that has been used for fixes is reported as development data from then on.

**Metrics.**
- *Exact accuracy*: the predicted id equals the label.
- *Unsafe error rate*: the classifier claims something false (wrong genus, a species the title doesn't
  state, or a non-taxonomy plant attributed to a taxon). A genus-only prediction for a species label counts
  as wrong but *safe*.

**Results.**

| | Exact (blind) | Unsafe (blind) | Exact now* |
|---|---|---|---|
| Dev | 84.9% (before any tuning) | — | 98.3% |
| Holdout #1 | **86.1%** | 3.8% | 92.4% |
| Holdout #2 | **78.6%** | 0% | 87.5% |

\* "Now" includes fixes derived from that set, so it is not an unbiased estimate.

**Verdict on the ≥90% criterion: not met on blind data.** Errors are overwhelmingly conservative: cultivar
names missing from the taxonomy (Syngonium 'Pixie' or 'Mojito', Hoya 'Compacta') fall back to "genus only".
That reduces recall for species-specific searches but does not create false matches. Unsafe errors were
mostly trade mislabelling (Cordyline sold as Dracaena), which is now encoded. Next step: grow the cultivar
lists with expert review, then measure on a fresh holdout.

Regression guard: `eval/species.test.ts` (runs in `pnpm test`).

## 2. Live link validity and price extraction

`pnpm eval` runs live searches through the production adapters. It samples 8 listings per source (48 in
total), fetches each product page (robots-checked, 1.5 s apart per host), and compares our price with an
**independent value on the page**: WooCommerce's per-variation data (`data-product_variations`, matched by
variant id), or schema.org JSON-LD offers (matched by variant URL when available).

Run of 2026-11-15:

| Metric | Result | Target |
|---|---|---|
| Valid source links | **48/48 (100%)** | ≥90% |
| Price extraction accuracy | **47/47 (100%)**; 1 page had no structured price | ≥85% |
| Of which matched by exact variant id | 34 | — |
| 20 repeated benchmark searches | **0 critical failures, 0 source errors** | 0 critical |

Caveat: the page value and our API value both come from the store's database. The check proves correct
extraction (minor units, variant mapping, size grouping, sale prices). It does not prove the final checkout
price (coupons, shipping), and it is not a guarantee for future runs. Re-run `pnpm eval` regularly.

## 3. Benchmark: Monstera / Netanya / 25 km / ≤ ₪150

On the recorded snapshot (fixture mode, also verified live during development):
- **0 confirmed matches.** The only source with a verified location inside 25 km (המשתלה, Giv'at Hen,
  18.6 km) had Monstera only above ₪150 or out of stock.
- **5 offers with unknown seller location** (נטע, GRDN: online stores), shown separately with their
  delivery terms.
- **10 offers outside the radius** (nearest 29.9 km). The UI offers "expand to 30 km", which yields 3
  confirmed matches.
- 16 offers of *other* Monstera species or look-alikes (M. adansonii, Rhaphidophora "מונסטרה מינימה",
  "מונסטרה B.M.F") are kept out of the matches and listed separately.

This is the intended behaviour: honest empty results, with the reasons and the nearest alternatives.
