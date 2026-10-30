# ADR-0008: Security baseline

- Status: accepted (2026-10-30, user requirement)

## Decision
- **CI on every PR:** gitleaks, CodeQL (security-extended), Semgrep (OWASP),
  npm audit, pip-audit, an OSI licence allowlist and commitlint.
- **Supply chain:** actions pinned to SHAs; Dependabot with a 7-day cooldown.
- **GCP access:** Workload Identity Federation with no keys, and
  least-privilege service accounts.
- **Runtime:** App Check, deny-by-default Firestore rules, and strict CSP and
  HSTS headers.
- **Process:** a `/security-review` on each feature PR, and a full security
  pass on 8 Nov.

## Consequences
- A security failure blocks merges.
- Small, regular update PRs.
