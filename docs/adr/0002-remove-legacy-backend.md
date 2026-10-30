# ADR-0002: Remove the legacy Django backend

- Status: accepted (2026-10-30)

## Context
- The prototype's Django API returned hardcoded scores.
- It held secrets in settings, and the web app did not use it.

## Decision
- Delete `backend/` from the submission repo.
- Do not rewrite history.
- The original author was asked to rotate the leaked keys.
- `.gitleaksignore` records the three historical findings.

## Consequences
- No fake results or insecure service ships.
- Scans stay strict for all new commits.
