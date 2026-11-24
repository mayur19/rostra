# ADR-0016: Fairness measured as variance of utilization

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Fair distribution must compare part-timers and full-timers on equal terms and be cheap to update during search.

## Decision Drivers

- Comparable across contract sizes
- O(1) incremental update
- Interpretable

## Considered Options

1. Variance of raw hours
2. Gini coefficient of hours
3. Max-min spread
4. Variance of utilization = assigned minutes / contracted minimum minutes

## Decision

For employees with a non-zero minimum, utilization `u = minutes / (minHours * 60)`. Penalty = `round(weight.fairness * Var(u))` with default weight 200, computed from running count, sum and sum of squares. The standard deviation is reported as `metrics.utilizationStdDev`.

## Consequences

- Good: a 16 h part-timer at 16 h and a 32 h full-timer at 32 h are equally utilized.
- Good: incremental update is O(1).
- Bad: ignores weekend and night distribution; covered by the fairness report and future soft rules (RO-220).
