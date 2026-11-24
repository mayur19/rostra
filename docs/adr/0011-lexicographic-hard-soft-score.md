# ADR-0011: Lexicographic hard/soft score collapsed with HARD_MULTIPLIER

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Some rules are legal or safety requirements (rest, skills, coverage) and others are preferences. Weighted sums can trade a legal breach for many small preference wins.

## Decision Drivers

- Hard rules always dominate
- Single scalar for annealing acceptance
- Penalties proportional to magnitude for gradient

## Considered Options

1. Single weighted sum
2. Strict lexicographic comparison everywhere
3. Two-level score `{hard, soft}` collapsed as `hard * 1,000,000 + soft` for search

## Decision

Every rule has a severity. Hard penalties scale with magnitude (per missing head, per started hour of rest shortfall, per extra consecutive day). The search compares `hard * HARD_MULTIPLIER + soft`, so moves adding hard penalty are effectively never accepted and moves removing it always are. Results expose `{hard, soft}` and `feasible = hard === 0`.

## Consequences

- Good: easy to reason about and display.
- Bad: hard rules trade among themselves by weight (e.g. 10 per unfilled slot vs 2 per hour of rest shortfall); documented in DEFAULT_WEIGHTS and configurable later (RO-165).
