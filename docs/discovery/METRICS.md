# Success metrics

Measured values are published in the README "Metrics" table. Targets are fixed
here before the results exist.

| Area | Metric | Target |
|---|---|---|
| Science validity | Retrieval AUC of NASA-documented analogs vs. controls, with a 1,000× bootstrap 95% CI | Point estimate ≥ 0.75; CI reported whatever the result |
| Science validity | Median percentile of documented analogs among 1,000 random land cells | ≥ 80th percentile |
| Robustness | Spearman rank correlation across 12/20/40 km windows and between the ASTER GDEM and NASADEM sources | ≥ 0.7 |
| Coverage | Share of land cells with ≥ 0.6 dimension coverage | ≥ 95% (between 83°S and 83°N) |
| Speed | Coarse score for any point (browser) | ≤ 100 ms |
| Speed | Terrain refinement p95, uncached / cached | ≤ 8 s / ≤ 300 ms |
| Web performance | Lighthouse performance (desktop / mobile), LCP | ≥ 0.85 / ≥ 0.70; LCP ≤ 2.5 s |
| Accessibility | Lighthouse accessibility; axe serious/critical violations | ≥ 0.95; 0 |
| Usability | SUS score from a 5-user test | ≥ 75 |
| Reliability | Uptime of `/api/v1/health` through Jan 2027 | ≥ 99% |
| Cost | Monthly GCP and Firebase cost | ≤ $2 (alert at $5) |
| Security | High/critical findings open at release | 0 |
| Engineering | Commits on `main` passing commitlint | 100% |
