# Validation plan (pre-registered)

Written 31 Oct 2026, **before** the v2 validation results were computed. Results are
reported whatever they are, in `data/validation/validation.v2.json` and on the Method page.

## Question
Does the SolMate Analog Index rank Earth places that NASA and partner agencies already
use as Moon or Mars analogs above places nobody would use (forests, farmland, cities,
wetlands), when it scores every land cell from NASA data alone?

## Labels
`analysis/src/solmate/config/validation_sites.yaml`:
- **Positives:** Earth sites documented as analogs and paired with a body.
  - Mars-paired (17): the NASA Planetary Analog Explorer sites, plus NASA/ESA analog
    mission sites (HMP, MDRS, MARTE, AMASE, Pavilion Lake, ExoMars field tests,
    High Lakes, Qaidam, Dry Valleys, Lonar).
  - Moon-paired (10): the Analog Explorer volcanic sites, Apollo/Artemis training
    craters and lava flows, Desert RATS, HI-SEAS, ESA PANGAEA sites.
- **Controls (20):** stratified across biomes that are not analogs: tropical and
  temperate forest, taiga, cropland, grassland, savanna, wetland, urban.
- Every label carries its source. Labels were chosen before scoring.

## Scoring
- Each site is scored at the 0.1° land cell that contains it.
- The SAI uses the equal preset over the dimensions that apply to the target body.
- A target's positives are the sites paired with its body.

## Metrics
1. **Retrieval AUC:** positives vs. controls, per target, with a 95% CI from 1,000
   bootstrap resamples of sites (seed 2026).
2. **Background percentile:** each positive's percentile among *all* scored land cells
   (about 1.9 M), reported as the median. This is a harder test than AUC.
3. **Leave-one-out:** for each positive, its rank among positives + controls with that
   site removed from the learned-weight fit.
4. **Ablation:** ΔAUC when each dimension is dropped.
5. **Learned weights (exploratory):**
   - Non-negative L2 logistic regression on dimension sub-scores.
   - Repeated stratified 5-fold cross-validation (10 repeats, seed 2026).
   - Out-of-fold AUC is reported next to the equal and expert presets.
6. **Robustness:** AUC under 1,000 random Dirichlet weight vectors (p5, p50, p95).

## Success thresholds (from docs/discovery/METRICS.md)
- AUC point estimate ≥ 0.75.
- Median background percentile of positives ≥ 80.

Falling short is reported, not hidden.

## Known limits
- Positives are well-known analog sites, so they partly reflect where agencies can
  operate, not only physical similarity.
- The 0.1° cell (about 11 km) blurs small sites. Lava tubes and craters are smaller.
- Some dimensions are proxies on the target side (lunar thermal; most of Arcadia).
- Controls are by construction easy negatives; the background percentile guards
  against that.

---

## Results (computed 31 Oct 2026, unedited; `data/validation/validation.v2.json`)

| Target | AUC (95% CI) | Positives' median land percentile | Learned-weight CV AUC |
|---|---|---|---|
| Jezero Crater | **0.844** (0.694–0.962) | 79.2 | 0.821 |
| Artemis regions (9) | 0.735–0.800, median **0.760** | 47.7–70.8, median 51.6 | 0.712–0.782 |
| Arcadia Planitia | 0.582 (0.382–0.768) | 48.6 | 0.843 |

**Against the thresholds**
- AUC ≥ 0.75: met for Jezero and the Artemis median; not met for Arcadia.
- Median percentile ≥ 80: not met (Jezero 79.2 comes closest).

**What we learn**
1. **Jezero:** documented Mars analogs are clearly retrieved from all 1.9 M land
   cells using NASA data alone.
2. **Moon:**
   - Lunar analog training sites separate from controls (AUC ≈ 0.76), but they sit
     mid-pack among all land.
   - Hawaiʻi, Iceland, Lanzarote and Sudbury are used for volcanic and impact
     *geology* in humid climates. The environment dimensions do not reward that.
     Process tags and site-scale geology are the right complement.
3. **Arcadia:** most labelled Mars analogs are warm deserts, while the Arcadia target
   is a cold, ice-rich plain. The labels describe science-site analogs better than
   human-base ice analogs.
4. **Mineralogy:** the learned weights put zero weight on it. At 5 km, the ASTER
   indices do not separate the documented sites. Climate, surface and thermal
   dimensions carry the signal.

The equal preset stays the default. The learned weights are shipped as the
"Learned" preset, labelled exploratory.

### Re-run with Diviner-measured lunar temperatures (31 Oct 2026)
The plan, labels and metrics are unchanged. Only the lunar target values changed: the
shared literature proxies were replaced by per-region LRO Diviner samples.

| Target | AUC (95% CI) | Positives' median land percentile |
|---|---|---|
| Artemis regions (9) | 0.710–0.780, median **0.750** (was 0.760) | 53.3–70.8, median 55.8 (was 51.6) |
| Jezero, Arcadia | unchanged | unchanged |

**What changed:**
- Lunar temperatures lie beyond every place on Earth, so they score by rank (toward
  mode), not by magnitude. The new values barely move the ranking.
- What did change is the ice dimension, now computed from cold traps: only Mons
  Mouton Plateau has one within 2 km.
- That moved some regions' best matches, e.g. Mons Mouton and Nobile Rim 2 now point
  to the Pamirs (about 1,550 km from any known analog).

---

## Addendum 1: regional validation and Lunar ops weights (pre-registered 2 Nov 2026)

Written **before** these results were computed, after mentor review (Space Apps Dhaka,
1 Nov 2026). The original plan and results above stay unchanged; everything here is
reported as an addition, whatever it shows.

### Why
1. **Clustering.** Several validation sites sit close together (Utah and Arizona,
   Hawaiʻi, Iceland, the Ganges plain). Nearby sites share climate and ground, so they
   are not independent, and counting each one can make the AUC and its interval look
   better than the evidence supports.
2. **Moon emphasis.** NASA's Moon analog sites were chosen mainly for terrain and
   operations. The mentor advised keeping the approach but weighting terrain and
   operational suitability more, with climate, temperature and ice as support.

### Regions (fixed rule, no hand grouping)
- Positives and controls are each grouped by single-linkage clustering of their
  great-circle distances with a **500 km** threshold: two sites share a region if a
  chain of sites less than 500 km apart connects them.
- Regions are computed once per body from `validation_sites.yaml` and reported with
  their members.

### Metrics (per target, equal preset unless stated)
1. **Region-weighted AUC:** each site weighted by 1 / (number of sites in its region),
   so every region counts once.
2. **Region block-bootstrap 95% CI:** resample positive regions and control regions
   with replacement (1,000 resamples, seed 2026) and compute the AUC on all sites of
   the drawn regions.
3. **Leave-one-region-out learned weights:** each region (positive or control) is
   held out in turn; non-negative logistic weights are fitted on the rest and score the
   held-out sites; the AUC of these out-of-region scores is reported.
4. **Lunar ops preset (Moon targets):** dimension weights
   Terrain 2, Operations 1, Surface & barrenness 1, Climate 0.5, Thermal 0.5,
   Ice 0.5, Mineralogy 0.5. Operations is the existing dimension (gentle slopes, low
   wind). Its site AUC with the original bootstrap CI, and metrics 1 and 2, are
   reported next to the equal preset. Dimension scores are computed at the site cells
   from the same stack and code as the screen.

### Decision rule for the Moon default
Lunar ops becomes the default weighting for Moon targets **only if**, across the nine
Artemis regions, both its median site AUC and its median region-weighted AUC are at
least those of the equal preset. Otherwise it ships as an optional preset and equal
stays the default. Adopting it would also mean re-running the screen for Moon targets.

### Expectation (stated so it can be checked)
Region-level intervals will be wider than site-level ones, and the region-weighted AUC
may fall, most for the Moon, where three positives share northern Arizona.

### Results of addendum 1 (computed 2 Nov 2026, unedited; `data/validation/validation_regions.v1.json`)

Regions at 500 km: Mars positives form 14 regions, Moon positives 7, controls 16.
Memberships are listed in the JSON. Site-level AUCs reproduce the original results exactly (same code, same cells).

| Target | AUC (sites) | Each region once | 95% CI by region | Learned, leave-one-region-out | Lunar ops AUC | Lunar ops, each region once |
|---|---|---|---|---|---|---|
| Jezero Crater | 0.844 | 0.802 | 0.67–0.96 | 0.824 | – | – |
| Arcadia Planitia | 0.582 | 0.515 | 0.37–0.75 | 0.847 | – | – |
| Peak near Cabeus B | 0.775 | 0.723 | 0.55–0.94 | 0.710 | 0.790 | 0.788 |
| Haworth | 0.715 | 0.653 | 0.41–0.94 | 0.685 | 0.495 | 0.388 |
| Malapert Massif | 0.780 | 0.725 | 0.55–0.94 | 0.735 | 0.805 | 0.793 |
| Mons Mouton Plateau | 0.765 | 0.740 | 0.51–0.97 | 0.660 | 0.575 | 0.520 |
| Mons Mouton | 0.720 | 0.669 | 0.43–0.94 | 0.685 | 0.515 | 0.428 |
| Nobile Rim 1 | 0.750 | 0.696 | 0.47–0.94 | 0.700 | 0.690 | 0.663 |
| Nobile Rim 2 | 0.710 | 0.662 | 0.41–0.94 | 0.685 | 0.490 | 0.399 |
| de Gerlache Rim 2 | 0.760 | 0.701 | 0.49–0.95 | 0.700 | 0.720 | 0.672 |
| Slater Plain | 0.735 | 0.681 | 0.47–0.94 | 0.665 | 0.590 | 0.506 |

Moon medians: equal 0.750 (each region once 0.696); Lunar ops 0.590 (0.520).

**Decision (by the pre-registered rule):** keep equal as the Moon default; offer Lunar ops as a preset.

**What we learn**
1. **Clustering inflates the AUC a little, not much.** Counting each region once lowers
   Jezero from 0.844 to 0.802 and the Moon median from 0.750 to 0.696. The interval for
   Jezero when whole regions are resampled (0.67–0.96) still sits above chance.
2. **Learned weights generalise across regions for Jezero** (0.824 on regions never
   seen in fitting), less so for the Moon (0.66–0.74).
3. **Lunar ops splits the Moon targets.** It helps the rugged massifs (Malapert Massif
   0.805, Peak near Cabeus B 0.790) and hurts the plateaus and plains (Haworth 0.495,
   Nobile Rim 2 0.490, Mons Mouton Plateau 0.575). Why the regions split is not
   established here; target terrain values and the small number of Moon analog sites
   (10, in 7 regions) are the first things to examine. Equal weights stay the Moon
   default; Lunar ops ships as an option.
4. **Arcadia stays weak with equal weights** (0.515 with each region once). Learned
   weights tested on unseen regions reach 0.847, as in the original cross-validation
   (0.843): they learn what separates Mars analog sites from controls in general, so
   the weak point is the equal weighting against an ice-plain target, not the data.
5. The expectation stated above held: region intervals are wider and the
   region-weighted AUC is lower, most for the Moon.

## Addendum 2: datasets added on event day (pre-registered 3 Nov 2026)

Written before any event-day dataset is seen. The Space Apps Resources tab opens on
13 Nov 2026; datasets from it, or any later addition, follow this rule.

1. **Context first.** A new dataset enters as a context layer (`role: context` in
   `config/event_layers.yaml`): shown in the place panel with its source, never scored.
   The published scores, rankings and validation do not change.
2. **Scoring is the exception, tested the same way as everything else.** A dataset may
   join the score only if it is NASA data, has a cited or computed value at every target
   its dimension applies to, and the full validation is re-run with it
   (`solmate.pipeline.release --scored`).
3. **Decision rule.** For each body the layer is scored on, the median AUC with equal
   weights may fall by at most 0.02 against the run before the change. If it falls more,
   the layer goes back to context. The release command applies the rule and writes the
   comparison to `data/validation/event_check.v1.json`.
4. **Reporting.** Results are reported unedited, whichever way they go, with the
   before and after values.

Rehearsal (3 Nov 2026): NASA GLDAS topsoil moisture added as a context layer; the
procedure from download to files ready to deploy took about 7 minutes (download 3 min 44 s,
release 3 min 11 s). No score changed.

## Addendum 3: the 100 m terrain score (found and changed 3–4 Nov 2026, not pre-registered)

This addendum records a problem found after the results were published, the test that
showed it, and the change made. It was not planned in advance; the numbers are reported
unedited.

### What was wrong
1. **The yardstick.** Each similarity divides the gap between a place and the target by
   Earth's spread of that indicator. For the ~1 km dimensions that spread comes from all
   land. For the 100 m terrain indicators it came from the 587 refined candidate windows,
   which run from salt flats to high mountains: the spread of median slope was 8.6°. A flat
   floodplain (Dhaka, median slope 0.6°) therefore scored 0.99 against Jezero's crater floor
   (2.1°) on that indicator and 0.75 overall, while the ~1 km terrain dimension gave 0.13.
2. **The use.** The 100 m score replaced the ~1 km terrain dimension in the SAI of every
   refined cell, in the rankings and on request in the Explorer, but the validation above
   never tested it.

### Test (terrain alone, the pre-registered positives against the controls, plain AUC)
The 100 m yardstick was rebuilt from 500 random land windows: the same land definition as
the ~1 km statistics (MODIS land fraction > 0.5, |lat| ≤ 83°, area-weighted), seed 2026,
read from ASTER GDEM v3 exactly like the candidates (`terrain100_baseline.py`,
`data/screening/stage2_baseline.v2.json`). The spread of median slope fell from 8.6° to
1.8°, and Dhaka against Jezero from 0.75 to 0.54.

| Terrain alone | ~1 km dimension | 100 m, candidate yardstick | 100 m, land yardstick |
|---|---|---|---|
| Jezero Crater | 0.485 | 0.526 | 0.468 |
| Moon targets (9), median | 0.745 | 0.440 | 0.360 |
| Moon targets, range | 0.700–0.750 | 0.375–0.560 | 0.325–0.570 |

Per target: `data/validation/terrain100_check.v2.json`. At ~1 km, terrain alone separates
the Moon analog sites from the controls; at 100 m it does not, under either yardstick.
One likely reason, not tested here: ASTER GDEM is a surface model that includes trees and
buildings, so forest controls look as rugged as the lunar highlands. For Jezero, terrain at
either scale carries no signal on its own (the SAI's strength there is climate and surface).

### Change
- The 100 m statistics now come from the land sample (`stage2_stats.v2.json`, version 3).
- The SAI, the rankings, the case studies and the Explorer use the ~1 km dimensions only,
  which is what the validation above tested. Its results are unchanged.
- The 100 m score is shown beside the SAI as a **terrain check**, with this result stated,
  and is never folded in.
- Effect on the published results: the best region for every target is unchanged (the
  Tibetan Plateau, the Puna de Atacama, the Sistan Basin); exact cells and scores move by a
  few points. The Jezero case study moves from 37.05°N 86.75°E to 34.95°N 83.35°E, both on the
  Tibetan Plateau.

## Addendum 4: missing snow months and data coverage (found and changed 6 Nov 2026, not pre-registered)

An independent review of the code found two data-handling problems. Like addendum 3, this
records what was wrong, the change and the effect, unedited.

### What was wrong
1. **Missing snow months counted as snow-free.** `snow_months_per_year` counted months with
   more than 50 % snow by testing `months > 50` before adding up. MOD10CM marks cloud, polar
   night and other no-observation months as missing, and a missing value fails that test, so
   every missing month counted as a snow-free month. 33,759 land cells with no observed month
   at all got 0 instead of "no data", and 342,928 cells had their value pulled down (on
   average by 1.6 months per year, at most by 9), mostly at high latitudes.
2. **Coverage ignored missing indicators inside a dimension.** A dimension counted as fully
   available when any one of its indicators had data, so the "low data coverage" flag and
   the 60 % screening threshold could miss places where half a dimension was empty.
3. **Lunar cold-trap class labelled as computed.** The Moon targets' `snow_months_per_year`
   (0, 6 or 12) is a class derived from Diviner temperatures, not a snow measurement, but it
   was labelled `computed` and kept the excerpt, DOI and uncertainty of the literature proxy
   it replaced. The same stale fields stayed on the other Diviner thermal values.

### Change
- Snow months are now the snowy share of the months MOD10CM observed, scaled to 12; a cell
  with fewer than 6 observed months of the 24 has no value (`build_stack.snow_months`).
  This assumes unobserved months behave like observed ones; at high latitudes, where the dark
  winter months are missing, it is still likely to undercount.
- Coverage is now indicator-level: each dimension counts by the share of its indicator weight
  with data (`aggregate.sai`, `score.sai_grid`, mirrored in TypeScript). The Explorer shows
  "N% data" next to any dimension that is incomplete. Coverage never changes a score, only
  the flag and the screening threshold.
- Diviner values carry only their own source and a stated uncertainty; the cold-trap class
  is labelled `derived` with its rule (12 if the warmest temperature within 2 km stays below
  110 K, 6 if below 125 K, else 0).

### Effect (same sites, controls, seed and weights; `model_version` 687e6cf45278 → 09ddf6ffce73)

| Target | AUC before | AUC after |
|---|---|---|
| Jezero Crater | 0.844 | 0.841 |
| Arcadia Planitia | 0.582 | 0.576 |
| Moon targets (9), median | 0.750 | 0.755 |
| Moon targets, region-weighted median | 0.696 | 0.705 |

The 25 top cells and 25 novel leads are unchanged for 8 of the 11 targets; for Malapert Massif
and Mons Mouton Plateau one place of 25 changed. Nobile Rim 2's first place changed between two
cells 0.01 points apart. The case studies are unchanged. The main tables above keep the
numbers as first computed; the live site and `data/validation/validation.v2.json` carry the
new ones.
