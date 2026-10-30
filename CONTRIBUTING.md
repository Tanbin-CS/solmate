# Contributing to SolMate

## Workflow
1. Open or pick an issue on the project board (labels: `must`, `should`,
   `could`, `wont`; sprint milestone).
2. Branch from `main`: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`.
3. Keep PRs small (about 400 changed lines or fewer) and target
   `Tanbin-CS/solmate:main`.
4. CI must be green: lint, typecheck, tests, build, secret scan, dependency
   audit, CodeQL/Semgrep and commit-message lint.
5. PRs are rebase-merged, so every commit lands on `main` as written.

## Commit messages
We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(explorer): show per-dimension contribution bars

Judges and users need to see which dimensions drive a score, not only
the total. Bars use the same contribution values the API returns.

Refs #42
```

- Subject: imperative, at most 72 characters, no trailing period.
- Body: explain *why*. The diff already shows *what*.
- One logical change per commit, with its tests. Each commit must build.
- Not accepted: "wip", "update", "fix stuff", or mixed unrelated changes.
  Clean up with `git rebase -i` before review.

## Local hooks
`npm install` at the repo root installs lefthook. It runs:
- formatting and lint on staged files;
- a secret scan (`gitleaks`) before each commit;
- commitlint on each commit message.

## Data and licences
- Every new dataset goes into `docs/DATA_SOURCES.md` with its version, DOI or
  URL, licence and use.
- Scored indicators must use NASA data.
- Third-party code must be OSI-licensed.

## AI use
- Record AI assistance in `docs/AI_USE.md`: tool, purpose, prompts and the
  human review done.
- No AI system computes any score.
