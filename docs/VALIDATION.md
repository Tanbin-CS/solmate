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
