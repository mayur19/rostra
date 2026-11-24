# ADR-0013: Explainable violations produced by the evaluators themselves

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Schedulers and managers distrust a black box. Every penalty must be traceable to employees, shifts and limits, and the explanation must never disagree with the score.

## Decision Drivers

- Explanation equals score
- Readable messages
- No cost during search

## Considered Options

1. Separate explanation pass with its own logic
2. Optional violation sink inside the same evaluators

## Decision

`scoreEmployee(problem, e, slots, sink?)` pushes a `Violation` (constraint, severity, penalty, employeeId, shiftIds, message) for every penalty when a sink is passed; the annealer calls it without a sink. Messages are built lazily via closures. `evaluateSolution` sorts hard first, then by penalty.

## Consequences

- Good: score and explanation cannot drift; messages are asserted in tests.
- Good: zero allocation overhead in the hot loop.
- Neutral: what-if explanations (RO-161) will reuse the same evaluator.
