# ADR-0010: Seeded PRNG and iteration budget for reproducible solves

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Schedulers must be able to reproduce a roster when asked why it looks the way it does; tests must be stable. Time-boxed search produces different results on different machines.

## Decision Drivers

- Bit-for-bit reproducibility
- Stable CI
- Auditability (seed stored per run)

## Considered Options

1. `Math.random` + wall-clock time limit
2. Seeded PRNG + wall-clock limit
3. Seeded PRNG + iteration budget

## Decision

Use mulberry32 seeded from the request (`seed`, default 1), budget by iteration count (default 20,000, capped by `MAX_ITERATIONS`=500,000 and `SOLVER_MAX_ITERATIONS`), shuffle candidates with the seeded RNG and keep all orderings stable (input order, start time, index). Seed and iterations are stored in `solver_runs`.

## Consequences

- Good: same data + seed + budget = same roster, asserted in tests.
- Bad: run time varies with machine speed; the API caps iterations to bound latency.
