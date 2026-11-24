# ADR-0008: Build the constraint solver in-house

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Rostering is a constraint optimization problem. Options include MIP/CP solvers or hosted optimization APIs. Customers require self-hosting and no external services; the portfolio constraints forbid solver libraries.

## Decision Drivers

- No external services or native binaries
- Explainability of every penalty
- Control over domain rules (rest, DST, fairness)
- Good-enough solutions in seconds

## Considered Options

1. MIP/CP-SAT via native library
2. Hosted optimization API
3. In-house heuristic: greedy construction + local search

## Decision

Implement the model, evaluators and search in TypeScript in `packages/shared/src/solver`. Rules are plain functions over compiled arrays, so each penalty maps to a human-readable violation.

## Consequences

- Good: runs anywhere Node runs, including the browser later.
- Good: rules are readable code reviewed by schedulers' requirements.
- Bad: no optimality guarantee or lower bound; quality is measured by benchmarks and tests (RO-164 adds tabu, reheating and multi-start).
