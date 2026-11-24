# ADR-0007: Incremental scoring with one mutable SearchState

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Annealing evaluates tens of thousands of candidate moves. Re-evaluating the whole roster per move (O(S log S + E)) dominates runtime. The codebase otherwise follows immutable, pure functions.

## Decision Drivers

- Solve 500+ slots in well under a second
- Exactness of reported scores
- Keep public API pure

## Considered Options

1. Full re-evaluation per move with immutable copies
2. Delta formulas per constraint
3. Per-employee rescoring in a private mutable state object

## Decision

`SearchState` holds the slot assignment (`Int32Array`), per-employee slot lists and cached per-employee scores. A move touches at most two employees, which are rescored with the same `scoreEmployee` used by the full evaluator; fairness uses an O(1) running sum and sum of squares. The state never escapes `solve()`, which returns a fresh full evaluation of the best assignment.

## Consequences

- Good: one move costs O(k log k) for k shifts per employee (k ~ 5) plus O(1).
- Good: no duplicated rule logic; `state.test.ts` checks incremental == full after thousands of random moves.
- Bad: the one deliberate exception to the immutability rule; confined to `solver/state.ts`.
