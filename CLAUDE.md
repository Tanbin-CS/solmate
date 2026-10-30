# SolMate — rules for coding agents

SolMate finds Earth analogs for NASA Artemis base regions and Mars sites.
Submission repo: `Tanbin-CS/solmate` (a fork). PRs target this repo's `main`:
`gh pr create --repo Tanbin-CS/solmate --base main`. Never push to or open PRs
against `hellorifat/solmate`, and never touch branch `prototype/jezero`.

## Non-negotiables
1. **NASA data first.** Every *scored* indicator comes from a NASA dataset.
   Non-NASA data (ESA, AWS tiles) may only be optional, labelled extras.
2. **Deterministic science.** All numbers come from `analysis/src/solmate/compute/`
   (Python) and its TypeScript mirror `frontend/src/science/` kept in parity by
   golden tests. `compute/` does no I/O, no network, no LLM calls.
3. **No live NASA calls in the demo path.** The browser reads precomputed files;
   the API reads its cache/GCS mirror first. `OFFLINE=1` / `VITE_OFFLINE=1` must work.
4. **Security.** No secrets in code, logs or the web bundle. Validate all input
   (pydantic strict / zod). Firestore rules are deny-by-default. Pin GitHub
   Actions to SHAs. Run `gitleaks` before committing.
5. **Meaningful commits.** Conventional Commits (`feat|fix|docs|test|refactor|perf|build|ci|chore(scope): subject`),
   imperative subject <= 72 chars, a body that explains why, one logical change
   per commit with its tests. No "wip"/"update" commits. Rebase-merge only.
6. **Licences.** Only OSI-licensed code and open/unrestricted data. Record every
   dataset in `docs/DATA_SOURCES.md`.

## Commands
- Web: `cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build`
- Science: `cd analysis && uv run pytest`
- Secrets: `gitleaks git --redact .`

## Layout
`analysis/` science pipeline · `api/` Cloud Run terrain service · `frontend/` web
app · `infra/` Firebase rules and configs · `docs/` PRD, architecture, ADRs,
validation, data sources, AI use, submission.
