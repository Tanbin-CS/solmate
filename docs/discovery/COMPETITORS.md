# Existing work and how SolMate differs

Researched 30–31 Oct 2026.

| Existing work | What it does | Gap SolMate fills |
|---|---|---|
| [NASA Planetary Analog Explorer](https://science.nasa.gov/solar-system/analog-explorer/) | Catalogue of documented analog sites and their uses | No quantitative scoring and no discovery of new sites. *We use it as validation positives.* |
| [IMEWG "Mars on Earth" analogue database](https://imewg.org/joint-initiatives/mars-on-earth-analogues/) | International Mars analog site database (in development) | A catalogue, not a screening method; Mars only |
| Sanganeria (2026), [NHSJS](https://nhsjs.com/2026/finding-earths-best-testbeds-for-moon-and-mars-rovers-a-quantitative-terrain-comparison/) | Ranks 10 known Earth sites by 4 image-texture features (Euclidean distance) | Visual texture only, known sites only, no physical NASA data, no breaks-down. Cited as prior art |
| 2026 Space Apps team ["Analog Identifier for Extraterrestrial Bodies"](https://www.spaceappschallenge.org/2026/find-a-team/analog-identifier-for-extraterrestrial-bodies/) | Planned AI image-similarity model | Black-box image matching, which the challenge warns against ("think beyond visual similarity") |
| 541 teams on this challenge (Teams tab, 31 Oct 2026), at least 4 from Dhaka | — | Differentiation must show in the first 15 s of the video and the first line of the project page |

## SolMate v2 differentiators
1. **Physical, multi-dimensional, NASA-first:**
   - 6–8 dimensions from 15+ NASA datasets.
   - Per-dimension sub-scores, so we can say *which* traits match.
2. **Targets NASA is actually planning:** 9 Artemis III regions, Jezero and
   Arcadia Planitia.
3. **Global discovery:**
   - Stage-1 screening of all land cells at 0.1°, refined with 100 m terrain.
   - Novelty measured against known analog sites.
4. **Honest limits:**
   - Deterministic breaks-down rules: gravity, pressure, radiation and
     dimension gaps.
   - The Earth-can-only-approach gaps are shown.
5. **Validated:**
   - Pre-registered metrics: AUC with bootstrap CI, a background-percentile
     test, ablation, scale and DEM-source sensitivity.
   - Cross-validated learned weights.
6. **Usable and live:** score any box on Earth in seconds, a dossier PDF,
   community nominations, and an offline-capable demo.
