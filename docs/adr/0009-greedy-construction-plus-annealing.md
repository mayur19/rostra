# ADR-0009: Most-constrained-first greedy construction followed by simulated annealing

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

A pure local search from an empty roster wastes iterations filling obvious slots; a pure greedy gets trapped (for example by taking the only ICU-qualified nurse for a ward shift).

## Decision Drivers

- Fast feasible start
- Escape local optima
- Simple, tunable

## Considered Options

1. Greedy only
2. Random start + annealing
3. Tabu search
4. Greedy (most constrained first) + simulated annealing with reassign and swap moves

## Decision

Greedy orders open slots by number of statically eligible employees, then start time, and gives each slot the candidate with the lowest resulting total score (or leaves it open if every candidate is worse). Annealing then runs `iterations` steps with a geometric cooling schedule from 40 to 0.05, choosing reassign (60%) or swap moves; reassign picks an eligible employee 89% of the time, any employee 8%, unassign 3%. The best assignment seen is returned.

## Consequences

- Good: greedy alone reaches full coverage on typical wards; annealing removes soft penalties (e.g. 293 -> 234 on the demo ward).
- Good: the trap case is covered by a test.
- Bad: temperatures are tuned for default weights; per-org weights (RO-165) may need adaptive temperatures (RO-164).
