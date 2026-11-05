# Use of AI in SolMate

Space Apps asks every team to say how it used AI. This page says which tools we used, what each one did, and what no AI ever does in SolMate.

## The rule we kept

**No AI model produces a number in SolMate.** Every score, indicator, ranking and validation result comes from deterministic code in `analysis/src/solmate/compute/` (Python) and its TypeScript mirror `frontend/src/science/`, applied to NASA data. The two are kept in step by golden tests. The only fitted model is the "Learned" weight preset: a non-negative logistic regression from scikit-learn, trained and checked by cross-validation in `pipeline/validate_v2.py`. It is ordinary statistics, not generative AI, and there is no deep learning anywhere in the project ([ADR 0006](adr/0006-deterministic-compute-learned-weights-no-dl.md)).

## Tools and what they did

| Tool | What it did | What it did not do |
|---|---|---|
| **Claude Code** (Anthropic), with the team | Wrote most of the code, tests, pipeline steps and docs under the team's direction. The team set the goals and rules, checked the work on a local dev server and approved every production release. | It did not decide which results to publish, and it did not make a release on its own. |
| **Firecrawl** (search and page reading, through Claude Code) | Research: NASA's Artemis landing regions, NASA SWIM ice maps for Arcadia Planitia, LP DAAC access to ASTER GDEM, NASA POWER, the MODIS to VIIRS transition, related projects and past winners. | Found sources only. Every value we use is read from the NASA product or the cited paper itself. |
| **TypeSafe Jev** (System One, `jev-1.13.0`) | `analysis/claims_check.py` asked one multiple-choice question per claim: does the stored source excerpt support, contradict or say nothing about the short context claim shown next to each site of the **October prototype** (`analysis/sites.yaml`)? Only "supports" at confidence 0.8 or more counted; everything else went to a person. Results: `frontend/public/data/claims.v1.json` (11 Oct 2026). | It never touched a score. It has **not** been run on the v2 target values in `targets.yaml`; those were checked against their cited sources by a research pass and are listed with their citation, method and uncertainty on the Data page. |
| **Design and review skills** in Claude Code (Impeccable, design critique, accessibility, code review, security review, Teardown for the Twin Drive rover view) | Checklists and reviews for layout, accessibility, security and code quality. | No content decisions about the science. |
| **A second AI agent** (review only, 5 Nov 2026) | Read the repository and live site and wrote a review. Its findings led to clearer wording about novelty, validation, the Artemis mission names and the rover view. | It changed no files. |

## Where people stayed in charge

- Deciding the scoring method, the datasets, the validation design and what to publish, including weak results.
- Checking every change on a local dev server before it went live.

## Keys and data

The TypeSafe key lives only in a developer's local environment (`TYPESAFE_API_KEY`). It is never committed, logged or shipped to the website. No user data is sent to any AI service.
