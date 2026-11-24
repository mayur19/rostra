# ADR-0015: Contract terms embedded in the employees table for the first slice

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

Contracts change over time (a nurse moves from 0.6 to 0.8 FTE in March). Versioned contracts with effective dates are the target model, but the solver slice needs only the terms in force.

## Decision Drivers

- Ship the solver slice
- Keep a migration path

## Considered Options

1. Versioned `contracts` table now
2. Columns on `employees` now, versioned table later

## Decision

Store `min/max_hours_per_week`, `overtime_after_hours`, `max_consecutive_days`, `min_rest_hours`, `max_shifts_per_day` on `employees` with CHECK constraints, and a `version` counter bumped on update. RO-113 introduces `contracts(employee_id, effective_from, ...)` and backfills from these columns.

## Consequences

- Good: simple queries; the domain `Contract` type is already separate.
- Bad: past rosters re-evaluated today use today's terms until RO-113.
