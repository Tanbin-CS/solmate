# Security policy

## Reporting a vulnerability
Please report privately through GitHub: **Security → Report a vulnerability**
on https://github.com/Tanbin-CS/solmate. Do not open a public issue. We aim to
acknowledge reports within 72 hours.

## Scope
- Web app: https://solmate-analog.web.app (the old https://solmate-13571.web.app redirects there)
- Terrain API (`/api/v1/*`, Cloud Run)
- Firestore rules (nominations, review queue)
- This repository and its CI/CD workflows

## What we do
- No secrets in the repo or in the web bundle. Secret scanning runs in
  pre-commit and CI, with GitHub push protection on.
- Input validation on every API field. App Check is required on the API and
  Firestore. Firestore rules are deny-by-default, tested in the emulator.
- Dependencies are locked and audited (Dependabot, pip-audit, npm audit),
  with CodeQL and Semgrep static analysis and a container image scan.
- GitHub Actions are pinned to commit SHAs with least-privilege
  `permissions`. Deploys use Workload Identity Federation (no JSON keys).
- Strict security headers (CSP, HSTS, frame-ancestors none).

The threat model is in `docs/SECURITY_MODEL.md`.
