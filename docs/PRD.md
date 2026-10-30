# SolMate v2: Product Requirements Document

Version 1.0 · 31 Oct 2026 · Owner: Team Northern Lights
Inputs: [problem](discovery/PROBLEM.md), [users](discovery/USERS.md),
[competitors](discovery/COMPETITORS.md), [metrics](discovery/METRICS.md).

## 1. Summary
SolMate finds and characterizes Earth places that are analogs for NASA's
Artemis III candidate base regions on the Moon and for Mars landing and
exploration sites.

- It scores any place on Earth on physical dimensions computed from NASA data,
  shows where the analogy holds and where it breaks down, and surfaces novel
  leads from a global screen.
- It is shipped as a web app, with a mission dossier PDF and a written
  findings report.

## 2. Targets
- **Moon (9):** Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton
  Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater
  Plain (NASA, 28 Oct 2024).
- **Mars (2):** Jezero Crater (Mars 2020 science site); Arcadia Planitia
  (human-base ice target, NASA SWIM). Arcadia is a Should.

## 3. User stories and acceptance criteria
| ID | Story | Acceptance criteria (Given / When / Then) | MoSCoW |
|---|---|---|---|
| US-01 | As a **judge or visitor**, I want a guided tour so that I see the core result without learning the UI | Given the home page, when I click "Take the tour", then within 60 s it shows: a target, the global surface, the top novel lead, its dimension breakdown and its breaks-down card, with no typing | Must |
| US-02 | As a **planner**, I want to pick a target (any Artemis region or Mars site) so that rankings match my mission | Given the Explorer, when I choose a target, then the globe surface, rankings and URL update within 500 ms | Must |
| US-03 | As a **planner**, I want ranked Earth sites with an overall SAI (0–100) and per-dimension sub-scores so that I see what matches | Given a target, the list shows SAI, the top 3 matching dimensions and coverage; every number traces to `compute/` output | Must |
| US-04 | As an **engineer**, I want the best sites for *each* dimension so that I can pick a site for one condition | Given a target, the Dimension leaders tab lists the top 5 sites per dimension with values and units | Must |
| US-05 | As **anyone**, I want to score any place by clicking or drawing a 10–40 km box so that I can test places I know | Given the map, when I draw a box, then a coarse SAI appears in ≤ 100 ms and refined terrain in ≤ 8 s p95; if the API fails the coarse score stays, with a notice | Must |
| US-06 | As a **scientist**, I want to see where the analogy breaks down so that I don't over-claim | Every site shows gravity, pressure and radiation ratios, dimensions under 0.4 labelled "differs", and "Earth can only approach" gaps, each with its source | Must |
| US-07 | As a **scientist**, I want novel leads far from known analog sites so that I can find unstudied places | Given a target, the Novel leads list shows the top 25 cells more than 300 km from `known_analogs.yaml`, with the distance to the nearest known site | Must |
| US-08 | As a **planner**, I want to adjust dimension weights and presets (Equal, Expert, Learned, Mission ops) so that rankings fit my use | Given weights change, the globe and list re-rank in ≤ 200 ms, and the URL keeps the state | Must |
| US-09 | As a **planner**, I want side-by-side Earth vs. target imagery at the same scale so that I can compare visually | Site detail shows HLS true colour + ASTER GDEM hillshade next to CTX (Mars) or LOLA hillshade (Moon) at 20 km, each with a scale bar | Must |
| US-10 | As a **planner**, I want a dossier PDF per site so that I can share it with my team | Clicking Dossier downloads a PDF of at least 2 pages: scores, verdict, imagery, sources, licences, model version, reproduce command. Works offline for curated sites | Should |
| US-11 | As a **citizen**, I want to nominate a site with evidence so that experts can review it | The form validates fields (title ≤ 80, description ≤ 1000, ≤ 3 https URLs); it writes `pending` only; it needs App Check; the entry is not public until approved | Should |
| US-12 | As a **reviewer**, I want a review queue so that I can approve or reject nominations | Reviewer accounts (custom claim) see pending entries and can set the status with a note; others are denied (rules-tested) | Should |
| US-13 | As a **scientist**, I want to read the validation results and method so that I can trust the scores | The Method page shows AUC with CI, the percentile test, ablation, scale and DEM sensitivity, learned vs. expert weights, and limitations | Must |
| US-14 | As a **member of the public**, I want a plain-English findings report so that I understand the discoveries | The Findings page and `docs/REPORT.md` give the top 10 per target, 2 flagship case studies and "Use it for" lines | Must |
| US-15 | As a **scientist**, I want process tags (aeolian, evaporite, volcanic, periglacial, impact) so that I see process analogs | Tags appear with the data and threshold that triggered them | Should |
| US-16 | As a **user on a slow or no network**, I want the demo to work offline so that it never fails live | With `VITE_OFFLINE=1` / `OFFLINE=1`, the tour, curated sites and 10 demo AOIs work with zero network calls | Must |
| US-17 | As a **user**, I want to export results (CSV/JSON) so that I can analyse them elsewhere | Export includes the model version, weights and source list | Must (exists) |

## 4. Functional requirements
- **FR-1:** Scored indicators use NASA datasets only. Non-NASA data are optional,
  labelled extras.
- **FR-2:** All numbers come from deterministic `compute/` (Python) or its TS
  mirror, kept in parity by golden tests (≤ 1e-9). No LLM produces a number.
- **FR-3:** Every artifact, API response and PDF carries `model_version`.
- **FR-4:** The global screen covers land cells between 83°S and 83°N at
  0.1°. Stage 2 refines the top 400 per target with 100 m terrain.
- **FR-5:** Validation metrics are pre-registered in `docs/VALIDATION.md` and
  reported whatever the result.
- **FR-6:** The API exposes `/api/v1/health`, `/version` and
  `/terrain` (contract in `openapi.json`).
- **FR-7:** Firestore holds nominations, the review queue, `aoi_cache` and
  feedback. Client access is governed by deny-by-default rules.

## 5. Non-functional requirements
| Category | Requirement |
|---|---|
| Performance | Coarse score ≤ 100 ms; terrain p95 ≤ 8 s uncached / ≤ 300 ms cached; LCP ≤ 2.5 s desktop; Lighthouse perf ≥ 0.85 desktop / 0.70 mobile |
| Accessibility | WCAG 2.2 AA; keyboard alternative for every map action; reduced motion honoured; axe serious/critical = 0 |
| Security | OWASP ASVS L1; App Check; strict CSP; no secrets in the repo or bundle; full security CI suite green |
| Reliability | Uptime ≥ 99% through Jan 2027; offline mode; rollback in ≤ 5 min |
| Cost | ≤ $2/month typical; Cloud Run min-instances 0 except 12–14 Nov; budget alert $5 |
| Compliance | Apache-2.0 code; OSI-licensed dependencies; open data with citations; AI use disclosed; no under-18 likenesses |
| Maintainability | Conventional Commits; ≥ 80% coverage on `compute/`; typed API contract |
| Portability | Latest two versions of Chrome, Firefox, Safari and Edge; iOS/Android phones ≥ 360 px wide |

## 6. Out of scope (Won't)
- Mars Climate Database (licence).
- Deep-learning models.
- User accounts for the public.
- Live NASA calls during the demo.
- Scoring caves, mines and subsurface environments.

## 7. Release criteria (v1.0.0, 13 Nov)
- All Must stories meet their acceptance criteria.
- Metrics measured and published.
- QA, usability and security passes done.
- Offline dry run passed on 12 Nov.
