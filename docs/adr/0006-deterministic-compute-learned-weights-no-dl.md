# ADR-0006: Deterministic compute; learned weights are the only ML; no deep learning

- Status: accepted (2026-10-30, user decision)

## Context
- About 25 documented analog sites cannot validate a deep model.
- The challenge asks for analysis "beyond visual similarity".

## Decision
- All scores come from pure functions in `compute/`.
- The only ML is non-negative L2 logistic regression on dimension sub-scores,
  with repeated stratified 5-fold cross-validation. It is shipped as the
  "Learned" preset next to the expert weights.
- LLMs (TypeSafe/Jev) only check cited text and never produce numbers.

## Consequences
- Explainable and testable.
- The "no model computes a number" claim holds.
