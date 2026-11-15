# Evaluation results (2026-11-15)

## Species classification (labeled real titles)

| Set | n | When measured | Exact accuracy | Unsafe error rate* |
|---|---|---|---|---|
| Dev (119 titles, 6 queries) | 119 | Blind baseline, before any tuning | 84.9% | not measured yet |
| Dev | 119 | After tuning on dev (`species-dev.after-tuning.json`) | 98.3% | 0.8% |
| Holdout #1 (Aglaonema, Philodendron, Hoya, Peperomia, Schefflera, Dracaena, Begonia) | 79 | **Blind**, single run | **86.1%** (89.3% on high/medium-confidence labels) | 3.8% |
| Holdout #1 | 79 | After fixes derived from it (now development data) | 92.4% | 3.8% |
| Holdout #2 (orchid, syngonium, anthurium, spathiphyllum, yucca, crassula, aloe, cactus) | 56 | **Blind**, single run (`species-holdout2.blind.json`) | **78.6%** | 0%** |
| Holdout #2 | 56 | After generic fixes (tie-break, colour words) | 87.5% | 0% |

\* Unsafe = the classifier claims something false (wrong genus, a species that was not stated, or a
non-taxonomy plant such as Cordyline attributed to Dracaena). Conservative errors (genus predicted where the
label has a species) are counted as wrong for accuracy but are safe.

\** Measured with the corrected scorer (family-level prediction of an orchid counts as correct-but-less-specific);
the first scorer version reported 1.8% for the same run.

**Honest reading:** the >=90% target is met on development data but NOT on blind data (86.1% and 78.6%).
The gap is almost entirely conservative: cultivar names missing from the taxonomy (e.g. Syngonium 'Pixie',
Hoya 'Compacta') make the classifier fall back to "genus only". Closing it is data work (cultivar lists),
ideally reviewed by a horticulturist; labels were produced by the implementing engineer from title text.

## Live source checks (`live-2026-11-15T06-35-37-814Z.json`)

- Links: 48/48 sampled listing URLs returned 200 and are product pages (100%).
- Price extraction: 47/47 checkable listings matched an independent price on the product page (100%);
  34 matched the exact variant id in the page's own variant data, the rest a schema.org offer. 1 page had no
  structured price. Both sides originate from the store's database, so this validates our extraction
  (units, variant mapping, size grouping), not the final checkout price.
- Stability: 20/20 repeated benchmark searches, 0 critical failures, 0 source errors.
